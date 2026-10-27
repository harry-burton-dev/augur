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
//
// An app's version is its manifest's (its frontend package's, or its service's when it has none). A version
// with a prerelease part (1.2.0-beta.1) is on the beta channel, any other on stable. Pull requests
// make previews, on the preview channel, from infra/release-app.sh with a pr-<n> version.
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

/** stable, or beta for a version with a prerelease part. Previews are made apart, with their own versions. */
export const channelOf = (version) => (semver.prerelease(version) ? 'beta' : 'stable');

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
export const appRelease = ({ app, bundle, signer, notes = '', releasedAt = new Date().toISOString() }) => {
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
  };
};

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
  if (id && !app && mode !== 'pending') throw new Error(`No app "${id}" is released on its own (pillar apps go out with AUGUR).`);
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
    const release = appRelease({ app, bundle, signer: signerFromEnv(), notes: notesFor(app) });
    if (mode === 'describe') return console.log(JSON.stringify(release, null, 2));
    const tag = appTag(release.id, release.version);
    if (git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`)) return console.log(`${tag} is already released.`);
    const dir = mkdtempSync(join(tmpdir(), 'app-release-'));
    const asset = join(dir, 'app-release.json');
    writeFileSync(asset, `${JSON.stringify(release, null, 2)}\n`);
    const notesFile = join(dir, 'notes.md');
    writeFileSync(notesFile, `${release.manifest.name} ${release.version} (${release.channel}).\n\n${release.notes || '_No changelog entry._'}\n`);
    const beta = release.channel !== 'stable';
    execFileSync('gh', ['release', 'create', tag, '--target', git('rev-parse', 'HEAD'), '--title', `${release.manifest.name} ${release.version}`, '--notes-file', notesFile, ...(beta ? ['--prerelease'] : ['--latest=false']), asset], { cwd: root, stdio: 'inherit' });
    console.log(`Released ${tag}.`);
  } else {
    console.error('Usage: node scripts/app-release.mjs pending | pack <id> <file> | describe <id> [bundle.json] | publish <id> <bundle.json>');
    process.exit(2);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
