#!/usr/bin/env node
// Releases an AUGUR app from its own repository (ADR 0047), the way scripts/app-release.mjs does for the
// apps still in the platform repository. Run in the app repository's root, which holds manifest.json,
// frontend/ and service/ (either may be missing) and a Dockerfile for the service; the app template's
// workflows call it.
//   augur-app pending                  prints [{ id, version, channel }] when the manifest's version has no release yet, else []
//   augur-app dev <run>                gives this checkout the dev build version <next patch>-dev.<run> and prints it
//   augur-app preview <pr> <run>       gives this checkout the preview version <x.y.z>-pr.<pr>.<run> and prints it
//   augur-app bundle <channel>         builds, pushes and signs the service image (with its SBOM and provenance attested)
//                                      and the built frontend, and prints
//                                      where each landed, by digest, as JSON (needs docker buildx, oras and cosign)
//   augur-app describe [bundle.json]   prints the app-release.json it would attach (v2 from score/ for an app on contract 3)
//   augur-app publish <bundle.json>    makes the GitHub release app/<id>@<version> with app-release.json attached
//   augur-app release describe|publish the same two, spelt for contract 3
//   augur-app clean-devs [<tag>...]    deletes all but the newest few dev builds, and those named
//   augur-app clean-previews <pr> [<tag>...]
//                                      deletes a pull request's previews, but those named
//   augur-app validate                 checks manifest.json and score/*.score.yaml against contract 3's schemas (ADR 0075)
//                                      and prints each problem with its file; exits 1 when there is one
//   augur-app catalog [--check]        writes catalog-info.yaml, the app's Backstage catalog entry, from manifest.json
//                                      and the parts' package.json files; --check fails when it's out of date
// Images go to ghcr.io/<owner>/<repo>/<id> and <id>-frontend (IMAGE_REPO overrides ghcr.io/<owner>/<repo>).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appCatalog, CATALOG_FILE, catalogText, repoSlug } from '../src/catalog.mjs';
import { readApp, validateApp } from '../src/validate.mjs';
import { appRelease, appTag, changelogSection, channelOf, devVersion, FRONTEND_MEDIA_TYPE, oldDevBuilds, previewPrOf, previewVersion, releaseNotes, signerOf } from '../src/release.mjs';
import { readCheckout, releaseOf2 } from '../src/release2.mjs';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const writeJson = (path, json) => writeFileSync(join(root, path), `${JSON.stringify(json, null, 2)}\n`);
// An image's SBOM alone can run to tens of megabytes, past execFileSync's 1 MB default (ENOBUFS).
const OUTPUT_LIMIT = 512 * 1024 * 1024;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: OUTPUT_LIMIT, ...opts });
const parts = ['frontend', 'service'].filter((p) => existsSync(join(root, p, 'package.json')));

const manifest = () => {
  if (!existsSync(join(root, 'manifest.json'))) throw new Error('No manifest.json here: run augur-app in the app repository’s root.');
  return readJson('manifest.json');
};
const app = () => ({ id: manifest().id, manifest: manifest() });

/** Gives the manifest and each package this version, in this checkout only. */
const setVersion = (version) => {
  for (const path of ['manifest.json', ...parts.map((p) => `${p}/package.json`)]) writeJson(path, { ...readJson(path), version });
};

const releaseTags = () => JSON.parse(run('gh', ['release', 'list', '--limit', '500', '--json', 'tagName'])).map((r) => r.tagName);
const deleteRelease = (tag) => {
  run('gh', ['release', 'delete', tag, '--yes', '--cleanup-tag'], { stdio: 'inherit' });
  console.log(`Deleted ${tag}.`);
};

/** The changelog for this version, from the frontend's and the service's. */
const notesFor = (version) =>
  parts
    .map((p) => (existsSync(join(root, p, 'CHANGELOG.md')) ? changelogSection(readFileSync(join(root, p, 'CHANGELOG.md'), 'utf8'), version) : ''))
    .filter(Boolean)
    .join('\n\n');

/**
 * What is inside the service image and how it was built, signed beside its signature: BuildKit writes a
 * Syft SBOM (SPDX) and SLSA provenance into the image (--sbom, --provenance), and cosign attests both
 * keylessly as this workflow, as AUGUR's own release does (PER-270). Provenance is SLSA v1
 * (buildDefinition) from current BuildKit and v0.2 (builder) from older ones; the type follows it.
 */
const attest = (ref, out) => {
  for (const [kind, field, type] of [['sbom', '.SBOM.SPDX', 'spdxjson'], ['provenance', '.Provenance.SLSA', 'slsaprovenance']]) {
    const value = run('docker', ['buildx', 'imagetools', 'inspect', ref, '--format', `{{ json ${field} }}`]).trim();
    if (!value || value === 'null') throw new Error(`${ref} has no ${kind}: build it with --sbom=true --provenance=true.`);
    const file = join(out, `${kind}.json`);
    writeFileSync(file, value);
    const as = kind === 'provenance' && 'buildDefinition' in JSON.parse(value) ? 'slsaprovenance1' : type;
    run('cosign', ['attest', '--yes', '--type', as, '--predicate', file, ref], { stdio: ['ignore', 2, 2] });
  }
};

/** Where the app's images go: IMAGE_REPO, or ghcr.io under the GitHub repository. */
const imageRepo = () => {
  const repo = (process.env.IMAGE_REPO ?? `ghcr.io/${process.env.GITHUB_REPOSITORY ?? ''}`).toLowerCase();
  if (repo === 'ghcr.io/') throw new Error('Set GITHUB_REPOSITORY or IMAGE_REPO to say where images go.');
  return repo;
};

const bundle = async (channel) => {
  const { id, version } = manifest();
  const repo = imageRepo();
  const out = mkdtempSync(join(tmpdir(), 'augur-app-'));
  let service = null;
  if (parts.includes('service')) {
    if (!existsSync(join(root, 'Dockerfile'))) throw new Error('The app has a service but no Dockerfile.');
    run('docker', ['buildx', 'build', '--push', '--provenance=true', '--sbom=true', '--label', `org.opencontainers.image.version=${version}`, '--label', `org.opencontainers.image.title=${id}`, '-t', `${repo}/${id}:${version}`, '-t', `${repo}/${id}:${channel}`, '--metadata-file', join(out, 'service.json'), '.'], { stdio: ['ignore', 2, 2] });
    const digest = JSON.parse(readFileSync(join(out, 'service.json'), 'utf8'))['containerimage.digest'];
    run('cosign', ['sign', '--yes', `${repo}/${id}@${digest}`], { stdio: ['ignore', 2, 2] });
    attest(`${repo}/${id}@${digest}`, out);
    service = `${repo}/${id}@${digest}`;
  }
  let frontend = null;
  if (parts.includes('frontend')) {
    const dist = join(root, 'frontend', 'dist');
    if (!existsSync(dist)) throw new Error('frontend/dist is missing: build the frontend first.');
    const { packFrontend, readFrontend, frontendDigest } = await import('@augur/service-kit');
    const tarball = packFrontend(readFrontend(dist));
    writeFileSync(join(out, 'frontend.tar.gz'), tarball);
    const pushed = JSON.parse(run('oras', ['push', `${repo}/${id}-frontend:${version},${channel}`, '--artifact-type', 'application/vnd.augur.frontend.v1', '--annotation', `org.opencontainers.image.version=${version}`, '--format', 'json', `frontend.tar.gz:${FRONTEND_MEDIA_TYPE}`], { cwd: out }));
    run('cosign', ['sign', '--yes', `${repo}/${id}-frontend@${pushed.digest}`], { stdio: ['ignore', 2, 2] });
    frontend = { artifact: `${repo}/${id}-frontend@${pushed.digest}`, digest: frontendDigest(tarball) };
  }
  return { service, frontend, channel };
};

/** The release file: v2 from the Score files for an app on contract 3 (ADR 0075), else v1. */
const releaseFile = (bundleJson) => {
  if (manifest().contract !== undefined) {
    const checkout = readCheckout(root, { readdirSync, existsSync, join });
    const quiet = bundleJson.channel === 'preview' || bundleJson.channel === 'dev';
    return releaseOf2({ ...checkout, bundle: bundleJson, signer: signerOf(), notes: quiet ? '' : notesFor(checkout.manifest.version), env: process.env });
  }
  const preview =
    bundleJson.channel === 'preview' && process.env.PR_NUMBER
      ? { pr: Number(process.env.PR_NUMBER), ...(process.env.PR_TITLE ? { title: process.env.PR_TITLE.slice(0, 300) } : {}), ...(process.env.PR_URL ? { url: process.env.PR_URL } : {}) }
      : undefined;
  if (bundleJson.channel === 'preview' && !preview) throw new Error('A preview is released from a pull request: PR_NUMBER is not set.');
  const a = app();
  return appRelease({ app: a, bundle: bundleJson, signer: signerOf(), notes: preview || bundleJson.channel === 'dev' ? '' : notesFor(a.manifest.version), preview });
};

const main = async ([mode, ...args]) => {
  if (mode === 'release') {
    if (!['describe', 'publish'].includes(args[0])) throw new Error('Usage: augur-app release describe [bundle.json] | publish <bundle.json>');
    if (manifest().contract === undefined) throw new Error('manifest.json names no contract: augur-app release is for an app on contract 3 (augur-app validate says what it needs).');
    return main(args);
  }
  if (mode === 'pending') {
    const { id, version } = manifest();
    const released = run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${appTag(id, version)}`]).trim();
    console.log(JSON.stringify(version === '0.0.0' || released ? [] : [{ id, version, channel: channelOf(version) }]));
  } else if (mode === 'dev' || mode === 'preview') {
    const version = mode === 'dev' ? devVersion(manifest().version, args[0]) : previewVersion(manifest().version, args[0], args[1]);
    setVersion(version);
    console.log(version);
  } else if (mode === 'bundle') {
    if (!['stable', 'beta', 'preview', 'dev'].includes(args[0])) throw new Error('Say which channel: stable, beta, preview or dev.');
    console.log(JSON.stringify(await bundle(args[0])));
  } else if (mode === 'describe' || mode === 'publish') {
    const zero = `sha256:${'0'.repeat(64)}`;
    // Without a bundle, placeholders: on contract 3 the manifest says whether there is a frontend; before it, the folders do.
    const on3 = manifest().contract !== undefined;
    const hasFrontend = on3 ? Boolean(manifest().frontend) : parts.includes('frontend');
    const hasService = on3 ? readCheckout(root, { readdirSync, existsSync, join }).parts.some((p) => Object.values(p.containers ?? {}).some((c) => c.image === '.')) : parts.includes('service');
    // The placeholder images are named where the build would push them, so they pass the part schema's image rule.
    const repo = imageRepo();
    const bundleJson = args[0]
      ? JSON.parse(readFileSync(args[0], 'utf8'))
      : { service: hasService ? `${repo}/${manifest().id}@${zero}` : null, frontend: hasFrontend ? { artifact: `${repo}/${manifest().id}-frontend@${zero}`, digest: zero } : null };
    const release = releaseFile(bundleJson);
    if (mode === 'describe') return console.log(JSON.stringify(release, null, 2));
    if (!args[0]) throw new Error('publish needs the bundle.json that augur-app bundle printed.');
    const tag = appTag(release.id, release.version);
    if (run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]).trim()) return console.log(`${tag} is already released.`);
    const dir = mkdtempSync(join(tmpdir(), 'augur-app-'));
    writeFileSync(join(dir, 'app-release.json'), `${JSON.stringify(release, null, 2)}\n`);
    writeFileSync(join(dir, 'notes.md'), releaseNotes(release, { target: process.env.RELEASE_TARGET || 'main' }));
    // Every release starts as a pre-release (beta) until it's promoted; a preview is tagged on the pull request's head.
    const target = process.env.RELEASE_TARGET || run('git', ['rev-parse', 'HEAD']).trim();
    run('gh', ['release', 'create', tag, '--target', target, '--title', `${release.manifest.name} ${release.version}`, '--notes-file', join(dir, 'notes.md'), '--prerelease', '--latest=false', join(dir, 'app-release.json')], { stdio: 'inherit' });
    console.log(`Released ${tag}.`);
  } else if (mode === 'clean-devs') {
    for (const tag of oldDevBuilds(releaseTags(), manifest().id, args)) deleteRelease(tag);
  } else if (mode === 'clean-previews') {
    const pr = Number(args[0]);
    for (const tag of releaseTags().filter((t) => previewPrOf(t) === pr && !args.slice(1).includes(t))) deleteRelease(tag);
  } else if (mode === 'validate') {
    if (!existsSync(join(root, 'manifest.json'))) throw new Error('No manifest.json here: run augur-app in the app repository’s root.');
    const checked = readApp(root, { readdirSync, existsSync, join });
    const { ok, problems } = validateApp(checked);
    for (const problem of problems) console.error(problem);
    if (!ok) throw new Error(`${problems.length} problem${problems.length === 1 ? '' : 's'} with this app’s contract-3 files.`);
    console.log(`manifest.json and ${Object.keys(checked.parts).length} part${Object.keys(checked.parts).length === 1 ? '' : 's'} follow contract 3.`);
  } else if (mode === 'catalog') {
    let remote = '';
    try {
      remote = run('git', ['remote', 'get-url', 'origin'], { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      // No remote: GITHUB_REPOSITORY has to say.
    }
    const text = catalogText(appCatalog({ manifest: manifest(), parts: Object.fromEntries(parts.map((p) => [p, readJson(`${p}/package.json`)])), repo: repoSlug({ remote }) }));
    const file = join(root, CATALOG_FILE);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (args[0] === '--check') {
      if (current !== text) throw new Error(`${CATALOG_FILE} is out of date. Run: augur-app catalog, and commit what it writes.`);
      console.log(`${CATALOG_FILE} is up to date.`);
    } else if (current === text) console.log(`${CATALOG_FILE} is up to date.`);
    else {
      writeFileSync(file, text);
      console.log(`Wrote ${CATALOG_FILE}`);
    }
  } else {
    console.error('Usage: augur-app pending | dev <run> | preview <pr> <run> | bundle <channel> | describe [bundle.json] | publish <bundle.json> | release describe|publish … | clean-devs [<tag>...] | clean-previews <pr> [<tag>...] | validate | catalog [--check]');
    process.exit(2);
  }
};

main(process.argv.slice(2)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
