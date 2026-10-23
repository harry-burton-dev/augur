// Copies an AUGUR release into an organisation's own registry, for servers that can't reach GitHub
// (docs/mirror.md). Run it somewhere that can reach both, signed in to both with `docker login`:
//   node scripts/mirror-release.mjs <version> --to <registry/path> [--feed <dir>] [--bundle]
//     --to      where the images go, e.g. registry.example.org/augur; servers set PLATFORM_IMAGES to it
//     --feed    the folder the mirror's feed is written to (default: ./augur-mirror): releases.json,
//               which servers read through RELEASE_FEED_URL, gains this release
//     --bundle  also writes the release's deploy files there, as augur-<version>-deploy.tar.gz
//               (needs this checkout to have the augur@<version> tag: git fetch --tags)
// Each image is copied by digest with its signature (cosign copy), then checked against this
// repository's Release workflow from the mirror, so a server's updater can check it the same way.
// Needs cosign, and GITHUB_TOKEN for a private repository (Contents: read).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import semver from 'semver';

const REPO = process.env.AUGUR_REPO ?? 'harry-burton-dev/im-platform';
/** Who signs AUGUR's images: this repository's Release workflow (infra/release-images.sh). */
export const SIGNER = `https://github.com/${REPO}/.github/workflows/release.yml@refs/heads/main`;
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

const github = async (path, accept = 'application/vnd.github+json') => {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(path.startsWith('https:') ? path : `https://api.github.com/repos/${REPO}${path}`, {
    headers: { accept, 'user-agent': 'augur-mirror', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}${res.status === 404 && !token ? ' (a private repository needs GITHUB_TOKEN)' : ''}.`);
  return res.json();
};

const main = async () => {
  const [version, ...rest] = process.argv.slice(2);
  const flag = (name) => {
    const at = rest.indexOf(name);
    return at < 0 ? undefined : rest[at + 1];
  };
  const to = flag('--to');
  const feedDir = resolve(flag('--feed') ?? 'augur-mirror');
  if (!semver.valid(version) || !to) {
    console.error('Usage: node scripts/mirror-release.mjs <version> --to <registry/path> [--feed <dir>] [--bundle]');
    process.exit(2);
  }
  const cosign = (...args) => execFileSync(process.env.COSIGN ?? 'cosign', args, { stdio: ['ignore', 'ignore', 'inherit'] });

  const release = await github(`/releases/tags/augur@${version}`);
  const asset = release.assets?.find((a) => a.name === 'augur-release.json');
  if (!asset) throw new Error(`augur@${version} has no augur-release.json: it was released before images were, so it can't be mirrored.`);
  const manifest = asMirrored(await github(asset.url, 'application/octet-stream'), release);
  if (!manifest.images || !Object.keys(manifest.images).length) throw new Error(`augur@${version}'s release file names no images.`);

  for (const image of destinations(manifest.images, to, version)) {
    console.log(`${image.part}: ${image.from} → ${image.to}`);
    cosign('copy', '--force', image.from, image.to);
    // The copy, by digest, must still be the image the release workflow signed.
    cosign('verify', '--certificate-identity', SIGNER, '--certificate-oidc-issuer', ISSUER, '--output', 'text', `${to.replace(/\/$/, '')}/${image.part}@${image.digest}`);
  }

  mkdirSync(feedDir, { recursive: true });
  const feedFile = join(feedDir, 'releases.json');
  const feed = withRelease(existsSync(feedFile) ? JSON.parse(readFileSync(feedFile, 'utf8')) : undefined, manifest);
  writeFileSync(feedFile, `${JSON.stringify(feed, null, 2)}\n`);
  console.log(`${feedFile} now lists ${feed.releases.map((m) => m.version).join(', ')}.`);

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
