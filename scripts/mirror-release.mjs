// Copies an AUGUR release into an organisation's own registry, for servers that can't reach GitHub
// (docs/mirror.md). Run it somewhere that can reach both, signed in to both with `docker login`:
//   node scripts/mirror-release.mjs <version> --to <registry/path> [--feed <dir>] [--bundle]
//     --to      where the images go, e.g. registry.example.org/augur; servers set PLATFORM_IMAGES to it
//     --feed    the folder the mirror's feed is written to (default: ./augur-mirror): releases.json,
//               which servers read through RELEASE_FEED_URL, gains this release
//     --bundle  also writes the release's deploy files there, as augur-<version>-deploy.tar.gz
//               (needs this checkout to have the augur@<version> tag: git fetch --tags)
//   node scripts/mirror-release.mjs apps --to <registry/path> [--feed <dir>] [--app <id>]...
//               copies apps' releases (each app's newest few, stable and beta, never previews) to
//               <registry/path>/apps/, and writes apps.json, which servers read through APP_FEED_URL
// Each image is copied by digest with its signature (cosign copy), then checked against the workflow
// that signed it from the mirror, so a server's updater can check it the same way. Either way the feed
// folder also gets trusted_root.json, Sigstore's trust root, so a server with no network at all can
// check signatures too. Needs cosign, and GITHUB_TOKEN for a private repository (Contents: read).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import semver from 'semver';

const REPO = process.env.AUGUR_REPO ?? 'harry-burton-dev/im-platform';
/** Who signs AUGUR's images: this repository's Release workflow (infra/release-images.sh). */
/** The branches releases are made from (docs/release-channels.md): main until it became production. */
export const RELEASE_BRANCHES = ['main', 'preview', 'production'];
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A workflow's certificate identity on any branch releases are made from, as a pattern for --certificate-identity-regexp. */
export const releaseIdentity = (workflow) => `^${escape(`https://github.com/${workflow}`)}@refs/heads/(${RELEASE_BRANCHES.join('|')})$`;
export const SIGNER = releaseIdentity(`${REPO}/.github/workflows/release.yml`);
const ISSUER = 'https://token.actions.githubusercontent.com';

/** A release file as the mirror's feed holds it: its channel and notes as GitHub has them now. */
export const asMirrored = (manifest, release) => ({ ...manifest, channel: release.prerelease ? 'beta' : 'stable', notesUrl: release.html_url });

/** The feed with `manifest` in it, newest first, replacing an earlier copy of the same release. */
export const withRelease = (feed, manifest) => ({
  releases: [...(feed?.releases ?? []).filter((m) => m.version !== manifest.version), manifest].sort((a, b) => semver.rcompare(a.version, b.version)),
});

/** Where each image goes: `<to>/<part>:<version>`, as compose.yml names it with PLATFORM_IMAGES=<to>. */
export const destinations = (images, to, version) =>
  Object.entries(images).map(([part, ref]) => ({ part, from: ref, to: `${to.replace(/\/$/, '')}/${part}:${version}`, digest: ref.slice(ref.lastIndexOf('@') + 1) }));

/** How many of each app's newest releases a mirror keeps: enough to go back a version or two. */
export const APP_RELEASES_KEPT = 3;
const APP_TAG = /^app\/([a-z][a-z0-9-]{1,39})@(.+)$/;

/** The app releases to mirror: each app's newest few that aren't previews or drafts, optionally only some apps. */
export const appReleasesToMirror = (releases, only = [], kept = APP_RELEASES_KEPT) => {
  const byApp = new Map();
  for (const r of releases) {
    const m = APP_TAG.exec(r.tag_name ?? '');
    if (!m || r.draft || !semver.valid(m[2]) || /-pr\.\d+\.\d+$/.test(m[2]) || (only.length && !only.includes(m[1]))) continue;
    byApp.set(m[1], [...(byApp.get(m[1]) ?? []), { app: m[1], version: m[2], release: r }]);
  }
  return [...byApp.values()].flatMap((list) => list.sort((a, b) => semver.rcompare(a.version, b.version)).slice(0, kept));
};

/** Where an app's part goes in the mirror: <to>/apps/<id> or <to>/apps/<id>-frontend. */
const mirrorRepo = (to, ref) => `${to.replace(/\/$/, '')}/apps/${ref.slice(ref.lastIndexOf('/') + 1, ref.lastIndexOf('@'))}`;

/** The release file as the mirror serves it: each part named in the mirror, by the same digest. */
export const mirroredAppRelease = (file, to) => ({
  ...file,
  service: file.service ? { ...file.service, image: `${mirrorRepo(to, file.service.image)}${file.service.image.slice(file.service.image.lastIndexOf('@'))}` } : null,
  frontend: file.frontend ? { ...file.frontend, artifact: `${mirrorRepo(to, file.frontend.artifact)}${file.frontend.artifact.slice(file.frontend.artifact.lastIndexOf('@'))}` } : null,
});

/** The apps feed with these release files in it, replacing earlier copies of the same versions. */
export const withAppReleases = (feed, files) => {
  const key = (f) => `${f.id}@${f.version}`;
  const added = new Set(files.map(key));
  return { apps: [...(feed?.apps ?? []).filter((f) => !added.has(key(f))), ...files].sort((a, b) => a.id.localeCompare(b.id) || semver.rcompare(a.version, b.version)) };
};

/** The certificate identity a part must be signed with: its release workflow on a branch releases are made from. */
const signerOf = (file) => releaseIdentity(`${file.signer.repository}/${file.signer.workflow}`);

/** Finds the trust root `cosign initialize` keeps under ~/.sigstore, newest first. */
const findTrustedRoot = (dir = join(homedir(), '.sigstore')) => {
  if (!existsSync(dir)) return undefined;
  const found = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('trusted_root.json')) found.push(path);
    }
  };
  walk(dir);
  return found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
};

/** Copies Sigstore's current trust root into the feed folder, for servers that check signatures offline. */
const writeTrustedRoot = (feedDir, cosign) => {
  cosign('initialize');
  const root = findTrustedRoot();
  if (!root) return console.warn('cosign initialize kept no trusted_root.json, so servers still need Sigstore to check signatures.');
  copyFileSync(root, join(feedDir, 'trusted_root.json'));
  console.log(`${join(feedDir, 'trusted_root.json')} is Sigstore's trust root as of today.`);
};

const github = async (path, accept = 'application/vnd.github+json') => {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(path.startsWith('https:') ? path : `https://api.github.com/repos/${REPO}${path}`, {
    headers: { accept, 'user-agent': 'augur-mirror', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}${res.status === 404 && !token ? ' (a private repository needs GITHUB_TOKEN)' : ''}.`);
  return res.json();
};

/** Copies apps' releases into the mirror, and adds them to apps.json. */
const mirrorApps = async ({ to, feedDir, only, cosign }) => {
  const releases = await github('/releases?per_page=100');
  const chosen = appReleasesToMirror(releases, only);
  if (!chosen.length) throw new Error(`There are no app releases to mirror${only.length ? ` for ${only.join(', ')}` : ''}.`);
  const files = [];
  for (const { app, version, release } of chosen) {
    const asset = release.assets?.find((a) => a.name === 'app-release.json');
    if (!asset) {
      console.warn(`${app} ${version} has no app-release.json; skipped.`);
      continue;
    }
    const file = await github(asset.url, 'application/octet-stream');
    const mirrored = mirroredAppRelease(file, to);
    for (const [from, ref] of [
      [file.service?.image, mirrored.service?.image],
      [file.frontend?.artifact, mirrored.frontend?.artifact],
    ]) {
      if (!from) continue;
      const tagged = `${ref.slice(0, ref.lastIndexOf('@'))}:${version}`;
      console.log(`${app} ${version}: ${from} → ${tagged}`);
      cosign('copy', '--force', from, tagged);
      cosign('verify', '--certificate-identity-regexp', signerOf(file), '--certificate-oidc-issuer', ISSUER, '--output', 'text', ref);
    }
    files.push({ ...mirrored, channel: release.prerelease ? 'beta' : 'stable', notesUrl: release.html_url });
  }
  mkdirSync(feedDir, { recursive: true });
  const feedFile = join(feedDir, 'apps.json');
  const feed = withAppReleases(existsSync(feedFile) ? JSON.parse(readFileSync(feedFile, 'utf8')) : undefined, files);
  writeFileSync(feedFile, `${JSON.stringify(feed, null, 2)}\n`);
  console.log(`${feedFile} now lists ${feed.apps.map((f) => `${f.id} ${f.version}`).join(', ')}.`);
  writeTrustedRoot(feedDir, cosign);
  console.log(`Mirrored apps. Servers: APP_FEED_URL pointing at apps.json (docs/mirror.md).`);
};

const main = async () => {
  const [version, ...rest] = process.argv.slice(2);
  const flag = (name) => {
    const at = rest.indexOf(name);
    return at < 0 ? undefined : rest[at + 1];
  };
  const to = flag('--to');
  const feedDir = resolve(flag('--feed') ?? 'augur-mirror');
  const cosign = (...args) => execFileSync(process.env.COSIGN ?? 'cosign', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (version === 'apps' && to) {
    const only = rest.flatMap((arg, i) => (rest[i - 1] === '--app' ? [arg] : []));
    return mirrorApps({ to, feedDir, only, cosign });
  }
  if (!semver.valid(version) || !to) {
    console.error('Usage: node scripts/mirror-release.mjs <version> --to <registry/path> [--feed <dir>] [--bundle]\n       node scripts/mirror-release.mjs apps --to <registry/path> [--feed <dir>] [--app <id>]...');
    process.exit(2);
  }

  const release = await github(`/releases/tags/augur@${version}`);
  const asset = release.assets?.find((a) => a.name === 'augur-release.json');
  if (!asset) throw new Error(`augur@${version} has no augur-release.json: it was released before images were, so it can't be mirrored.`);
  const manifest = asMirrored(await github(asset.url, 'application/octet-stream'), release);
  if (!manifest.images || !Object.keys(manifest.images).length) throw new Error(`augur@${version}'s release file names no images.`);

  for (const image of destinations(manifest.images, to, version)) {
    console.log(`${image.part}: ${image.from} → ${image.to}`);
    cosign('copy', '--force', image.from, image.to);
    // The copy, by digest, must still be the image the release workflow signed.
    cosign('verify', '--certificate-identity-regexp', SIGNER, '--certificate-oidc-issuer', ISSUER, '--output', 'text', `${to.replace(/\/$/, '')}/${image.part}@${image.digest}`);
  }

  mkdirSync(feedDir, { recursive: true });
  const feedFile = join(feedDir, 'releases.json');
  const feed = withRelease(existsSync(feedFile) ? JSON.parse(readFileSync(feedFile, 'utf8')) : undefined, manifest);
  writeFileSync(feedFile, `${JSON.stringify(feed, null, 2)}\n`);
  console.log(`${feedFile} now lists ${feed.releases.map((m) => m.version).join(', ')}.`);
  writeTrustedRoot(feedDir, cosign);

  if (rest.includes('--bundle')) {
    const bundle = join(feedDir, `augur-${version}-deploy.tar.gz`);
    execFileSync('git', ['archive', '--format=tar.gz', '-o', bundle, `augur@${version}`, 'infra/deploy', 'docs', 'scripts/preflight.mjs'], { stdio: 'inherit' });
    console.log(`Wrote ${bundle}.`);
  }
  console.log(`Mirrored AUGUR ${version}. Servers: PLATFORM_IMAGES=${to} and RELEASE_FEED_URL pointing at releases.json (docs/mirror.md).`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
