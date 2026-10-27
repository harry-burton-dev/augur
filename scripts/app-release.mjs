// App releases: each app in apps/ (other than those that ship with AUGUR) is released on its own,
// as one signed bundle a deployment's app runner can install by itself, with no AUGUR release.
//   node scripts/app-release.mjs pending          in the Release workflow: prints, as JSON, the apps whose current
//                                                 version has no release yet ([{ id, version, channel }])
//   node scripts/app-release.mjs pack <id> <file> packs the app's built frontend into one tarball (the service kit's packFrontend)
//   node scripts/app-release.mjs publish <id> <bundle.json>
//                                                 after infra/release-app.sh: makes the GitHub release app/<id>@<version>
//                                                 with app-release.json attached, which tags it
//   node scripts/app-release.mjs describe <id> [bundle.json]
//                                                 prints the app-release.json it would attach, to check by hand
// For pull requests' previews (.github/workflows/app-preview.yml):
//   node scripts/app-release.mjs changed <base>   prints, as JSON, the apps the pull request changes ([{ id, version }])
//   node scripts/app-release.mjs preview <id> <pr> <run>
//                                                 gives the app the preview version <x.y.z>-pr.<pr>.<run> in this checkout
//                                                 (its manifest and packages) and prints it
//   node scripts/app-release.mjs previews-clean <pr> [<tag>...]
//                                                 deletes the pull request's preview releases and tags, but those named
//
// An app's version is its manifest's (its frontend package's, or its service's when it has none). A version
// with a prerelease part (1.2.0-beta.1) is on the beta channel, any other on stable. A pull request's
// build is on the preview channel, with a version of its own that no deployment installs as the app:
// the app runner runs it beside the app, for the app's developers.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';
import { changelogFor, PILLAR_APPS } from './augur-release.mjs';

const root = new URL('..', import.meta.url).pathname;
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** What an app-release.json says it is, so a runner can refuse one it doesn't understand. */
export const APP_RELEASE_SCHEMA = 'augur.app-release/v1';
/** The media type of a frontend tarball in the registry, as ORAS pushes it. */
export const FRONTEND_MEDIA_TYPE = 'application/vnd.augur.frontend.v1.tar+gzip';
/** The tag an app's release gets: app/<id>@<version>, beside AUGUR's augur@<version>. */
export const appTag = (id, version) => `app/${id}@${version}`;

/** A pull request's build: <x.y.z>-pr.<number>.<run>, as the registry recognises it. */
const PREVIEW = /-pr\.(\d+)\.\d+$/;
/** stable, beta for a version with a prerelease part, or preview for a pull request's build. */
export const channelOf = (version) => (PREVIEW.test(version) ? 'preview' : semver.prerelease(version) ? 'beta' : 'stable');
/** The version a pull request's build is given: the app's own, without any prerelease part, then the pull request and run. */
export const previewVersion = (version, pr, run) => {
  const base = semver.parse(version);
  if (!base) throw new Error(`"${version}" is not a version.`);
  if (!/^\d+$/.test(String(pr)) || !/^\d+$/.test(String(run))) throw new Error('The pull request and run are numbers.');
  return `${base.major}.${base.minor}.${base.patch}-pr.${pr}.${run}`;
};
/** The pull request a preview release's tag was built from, or undefined. */
export const previewPrOf = (tag) => {
  const m = /^app\/[a-z][a-z0-9-]{1,39}@(.+)$/.exec(tag);
  const pr = m && PREVIEW.exec(m[1]);
  return pr ? Number(pr[1]) : undefined;
};
/** Which apps a pull request changes, from the paths it touches. */
export const changedApps = (apps, paths) => apps.filter((a) => paths.some((p) => p.startsWith(`${a.path}/`)));

/** Every app in apps/ that is released on its own: its folder, manifest and packages. */
export const readApps = () => {
  const apps = [];
  for (const dir of readdirSync(join(root, 'apps'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const path = `apps/${dir.name}`;
    if (PILLAR_APPS.includes(dir.name) || !existsSync(join(root, path, 'manifest.json'))) continue;
    const pkg = (sub) => (existsSync(join(root, path, sub, 'package.json')) ? { name: readJson(`${path}/${sub}/package.json`).name, path: `${path}/${sub}` } : undefined);
    apps.push({ id: dir.name, path, manifest: readJson(`${path}/manifest.json`), service: pkg('service'), frontend: pkg('frontend') });
  }
  return apps;
};

/** What a version asks an admin for, beyond what any app gets: for a runner to compare with the version before. */
export const asksOf = (manifest) => ({
  scopes: manifest.scopes ?? [],
  storage: manifest.storage ?? {},
  floors: manifest.floors ?? ['personal', 'team', 'org'],
  maxUpload: manifest.maxUpload ?? 10,
  settings: (manifest.settings ?? []).map((s) => s.id),
});

/**
 * The file a deployment installs from: the manifest, where its service image and frontend are, by
 * digest, who built and signed them, and what it asks for. `bundle` is what infra/release-app.sh printed.
 */
export const appRelease = ({ app, bundle, signer, notes = '', releasedAt = new Date().toISOString(), preview }) => {
  const { manifest } = app;
  if (bundle.service && !/@sha256:[0-9a-f]{64}$/.test(bundle.service)) throw new Error(`The service image must be named by digest, not ${bundle.service}.`);
  if (bundle.frontend && !/@sha256:[0-9a-f]{64}$/.test(bundle.frontend.artifact)) throw new Error(`The frontend must be named by digest, not ${bundle.frontend.artifact}.`);
  if (!bundle.service && !bundle.frontend) throw new Error(`${app.id} has neither a service nor a frontend to release.`);
  return {
    schema: APP_RELEASE_SCHEMA,
    id: manifest.id,
    version: manifest.version,
    channel: bundle.channel ?? channelOf(manifest.version),
    releasedAt,
    sdk: manifest.sdk,
    manifest,
    service: bundle.service ? { image: bundle.service } : null,
    frontend: bundle.frontend ? { artifact: bundle.frontend.artifact, digest: bundle.frontend.digest, mediaType: FRONTEND_MEDIA_TYPE } : null,
    signer,
    asks: asksOf(manifest),
    notes,
    // Which pull request it was built from, and where to read it.
    ...(preview ? { preview } : {}),
  };
};

/** The pull request a preview is built from, from the workflow's settings. */
const previewFromEnv = (env = process.env) =>
  env.PR_NUMBER ? { pr: Number(env.PR_NUMBER), ...(env.PR_TITLE ? { title: env.PR_TITLE.slice(0, 300) } : {}), ...(env.PR_URL ? { url: env.PR_URL } : {}) } : undefined;

/** The app's changelog for this version, from its frontend's and its service's. */
const notesFor = (app) =>
  [app.frontend, app.service]
    .filter(Boolean)
    .map((p) => changelogFor(p.path, readJson(`${p.path}/package.json`).version))
    .filter(Boolean)
    .join('\n\n');

/** Who built it: this repository's Release workflow, which a runner checks each signature against. */
const signerFromEnv = (env = process.env) => ({
  repository: env.GITHUB_REPOSITORY ?? 'harry-burton-dev/im-platform',
  workflow: env.GITHUB_WORKFLOW_REF?.replace(/^[^/]+\/[^/]+\//, '').replace(/@.*$/, '') ?? '.github/workflows/release.yml',
});

const main = async () => {
  const [mode, id, file] = process.argv.slice(2);
  const apps = readApps();
  const app = id && apps.find((a) => a.id === id);
  if (id && !app && !['pending', 'changed', 'previews-clean'].includes(mode)) throw new Error(`No app "${id}" is released on its own (pillar apps go out with AUGUR).`);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

  if (mode === 'pending') {
    const tags = new Set(
      git('ls-remote', '--tags', 'origin', 'refs/tags/app/*')
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\trefs/tags/')[1]),
    );
    // 0.0.0 is a new app's version until its first Version packages PR: nothing to release yet.
    const pending = apps.filter((a) => a.manifest.version !== '0.0.0' && !tags.has(appTag(a.id, a.manifest.version))).map((a) => ({ id: a.id, version: a.manifest.version, channel: channelOf(a.manifest.version) }));
    console.log(JSON.stringify(pending));
  } else if (mode === 'changed') {
    const paths = git('diff', '--name-only', `${id}...HEAD`).split('\n').filter(Boolean);
    console.log(JSON.stringify(changedApps(apps, paths).map((a) => ({ id: a.id, version: a.manifest.version }))));
  } else if (mode === 'preview') {
    const [, , pr, run] = process.argv.slice(2);
    const version = previewVersion(app.manifest.version, pr, run);
    // In this checkout only: the build, the image's /healthz and the release all say the preview's version.
    const setVersion = (path) => {
      const json = readJson(path);
      json.version = version;
      writeFileSync(join(root, path), `${JSON.stringify(json, null, 2)}\n`);
    };
    setVersion(`${app.path}/manifest.json`);
    for (const pkg of [app.frontend, app.service].filter(Boolean)) setVersion(`${pkg.path}/package.json`);
    console.log(version);
  } else if (mode === 'previews-clean') {
    const keep = new Set(process.argv.slice(4));
    const pr = Number(id);
    const tags = JSON.parse(execFileSync('gh', ['release', 'list', '--limit', '500', '--json', 'tagName'], { cwd: root, encoding: 'utf8' })).map((r) => r.tagName);
    for (const tag of tags.filter((t) => previewPrOf(t) === pr && !keep.has(t))) {
      execFileSync('gh', ['release', 'delete', tag, '--yes', '--cleanup-tag'], { cwd: root, stdio: 'inherit' });
      console.log(`Deleted ${tag}.`);
    }
  } else if (mode === 'pack') {
    if (!app.frontend) throw new Error(`${id} has no frontend.`);
    const { packFrontend, readFrontend } = await import(join(root, 'platform/packages/service-kit/dist/frontend.js'));
    const dist = join(root, app.frontend.path, 'dist');
    if (!existsSync(dist)) throw new Error(`${app.frontend.path}/dist is missing: build the frontend first.`);
    writeFileSync(file, packFrontend(readFrontend(dist)));
    console.error(`Packed ${app.frontend.path}/dist into ${file}.`);
  } else if (mode === 'describe' || mode === 'publish') {
    // Without a bundle, describe shows where each part will go, with a stand-in digest.
    const zero = `@sha256:${'0'.repeat(64)}`;
    const bundle = file
      ? JSON.parse(readFileSync(file, 'utf8'))
      : { service: app.service ? `ghcr.io/<repo>/apps/${id}${zero}` : null, frontend: app.frontend ? { artifact: `ghcr.io/<repo>/apps/${id}-frontend${zero}`, digest: zero.slice(1) } : null };
    const preview = bundle.channel === 'preview' ? previewFromEnv() : undefined;
    if (bundle.channel === 'preview' && !preview) throw new Error('A preview is released from a pull request: PR_NUMBER is not set.');
    const release = appRelease({ app, bundle, signer: signerFromEnv(), notes: preview ? '' : notesFor(app), preview });
    if (mode === 'describe') return console.log(JSON.stringify(release, null, 2));
    const tag = appTag(release.id, release.version);
    if (git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`)) return console.log(`${tag} is already released.`);
    const dir = mkdtempSync(join(tmpdir(), 'app-release-'));
    const asset = join(dir, 'app-release.json');
    writeFileSync(asset, `${JSON.stringify(release, null, 2)}\n`);
    const notesFile = join(dir, 'notes.md');
    writeFileSync(
      notesFile,
      preview
        ? `A preview of ${release.manifest.name} from pull request #${preview.pr}${preview.title ? `, ${preview.title}` : ''}. It runs beside the app for its developers, and goes when the pull request closes.\n`
        : `${release.manifest.name} ${release.version} (${release.channel}).\n\n${release.notes || '_No changelog entry._'}\n`,
    );
    const beta = release.channel !== 'stable';
    // A pull request's merge commit isn't on a branch, so its preview is tagged on the pull request's head.
    const target = process.env.RELEASE_TARGET || git('rev-parse', 'HEAD');
    execFileSync('gh', ['release', 'create', tag, '--target', target, '--title', `${release.manifest.name} ${release.version}`, '--notes-file', notesFile, ...(beta ? ['--prerelease'] : ['--latest=false']), asset], { cwd: root, stdio: 'inherit' });
    console.log(`Released ${tag}.`);
  } else {
    console.error('Usage: node scripts/app-release.mjs pending | pack <id> <file> | describe <id> [bundle.json] | publish <id> <bundle.json> | changed <base> | preview <id> <pr> <run> | previews-clean <pr> [<tag>...]');
    process.exit(2);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
