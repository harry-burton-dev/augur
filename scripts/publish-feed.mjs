// The release feed deployments read with their read key: AUGUR's releases and apps' releases as one file,
// pushed to GitHub's container registry beside the images, as ghcr.io/<repo>/feed:latest. A deployment
// can then check for releases with the same read:packages token it pulls images with (docs/upgrade.md,
// "The read key"), where reading GitHub's releases themselves would need a second token.
//   node scripts/publish-feed.mjs [--out <file>] [--push]
//     --out   where to write the feed (default: feed.json)
//     --push  push it with ORAS (signed in to ghcr.io) as ghcr.io/<repo>/feed:latest
// The Release workflow runs it after every release, and again whenever a release is edited, so a
// release promoted to stable on GitHub (pre-release unticked) is stable in the feed too.
// Needs GITHUB_TOKEN (or GH_TOKEN) that can read the repository's releases.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import semver from 'semver';
import { asMirrored } from './mirror-release.mjs';

const REPO = process.env.AUGUR_REPO ?? process.env.GITHUB_REPOSITORY ?? 'harry-burton-dev/im-platform';
/** The feed's media type in the registry. */
export const FEED_MEDIA_TYPE = 'application/vnd.augur.feed.v1+json';
/** How many of AUGUR's newest releases the feed holds: the registry reads at most ten newer than the running one. */
export const AUGUR_RELEASES_KEPT = 20;
/** How many of each app's newest releases (stable or beta) it holds. */
export const APP_RELEASES_KEPT = 4;
/** How many pull requests' previews it holds, each pull request's newest build only. */
export const PREVIEWS_KEPT = 20;

const AUGUR_TAG = /^augur@(.+)$/;
const APP_TAG = /^app\/([a-z][a-z0-9-]{1,39})@(.+)$/;
const PREVIEW = /-pr\.(\d+)\.\d+$/;

/**
 * Which releases go in the feed, newest first: AUGUR's newest few, each app's newest few, and each pull
 * request's newest preview build (the app runner runs those for the app's developers).
 */
export const chooseReleases = (releases) => {
  const listed = releases.filter((r) => !r.draft && typeof r.tag_name === 'string');
  const augur = listed
    .map((r) => ({ release: r, version: AUGUR_TAG.exec(r.tag_name)?.[1] }))
    .filter((x) => x.version && semver.valid(x.version))
    .sort((a, b) => semver.rcompare(a.version, b.version))
    .slice(0, AUGUR_RELEASES_KEPT);
  const apps = listed
    .map((r) => ({ release: r, m: APP_TAG.exec(r.tag_name) }))
    .filter((x) => x.m && semver.valid(x.m[2]))
    .map(({ release, m }) => ({ release, app: m[1], version: m[2], pr: PREVIEW.exec(m[2])?.[1] }))
    .sort((a, b) => semver.rcompare(a.version, b.version));
  const kept = new Map();
  const appsChosen = [];
  let previews = 0;
  for (const a of apps) {
    const key = a.pr ? `${a.app}#${a.pr}` : a.app;
    const count = kept.get(key) ?? 0;
    if (count >= (a.pr ? 1 : APP_RELEASES_KEPT) || (a.pr && previews >= PREVIEWS_KEPT)) continue;
    kept.set(key, count + 1);
    if (a.pr) previews++;
    appsChosen.push(a);
  }
  return { augur, apps: appsChosen };
};

/** An app's release file as the feed holds it: its channel as GitHub has it now (previews stay previews by version). */
export const asListed = (file, release) => ({
  ...file,
  channel: release.prerelease ? 'beta' : 'stable',
  ...(file.releasedAt || !release.published_at ? {} : { releasedAt: release.published_at }),
});

/** Builds the feed from the repository's releases, reading each chosen release's file with `download`. */
export const buildFeed = async (releases, download) => {
  const { augur, apps } = chooseReleases(releases);
  const fileOf = async (release, name) => {
    const asset = release.assets?.find((a) => a.name === name);
    return asset ? download(asset.url).catch(() => undefined) : undefined;
  };
  const augurFiles = await Promise.all(augur.map(async ({ release, version }) => ({ version, file: await fileOf(release, 'augur-release.json'), release })));
  const appFiles = await Promise.all(apps.map(async ({ release, app, version }) => ({ app, version, file: await fileOf(release, 'app-release.json'), release })));
  return {
    schema: 'augur.feed/v1',
    releases: augurFiles.filter((x) => x.file?.version === x.version).map((x) => asMirrored(x.file, x.release)),
    apps: appFiles.filter((x) => x.file?.id === x.app && x.file?.version === x.version).map((x) => asListed(x.file, x.release)),
  };
};

const github = async (path, accept = 'application/vnd.github+json') => {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const res = await fetch(path.startsWith('https:') ? path : `https://api.github.com/repos/${REPO}${path}`, {
    headers: { accept, 'user-agent': 'augur-feed', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}.`);
  return res.json();
};

const main = async (args) => {
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'feed.json';
  const releases = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await github(`/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const feed = await buildFeed(releases, (url) => github(url, 'application/octet-stream'));
  writeFileSync(out, `${JSON.stringify(feed, null, 2)}\n`);
  console.log(`${out}: ${feed.releases.length} AUGUR releases, ${feed.apps.length} app releases.`);
  if (args.includes('--push')) {
    const ref = `ghcr.io/${REPO.toLowerCase()}/feed:latest`;
    execFileSync(
      'oras',
      ['push', ref, '--artifact-type', FEED_MEDIA_TYPE, '--annotation', `org.opencontainers.image.source=https://github.com/${REPO}`, `${out}:${FEED_MEDIA_TYPE}`],
      { stdio: 'inherit' },
    );
    console.log(`Pushed ${ref}.`);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
