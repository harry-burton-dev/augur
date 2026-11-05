// The pipeline feed: where each unit is on its way from main to stable, for Backstage (every unit, every
// deployment) and each deployment's Upgrade Centre (this server's place on the line). It sits beside the
// release feed on GitHub's container registry, read with the same read key:
//   node scripts/pipeline.mjs [--out pipeline.json] [--push]
//      in the Pipeline workflow, in a full checkout with the release tags: writes the feed, and with
//      --push pushes it as ghcr.io/<repo>/feed:pipeline
// Its three stages are the rings deployments sit on (docs/release-channels.md): dev is main, which the
// workbench takes dev builds of; preview is each unit's newest release, beta or stable; production is its
// newest stable release. It holds each unit's version at each stage, its newest dev build and pull
// requests' previews, the changesets waiting on main, the pull requests merged between each stage and
// the next, and the open Version packages pull request. It only describes: nothing reads it to decide anything.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import semver from 'semver';
import { readApps } from './app-release.mjs';
import { parseChangeset, readParts } from './augur-release.mjs';
import { AUGUR, tagOf, versionsFrom } from './promote.mjs';
import { REPO } from './repo.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
/** Where the images, and so the feed, are: IMAGE_REPO, or the repository's own path. */
const IMAGES = (process.env.IMAGE_REPO || `ghcr.io/${REPO}`).toLowerCase();
/** The pipeline's media type in the registry. */
export const PIPELINE_MEDIA_TYPE = 'application/vnd.augur.pipeline.v1+json';
/** The stages, in the order code goes through them (docs/release-channels.md). The feed's v1 calls them branches. */
export const BRANCHES = ['dev', 'preview', 'production'];
/** How many merged pull requests each step lists; the count says how many there are. */
export const MERGES_LISTED = 30;

const DEV = /-dev\.\d+$/;
const PREVIEW = /-pr\.(\d+)\.\d+$/;
const TAG = /^(?:augur|app\/([a-z][a-z0-9-]{1,39}))@(.+)$/;

/** The unit a release tag is of, and its version, or undefined. */
export const releaseOf = (tag) => {
  const m = TAG.exec(tag);
  return m && semver.valid(m[2]) ? { unit: m[1] ?? AUGUR, version: m[2] } : undefined;
};

/** The units a changeset moves: AUGUR for any of its parts, an app for its own packages. */
export const unitsOf = (bumps, augurParts, appPackages) => [...new Set(Object.keys(bumps).map((name) => (augurParts.includes(name) ? AUGUR : appPackages[name])).filter(Boolean))].sort();

/**
 * The pull requests merged between two commits, from `git log --first-parent`: a squash merge's
 * "Title (#12)" or a merge commit's "Merge pull request #12 from …", whose title is its body's first line.
 */
export const mergesFrom = (log) =>
  log
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject = '', body, at] = entry.split('\x1f');
      const merge = /^Merge pull request #(\d+) from (\S+)/.exec(subject);
      if (merge) {
        const title = (body ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? merge[2];
        return { number: Number(merge[1]), title, mergedAt: at?.trim() };
      }
      const squash = /^(.+) \(#(\d+)\)$/.exec(subject.trim());
      return squash ? { number: Number(squash[2]), title: squash[1], mergedAt: at?.trim() } : undefined;
    })
    .filter(Boolean);

/** The open pull requests the line waits on: the Version packages pull request into the trunk. */
export const releasePulls = (pulls, trunk = 'main') => {
  const out = { promoteToProduction: [] };
  for (const p of pulls) {
    if (p.baseRefName === trunk && p.headRefName.startsWith('changeset-release/')) out.versionPackages = { number: p.number, title: p.title, url: p.url };
  }
  return out;
};

/**
 * Each unit's version at the preview and production stages, from GitHub's releases: its newest release
 * (beta or stable) and its newest stable one. Dev builds and pull requests' previews are neither.
 */
export const stagesFrom = (releases) => {
  const preview = {};
  const production = {};
  const newer = (a, b) => !a || semver.gt(b, a);
  for (const r of releases) {
    const of = releaseOf(r.tagName);
    if (!of || DEV.test(of.version) || PREVIEW.test(of.version)) continue;
    if (newer(preview[of.unit], of.version)) preview[of.unit] = of.version;
    if (!r.isPrerelease && newer(production[of.unit], of.version)) production[of.unit] = of.version;
  }
  return { preview, production };
};

/**
 * The pipeline feed, from what the Pipeline workflow read. Pure, so its tests and Backstage agree on it.
 * `versions` is each stage's units' versions, `merges` the pull requests at each stage that the next
 * hasn't got, `releases` GitHub's releases by tag, `pulls` the open pull requests (or what
 * releasePulls made of them).
 */
export const buildPipeline = ({ generatedAt, repository = REPO, heads, versions, names = {}, changesets = [], merges = {}, pulls = [], releases = [], trunk = 'main' }) => {
  const units = [...new Set(BRANCHES.flatMap((b) => Object.keys(versions[b] ?? {})))].sort((a, b) => (a === AUGUR ? -1 : b === AUGUR ? 1 : a.localeCompare(b)));
  const listed = releases.map((r) => ({ ...r, ...releaseOf(r.tagName) })).filter((r) => r.unit);
  return {
    schema: 'augur.pipeline/v1',
    generatedAt,
    repository,
    branches: BRANCHES.map((name) => ({ name, ...(heads[name] ?? {}) })),
    units: units.map((id) => {
      const devBuild = listed.filter((r) => r.unit === id && DEV.test(r.version)).sort((a, b) => semver.rcompare(a.version, b.version))[0];
      const previews = new Map();
      for (const r of listed.filter((x) => x.unit === id && PREVIEW.test(x.version)).sort((a, b) => semver.rcompare(a.version, b.version))) {
        const pr = Number(PREVIEW.exec(r.version)[1]);
        if (!previews.has(pr)) previews.set(pr, { pr, version: r.version });
      }
      return {
        id,
        name: names[id] ?? id,
        versions: Object.fromEntries(BRANCHES.map((b) => [b, versions[b]?.[id] ?? null])),
        ...(devBuild ? { devBuild: { version: devBuild.version, ...(devBuild.publishedAt ? { released: devBuild.publishedAt } : {}) } } : {}),
        waiting: changesets.filter((c) => c.units.includes(id)).map((c) => c.id),
        previews: [...previews.values()],
      };
    }),
    changesets: changesets.map(({ id, summary, units: of, bumps }) => ({ id, summary: summary.split('\n')[0], units: of, bumps })),
    steps: BRANCHES.slice(0, -1).map((from, i) => {
      const list = merges[from] ?? [];
      return { from, to: BRANCHES[i + 1], merged: list.length, pulls: list.slice(0, MERGES_LISTED) };
    }),
    pulls: Array.isArray(pulls) ? releasePulls(pulls, trunk) : pulls,
  };
};

const main = (args) => {
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'pipeline.json';
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  const gh = (...a) => JSON.parse(execFileSync('gh', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const has = (ref) => {
    try {
      git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
      return true;
    } catch {
      return false;
    }
  };
  const trunk = process.env.TRUNK || 'main';
  const apps = readApps();
  const appIds = apps.map((a) => a.id);
  const read = (ref) => (path) => {
    try {
      return git('show', `${ref}:${path}`);
    } catch {
      return undefined;
    }
  };
  // The newest few hundred releases are mostly dev builds and previews, so the stable ones are read apart.
  const seen = new Set();
  const releases = [
    ...gh('release', 'list', '--limit', '300', '--json', 'tagName,isPrerelease,publishedAt'),
    ...gh('release', 'list', '--exclude-pre-releases', '--limit', '100', '--json', 'tagName,isPrerelease,publishedAt'),
  ].filter((r) => !seen.has(r.tagName) && seen.add(r.tagName));
  const stages = stagesFrom(releases);
  // Each stage's commit: the trunk's head, and AUGUR's release at each of the other two.
  const refs = {
    dev: `origin/${trunk}`,
    preview: stages.preview[AUGUR] && tagOf(AUGUR, stages.preview[AUGUR]),
    production: stages.production[AUGUR] && tagOf(AUGUR, stages.production[AUGUR]),
  };
  const heads = Object.fromEntries(BRANCHES.filter((b) => refs[b] && has(refs[b])).map((b) => [b, { sha: git('rev-parse', `${refs[b]}^{commit}`), committedAt: git('log', '-1', '--format=%cI', refs[b]) }]));
  const versions = { dev: versionsFrom(read(refs.dev), appIds), preview: stages.preview, production: stages.production };
  const appPackages = Object.fromEntries(apps.flatMap((a) => [a.service, a.frontend].filter(Boolean).map((p) => [p.name, a.id])));
  const augurParts = Object.keys(readParts());
  // The changesets waiting are the trunk's, whichever commit this checkout is.
  const changesets = git('ls-tree', '--name-only', `${refs.dev}:.changeset`)
    .split('\n')
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => ({ id: f.slice(0, -'.md'.length), ...parseChangeset(read(refs.dev)(`.changeset/${f}`) ?? '') }))
    .filter((c) => c.bumps)
    .map((c) => ({ ...c, units: unitsOf(c.bumps, augurParts, appPackages) }));
  const merges = Object.fromEntries(
    BRANCHES.slice(0, -1).map((from, i) => {
      const to = refs[BRANCHES[i + 1]];
      return [from, heads[from] && to && has(to) ? mergesFrom(git('log', '--first-parent', '--format=%s%x1f%b%x1f%cI%x1e', `${to}..${refs[from]}`)) : []];
    }),
  );
  const pulls = releasePulls(gh('pr', 'list', '--state', 'open', '--base', trunk, '--limit', '100', '--json', 'number,title,url,headRefName,baseRefName'), trunk);
  const names = { [AUGUR]: 'AUGUR', ...Object.fromEntries(apps.map((a) => [a.id, a.manifest.name ?? a.id])) };
  const pipeline = buildPipeline({ generatedAt: new Date().toISOString(), heads, versions, names, changesets, merges, pulls, releases, trunk });
  writeFileSync(out, `${JSON.stringify(pipeline, null, 2)}\n`);
  console.log(`${out}: ${pipeline.units.length} units, ${pipeline.changesets.length} changesets waiting, ${pipeline.steps.map((s) => `${s.merged} ${s.from}→${s.to}`).join(', ')}.`);
  if (args.includes('--push')) {
    const target = `${IMAGES}/feed:pipeline`;
    execFileSync('oras', ['push', target, '--artifact-type', PIPELINE_MEDIA_TYPE, '--annotation', `org.opencontainers.image.source=https://github.com/${REPO}`, `${basename(out)}:${PIPELINE_MEDIA_TYPE}`], {
      stdio: 'inherit',
      cwd: dirname(resolve(out)),
    });
    console.log(`Pushed ${target}.`);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
