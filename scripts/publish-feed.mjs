// The release feed deployments read with their read key: AUGUR's releases and apps' releases as one file,
// pushed to GitHub's container registry beside the images, as ghcr.io/<repo>/feed:latest. A deployment
// can then check for releases with the same read:packages token it pulls images with (docs/upgrade.md,
// "The read key"), where reading GitHub's releases themselves would need a second token.
//   node scripts/publish-feed.mjs [--out <file>] [--sign] [--push]
//     --out   where to write the feed (default: feed.json)
//     --sign  sign it with cosign keyless, writing <file>.sigstore.json beside it (ADR 0017)
//     --push  push it with ORAS (signed in to ghcr.io) as ghcr.io/<repo>/feed:latest, with its signature
// The feed says when it was issued and when it expires: a deployment refuses one that has expired, so a
// feed someone keeps from it can't hide a newer release for long. The Release feed workflow runs weekly
// as well, to issue it again. A release with a halted.json asset (the Halt rollout workflow) is listed
// with `halted`, and no deployment is offered it.
// The Release workflow runs it after every release, and again whenever a release is edited, so a
// release promoted to stable on GitHub (pre-release unticked) is stable in the feed too.
// Apps that live in their own repositories (release/app-repos.json, ADR 0047) are listed too: each
// repository's releases of its own app, and nothing else from it.
// Needs GITHUB_TOKEN (or GH_TOKEN) that can read the repository's releases, and APP_RELEASES_TOKEN that
// can read the app repositories' releases once release/app-repos.json lists any.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import semver from 'semver';
import { asMirrored } from './mirror-release.mjs';

const REPO = process.env.AUGUR_REPO ?? process.env.GITHUB_REPOSITORY ?? 'harry-burton-dev/im-platform';
/** Where the images, and so the feed, are: IMAGE_REPO, or the repository's own path. */
const IMAGES = (process.env.IMAGE_REPO || `ghcr.io/${REPO}`).toLowerCase();
/** The feed's media type in the registry. */
export const FEED_MEDIA_TYPE = 'application/vnd.augur.feed.v1+json';
/** How many of AUGUR's newest releases the feed holds: the registry reads at most ten newer than the running one. */
export const AUGUR_RELEASES_KEPT = 20;
/** How many of each app's newest releases (stable or beta) it holds. */
export const APP_RELEASES_KEPT = 4;
/** How many pull requests' previews it holds, each pull request's newest build only. */
export const PREVIEWS_KEPT = 20;
/** How many of AUGUR's, and each app's, newest dev builds it holds, apart from their releases. */
export const DEV_BUILDS_KEPT = 2;

/** How long a feed is good for. The Release feed workflow issues it again weekly, so there's a week to spare. */
export const FEED_VALID_DAYS = 14;
/** The asset the Halt rollout workflow puts on a release it halts. */
export const HALTED_ASSET = 'halted.json';
/** The cosign bundle written beside the feed, and pushed with it. */
export const BUNDLE_SUFFIX = '.sigstore.json';
export const BUNDLE_MEDIA_TYPE = 'application/vnd.dev.sigstore.bundle.v0.3+json';

const AUGUR_TAG = /^augur@(.+)$/;
const APP_TAG = /^app\/([a-z][a-z0-9-]{1,39})@(.+)$/;
const PREVIEW = /-pr\.(\d+)\.\d+$/;
const DEV = /-dev\.\d+$/;

/**
 * Which releases go in the feed, newest first: AUGUR's newest few and its newest dev builds, each app's newest few, and each pull
 * request's newest preview build (the app runner runs those for the app's developers), and each app's
 * newest dev builds, which don't push its releases out.
 */
export const chooseReleases = (releases) => {
  const listed = releases.filter((r) => !r.draft && typeof r.tag_name === 'string');
  const augurAll = listed
    .map((r) => ({ release: r, version: AUGUR_TAG.exec(r.tag_name)?.[1] }))
    .filter((x) => x.version && semver.valid(x.version))
    .sort((a, b) => semver.rcompare(a.version, b.version));
  // AUGUR's dev builds, for the workbench, don't push its releases out either.
  const augur = [...augurAll.filter((x) => !DEV.test(x.version)).slice(0, AUGUR_RELEASES_KEPT), ...augurAll.filter((x) => DEV.test(x.version)).slice(0, DEV_BUILDS_KEPT)].sort((a, b) => semver.rcompare(a.version, b.version));
  const apps = listed
    .map((r) => ({ release: r, m: APP_TAG.exec(r.tag_name) }))
    .filter((x) => x.m && semver.valid(x.m[2]))
    .map(({ release, m }) => ({ release, app: m[1], version: m[2], pr: PREVIEW.exec(m[2])?.[1], dev: DEV.test(m[2]) }))
    .sort((a, b) => semver.rcompare(a.version, b.version));
  const kept = new Map();
  const appsChosen = [];
  let previews = 0;
  for (const a of apps) {
    const key = a.pr ? `${a.app}#${a.pr}` : a.dev ? `${a.app}~dev` : a.app;
    const count = kept.get(key) ?? 0;
    if (count >= (a.pr ? 1 : a.dev ? DEV_BUILDS_KEPT : APP_RELEASES_KEPT) || (a.pr && previews >= PREVIEWS_KEPT)) continue;
    kept.set(key, count + 1);
    if (a.pr) previews++;
    appsChosen.push(a);
  }
  return { augur, apps: appsChosen };
};

/** An app's release file as the feed holds it: its channel as GitHub has it now (previews stay previews by version, dev builds dev). */
export const asListed = (file, release) => ({
  ...file,
  channel: DEV.test(file.version) ? 'dev' : release.prerelease ? 'beta' : 'stable',
  ...(file.releasedAt || !release.published_at ? {} : { releasedAt: release.published_at }),
});

/** A release's halted.json as the feed carries it: why and when, or undefined when it isn't halted. */
export const haltedOf = (record) =>
  record && typeof record.reason === 'string' && record.reason.trim() ? { reason: record.reason.trim(), at: typeof record.at === 'string' ? record.at : undefined, ...(record.by ? { by: record.by } : {}) } : undefined;

/** Builds the feed from the repository's releases, reading each chosen release's file with `download`. */
export const buildFeed = async (releases, download, now = new Date(), own = {}) => {
  const { augur, apps } = chooseReleases(releases);
  const fileOf = async (release, name) => {
    const asset = release.assets?.find((a) => a.name === name);
    return asset ? download(asset.url).catch(() => undefined) : undefined;
  };
  const withHalt = async (entry, release) => {
    const halted = haltedOf(await fileOf(release, HALTED_ASSET));
    return halted ? { ...entry, halted } : entry;
  };
  const augurFiles = await Promise.all(augur.map(async ({ release, version }) => ({ version, file: await fileOf(release, 'augur-release.json'), release })));
  const appFiles = await Promise.all(apps.map(async ({ release, app, version }) => ({ app, version, file: await fileOf(release, 'app-release.json'), release })));
  return {
    schema: 'augur.feed/v1',
    issued: now.toISOString(),
    expires: new Date(now.getTime() + FEED_VALID_DAYS * 86_400_000).toISOString(),
    releases: await Promise.all(augurFiles.filter((x) => x.file?.version === x.version).map((x) => withHalt(asMirrored(x.file, x.release), x.release))),
    apps: await Promise.all(
      appFiles
        .filter((x) => x.file?.id === x.app && x.file?.version === x.version)
        // An app in its own repository is listed only as signed there (ADR 0047).
        .filter((x) => !own[x.app] || (x.release.repository === own[x.app] && x.file.signer?.repository === own[x.app]))
        .map((x) => withHalt(asListed(x.file, x.release), x.release)),
    ),
  };
};

/**
 * The releases an app's own repository may put in the feed: its app's `app/<id>@…` releases, marked with
 * where they came from; buildFeed keeps only those signed in that repository, so none speaks for another app.
 */
export const ownReleases = (releases, app, repository) =>
  releases.filter((r) => APP_TAG.exec(r.tag_name ?? '')?.[1] === app).map((r) => ({ ...r, repository }));

/** release/app-repos.json's apps, as app id → owner/repo. */
export const appRepos = (json) =>
  Object.fromEntries(Object.entries(json?.apps ?? {}).filter(([id, repo]) => /^[a-z][a-z0-9-]{1,39}$/.test(id) && /^[\w.-]+\/[\w.-]+$/.test(String(repo))));

const github = async (path, accept = 'application/vnd.github+json', token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN) => {
  const res = await fetch(path.startsWith('https:') ? path : `https://api.github.com/repos/${REPO}${path}`, {
    headers: { accept, 'user-agent': 'augur-feed', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}.`);
  return res.json();
};

const main = async (args) => {
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'feed.json';
  const releasesOf = async (repo, token) => {
    const all = [];
    for (let page = 1; page <= 5; page++) {
      const batch = await github(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, undefined, token);
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  };
  const releases = await releasesOf(REPO);
  const own = appRepos(JSON.parse(readFileSync(new URL('../release/app-repos.json', import.meta.url), 'utf8')));
  // Trimmed: a secret pasted through a shell can carry a line ending, which breaks the header.
  const appToken = process.env.APP_RELEASES_TOKEN?.trim();
  if (Object.keys(own).length && !appToken) throw new Error('release/app-repos.json lists apps in their own repositories, but APP_RELEASES_TOKEN isn’t set to read their releases (docs/ship-an-app.md, "An app in its own repository").');
  // An app that moved out is listed from its own repository only; its older releases here are left out.
  const here = releases.filter((r) => !(APP_TAG.exec(r.tag_name ?? '')?.[1] in own));
  for (const [app, repo] of Object.entries(own)) here.push(...ownReleases(await releasesOf(repo, appToken), app, repo));
  const feed = await buildFeed(here, (url) => github(url, 'application/octet-stream', url.includes(`/repos/${REPO}/`) ? undefined : appToken), new Date(), own);
  writeFileSync(out, `${JSON.stringify(feed, null, 2)}\n`);
  const halted = [...feed.releases, ...feed.apps].filter((r) => r.halted).length;
  console.log(`${out}: ${feed.releases.length} AUGUR releases, ${feed.apps.length} app releases${halted ? `, ${halted} halted` : ''}; expires ${feed.expires}.`);
  const bundle = `${out}${BUNDLE_SUFFIX}`;
  if (args.includes('--sign')) {
    // Keyless, as this workflow: deployments check the feed came from the Release feed workflow (ADR 0017).
    execFileSync('cosign', ['sign-blob', '--yes', '--bundle', bundle, out], { stdio: 'inherit' });
  }
  if (args.includes('--push')) {
    const ref = `${IMAGES}/feed:latest`;
    const files = [`${basename(out)}:${FEED_MEDIA_TYPE}`, ...(args.includes('--sign') ? [`${basename(bundle)}:${BUNDLE_MEDIA_TYPE}`] : [])];
    // ORAS takes a file by its path relative to where it runs, which also names the layer.
    execFileSync(
      'oras',
      ['push', ref, '--artifact-type', FEED_MEDIA_TYPE, '--annotation', `org.opencontainers.image.source=https://github.com/${REPO}`, ...files],
      { stdio: 'inherit', cwd: dirname(resolve(out)) },
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
