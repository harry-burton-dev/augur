// The pipeline feed: where each unit is on its way from dev to production, for Backstage (every unit,
// every deployment) and each deployment's Upgrade Centre (this server's place on the line). It sits
// beside the release feed on GitHub's container registry, read with the same read key:
//   node scripts/pipeline.mjs [--out pipeline.json] [--push]
//      in the Pipeline workflow, in a checkout with origin/dev, preview and production fetched: writes the feed,
//      and with --push pushes it as ghcr.io/<repo>/feed:pipeline
// It holds each unit's version on each branch, its newest dev build and pull requests' previews, the
// changesets waiting on dev, the pull requests merged between each branch and the next, and the open
// Version packages and Promote pull requests. It only describes: nothing reads it to decide anything.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import semver from 'semver';
import { readApps } from './app-release.mjs';
import { parseChangeset, readParts } from './augur-release.mjs';
import { AUGUR, promotionOf, versionsFrom } from './promote.mjs';

const root = new URL('..', import.meta.url).pathname;
const REPO = process.env.GITHUB_REPOSITORY ?? 'harry-burton-dev/im-platform';
/** The pipeline's media type in the registry. */
export const PIPELINE_MEDIA_TYPE = 'application/vnd.augur.pipeline.v1+json';
/** The branches, in the order code goes through them (docs/release-channels.md). */
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

/** The pull requests merged into a branch since the next, from `git log --first-parent`'s merge commits. */
export const mergesFrom = (log) =>
  log
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject, body, at] = entry.split('\x1f');
      const m = /^Merge pull request #(\d+) from (\S+)/.exec(subject ?? '');
      if (!m) return undefined;
      const title = (body ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? m[2];
      return { number: Number(m[1]), title, mergedAt: at?.trim() };
    })
    .filter(Boolean);

/** The open pull requests the line waits on: Version packages, Promote to preview, and each Promote to production. */
export const releasePulls = (pulls) => {
  const out = { promoteToProduction: [] };
  for (const p of pulls) {
    const pull = { number: p.number, title: p.title, url: p.url };
    if (p.baseRefName === 'dev' && p.headRefName.startsWith('changeset-release/')) out.versionPackages = pull;
    else if (p.baseRefName === 'preview' && p.headRefName === 'dev') out.promoteToPreview = pull;
    else if (p.baseRefName === 'production' && promotionOf(p.headRefName)) out.promoteToProduction.push({ ...pull, ...promotionOf(p.headRefName) });
  }
  return out;
};

/**
 * The pipeline feed, from what the Pipeline workflow read. Pure, so its tests and Backstage agree on it.
 * `versions` is each branch's units' versions, `merges` the pull requests on each branch that the next
 * hasn't got, `releases` GitHub's releases by tag.
 */
export const buildPipeline = ({ generatedAt, repository = REPO, heads, versions, names = {}, changesets = [], merges = {}, pulls = [], releases = [] }) => {
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
    pulls: releasePulls(pulls),
  };
};

const main = (args) => {
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'pipeline.json';
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  const gh = (...a) => JSON.parse(execFileSync('gh', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const apps = readApps();
  const appIds = apps.map((a) => a.id);
  const ref = (b) => `origin/${b}`;
  const read = (b) => (path) => {
    try {
      return git('show', `${ref(b)}:${path}`);
    } catch {
      return undefined;
    }
  };
  const heads = Object.fromEntries(BRANCHES.map((b) => [b, { sha: git('rev-parse', ref(b)), committedAt: git('log', '-1', '--format=%cI', ref(b)) }]));
  const versions = Object.fromEntries(BRANCHES.map((b) => [b, versionsFrom(read(b), appIds)]));
  const appPackages = Object.fromEntries(apps.flatMap((a) => [a.service, a.frontend].filter(Boolean).map((p) => [p.name, a.id])));
  const augurParts = Object.keys(readParts());
  // The changesets waiting are dev's, whichever commit this checkout is.
  const changesets = git('ls-tree', '--name-only', `${ref('dev')}:.changeset`)
    .split('\n')
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => ({ id: f.slice(0, -'.md'.length), ...parseChangeset(read('dev')(`.changeset/${f}`) ?? '') }))
    .filter((c) => c.bumps)
    .map((c) => ({ ...c, units: unitsOf(c.bumps, augurParts, appPackages) }));
  const merges = Object.fromEntries(
    BRANCHES.slice(0, -1).map((from, i) => [from, mergesFrom(git('log', '--first-parent', '--format=%s%x1f%b%x1f%cI%x1e', `${ref(BRANCHES[i + 1])}..${ref(from)}`))]),
  );
  const pulls = gh('pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,url,headRefName,baseRefName');
  const releases = gh('release', 'list', '--limit', '300', '--json', 'tagName,isPrerelease,publishedAt');
  const names = { [AUGUR]: 'AUGUR', ...Object.fromEntries(apps.map((a) => [a.id, a.manifest.name ?? a.id])) };
  const pipeline = buildPipeline({ generatedAt: new Date().toISOString(), heads, versions, names, changesets, merges, pulls, releases });
  writeFileSync(out, `${JSON.stringify(pipeline, null, 2)}\n`);
  console.log(`${out}: ${pipeline.units.length} units, ${pipeline.changesets.length} changesets waiting, ${pipeline.steps.map((s) => `${s.merged} ${s.from}→${s.to}`).join(', ')}.`);
  if (args.includes('--push')) {
    const target = `ghcr.io/${REPO.toLowerCase()}/feed:pipeline`;
    execFileSync('oras', ['push', target, '--artifact-type', PIPELINE_MEDIA_TYPE, '--annotation', `org.opencontainers.image.source=https://github.com/${REPO}`, `${basename(out)}:${PIPELINE_MEDIA_TYPE}`], {
      stdio: 'inherit',
      cwd: dirname(resolve(out)),
    });
    console.log(`Pushed ${target}.`);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
