// Release channels (docs/release-channels.md): work merges into dev, dev is promoted to preview, and
// preview is promoted to production one unit at a time. A unit is AUGUR (the platform, its services and
// the pillar apps, as one release) or one app the app runner installs.
//   node scripts/promote.mjs check-pr               in CI on a pull request (BASE_REF, HEAD_REF): may it go into its base?
//   node scripts/promote.mjs preview-pr             in the Release workflow on dev: opens or refreshes "Promote to preview"
//   node scripts/promote.mjs promote <unit> [<v>]   from the Promote workflow: opens "Promote <unit> <v> to production",
//                                                   a branch from production with only that unit's files from preview
//   node scripts/promote.mjs production             in the Release workflow on production: marks each promoted
//                                                   release as on production, and after a hotfix opens back-merges
//   node scripts/promote.mjs versions [<ref>]       prints each unit's version at a ref (default HEAD)
// Releases are built once, on preview, as GitHub pre-releases; production takes the same release, so it
// runs what preview ran. Only a version production doesn't have a release of (a hotfix) is built there.
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readApps } from './app-release.mjs';
import { PILLAR_APPS } from './augur-release.mjs';

const root = new URL('..', import.meta.url).pathname;
const REPO = process.env.GITHUB_REPOSITORY ?? 'harry-burton-dev/im-platform';
export const AUGUR = 'augur';

/** The unit a file belongs to: an app's own folder is the app's, everything else is AUGUR's. */
export const unitOf = (path, appIds) => {
  const m = /^apps\/([^/]+)\//.exec(path);
  return m && appIds.includes(m[1]) ? m[1] : AUGUR;
};

/** The files of `unit` among `paths`. */
export const pathsOf = (unit, paths, appIds) => paths.filter((p) => unitOf(p, appIds) === unit);

/** The branch a promotion is made on: promote/<unit>-<version>. */
export const promoteBranch = (unit, version) => `promote/${unit}-${version}`;
const PROMOTE = /^promote\/([a-z][a-z0-9-]*?)-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
/** The unit and version a promotion branch names, or undefined. */
export const promotionOf = (branch) => {
  const m = PROMOTE.exec(branch ?? '');
  return m ? { unit: m[1], version: m[2] } : undefined;
};

/**
 * Why a pull request may not go into its base, or nothing. `files` are the paths it changes, `pending`
 * the changesets it carries that no Version packages run has spent.
 */
export const prProblems = ({ base, head, files = [], pending = [], appIds = [] }) => {
  const problems = [];
  const versioned = () => {
    if (pending.length) problems.push(`It carries changesets that haven't been versioned yet (${pending.join(', ')}). Only versioned code goes into ${base}: from dev, merge the Version packages pull request first; on a hotfix branch, run \`pnpm version-packages\` and commit.`);
  };
  if (base === 'preview') {
    if (!(head === 'dev' || head === 'production' || head.startsWith('hotfix/'))) problems.push(`Only dev, production (a back-merge) or a hotfix/* branch go into preview, not ${head}. Merge into dev, and Promote to preview takes it on.`);
    versioned();
  } else if (base === 'production') {
    const promotion = promotionOf(head);
    if (!promotion && !head.startsWith('hotfix/')) problems.push(`Only a promote/* branch (made by the Promote workflow) or a hotfix/* branch go into production, not ${head}.`);
    if (promotion) {
      const others = files.filter((p) => unitOf(p, appIds) !== promotion.unit && p !== 'pnpm-lock.yaml');
      if (others.length) problems.push(`Promoting ${promotion.unit} may only change its own files, but it changes ${others.slice(0, 5).join(', ')}${others.length > 5 ? ` and ${others.length - 5} more` : ''}.`);
    }
    versioned();
  }
  return problems;
};

/** Each unit's version: AUGUR's from its release file, each app's from its manifest. */
export const versionsFrom = (read, appIds) => {
  const json = (path) => {
    const text = read(path);
    return text === undefined ? undefined : JSON.parse(text);
  };
  const versions = { [AUGUR]: json('release/augur-release.json')?.version };
  for (const id of appIds) versions[id] = json(`apps/${id}/manifest.json`)?.version;
  return versions;
};

/** The units whose version is different at `to` than at `from`, with both versions. */
export const moved = (from, to) =>
  Object.keys(to)
    .filter((unit) => to[unit] && to[unit] !== '0.0.0' && to[unit] !== from[unit])
    .map((unit) => ({ unit, from: from[unit], to: to[unit] }));

/** The tag a unit's release has. */
export const tagOf = (unit, version) => (unit === AUGUR ? `augur@${version}` : `app/${unit}@${version}`);

/** The body of the Promote to preview pull request. */
export const previewBody = (units, names = {}) =>
  [
    'Merging this promotes `dev` to `preview`: the Release workflow on preview builds, signs and releases each unit below as a pre-release, and preview servers take them by their policy. Production servers see none of it until a unit is promoted to production (docs/release-channels.md).',
    '',
    '| Unit | On preview | After this |',
    '| --- | --- | --- |',
    ...units.map((u) => `| ${names[u.unit] ?? u.unit} | ${u.from ?? 'new'} | ${u.to} |`),
    '',
    'Changelogs: each unit\'s `CHANGELOG.md` files on dev, gathered in each release\'s notes.',
    '',
    '_Kept up to date by the Release workflow on dev._',
  ].join('\n');

/** The body of a Promote <unit> to production pull request. */
export const productionBody = ({ unit, name, version, from, releaseUrl, files }) =>
  [
    `Merging this promotes ${name} ${version} to production. Production takes the release preview ran, [${tagOf(unit, version)}](${releaseUrl}), with no rebuild: the Release workflow on production marks it as on production, and production servers see it at their next check.`,
    '',
    `- On production now: ${from ?? 'not yet released'}`,
    `- Files from preview: ${files} (this unit's only, and \`pnpm-lock.yaml\` made again for production)`,
    '',
    'Only the repository\'s owner merges this. CI checks the unit against production\'s AUGUR: its SDK range, the contract tests and the migrations lock.',
  ].join('\n');

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const gh = (...args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8' }).trim();
const tryOr = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
const readAt = (ref) => (path) => tryOr(() => git('show', `${ref}:${path}`), undefined);
/** The apps released on their own at a ref: folders under apps/ with a manifest, but the pillar apps. */
const appIdsAt = (ref) =>
  tryOr(() => git('ls-tree', '--name-only', `${ref}:apps`), '')
    .split('\n')
    .filter((id) => id && !PILLAR_APPS.includes(id) && readAt(ref)(`apps/${id}/manifest.json`) !== undefined);
const appIdsNow = (...refs) => [...new Set([...readApps().map((a) => a.id), ...refs.flatMap(appIdsAt)])];
/** An app's name in its manifest at a ref. */
const nameAt = (ref, unit) => (unit === AUGUR ? 'AUGUR' : tryOr(() => JSON.parse(readAt(ref)(`apps/${unit}/manifest.json`)).name, unit));
const releaseOf = (tag) => tryOr(() => JSON.parse(gh('release', 'view', tag, '--json', 'tagName,isPrerelease,url,assets')), undefined);
/** The pull request a merge commit came from, if any. */
const mergedPrOf = (sha) => {
  const listed = tryOr(() => JSON.parse(gh('api', `repos/${REPO}/commits/${sha}/pulls`)).find((p) => p.merged_at), undefined);
  // The list leaves out who merged it.
  return listed && tryOr(() => JSON.parse(gh('api', `repos/${REPO}/pulls/${listed.number}`)), undefined);
};

const main = () => {
  const [mode, ...args] = process.argv.slice(2);
  let appIds = appIdsNow();

  if (mode === 'versions') {
    console.log(JSON.stringify(versionsFrom(readAt(args[0] ?? 'HEAD'), appIds), null, 2));
  } else if (mode === 'check-pr') {
    const base = process.env.BASE_REF ?? '';
    const head = process.env.HEAD_REF ?? '';
    const files = git('diff', '--name-only', `origin/${base}...HEAD`).split('\n').filter(Boolean);
    const pending = files.filter((f) => /^\.changeset\/[^/]+\.md$/.test(f) && !f.endsWith('README.md') && readAt('HEAD')(f) !== undefined);
    const problems = prProblems({ base, head, files, pending, appIds });
    if (problems.length) {
      for (const p of problems) console.error(`✗ ${p}`);
      process.exit(1);
    }
    console.log(`✓ ${head} may go into ${base}.`);
  } else if (mode === 'preview-pr') {
    if (!tryOr(() => git('fetch', 'origin', 'preview', 'dev') !== undefined, false)) return console.log('There is no preview branch yet to promote to (docs/release-channels.md).');
    appIds = appIdsNow('origin/dev', 'origin/preview');
    const units = moved(versionsFrom(readAt('origin/preview'), appIds), versionsFrom(readAt('origin/dev'), appIds));
    const open = JSON.parse(gh('pr', 'list', '--base', 'preview', '--head', 'dev', '--state', 'open', '--json', 'number'))[0];
    if (!units.length) return console.log('Nothing on dev has a version preview doesn’t have.');
    const names = Object.fromEntries(units.map((u) => [u.unit, nameAt('origin/dev', u.unit)]));
    const dir = mkdtempSync(join(tmpdir(), 'promote-'));
    const body = join(dir, 'body.md');
    writeFileSync(body, previewBody(units, names));
    const title = `Promote to preview: ${units.map((u) => `${names[u.unit]} ${u.to}`).join(', ')}`;
    if (open) gh('pr', 'edit', String(open.number), '--title', title, '--body-file', body);
    else gh('pr', 'create', '--base', 'preview', '--head', 'dev', '--title', title, '--body-file', body);
    console.log(open ? `Updated #${open.number}: ${title}` : `Opened: ${title}`);
  } else if (mode === 'promote') {
    const [unit, wanted] = args;
    git('fetch', 'origin', 'preview', 'production');
    appIds = appIdsNow('origin/preview', 'origin/production');
    if (unit !== AUGUR && !appIds.includes(unit)) throw new Error(`"${unit}" is not a unit: augur, or one of ${appIds.join(', ')}.`);
    const onPreview = versionsFrom(readAt('origin/preview'), appIds)[unit];
    const onProduction = versionsFrom(readAt('origin/production'), appIds)[unit];
    const version = wanted || onPreview;
    if (version !== onPreview) throw new Error(`Preview has ${unit} ${onPreview}, not ${version}: only what preview runs can be promoted.`);
    if (version === onProduction) return console.log(`Production already has ${unit} ${version}.`);
    const release = releaseOf(tagOf(unit, version));
    if (!release) throw new Error(`${tagOf(unit, version)} isn't released yet: the Release workflow on preview makes it.`);
    const branch = promoteBranch(unit, version);
    git('checkout', '-B', branch, 'origin/production');
    const changed = pathsOf(unit, git('diff', '--name-only', 'origin/production', 'origin/preview').split('\n').filter(Boolean), appIds);
    const present = changed.filter((p) => readAt('origin/preview')(p) !== undefined);
    const gone = changed.filter((p) => readAt('origin/preview')(p) === undefined);
    if (present.length) git('checkout', 'origin/preview', '--', ...present);
    if (gone.length) git('rm', '--quiet', '--', ...gone);
    // The lockfile covers every unit: made again from production's packages with this unit's changes.
    execFileSync('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], { cwd: root, stdio: 'inherit' });
    git('add', '-A');
    const name = nameAt('origin/preview', unit);
    git('commit', '--quiet', '-m', `Promote ${name} ${version} to production`);
    git('push', '--force', 'origin', `HEAD:refs/heads/${branch}`);
    const dir = mkdtempSync(join(tmpdir(), 'promote-'));
    const body = join(dir, 'body.md');
    writeFileSync(body, productionBody({ unit, name, version, from: onProduction, releaseUrl: release.url, files: changed.length }));
    const open = JSON.parse(gh('pr', 'list', '--base', 'production', '--head', branch, '--state', 'open', '--json', 'number'))[0];
    if (open) gh('pr', 'edit', String(open.number), '--body-file', body);
    else gh('pr', 'create', '--base', 'production', '--head', branch, '--title', `Promote ${name} ${version} to production`, '--body-file', body);
    console.log(`${open ? 'Updated' : 'Opened'} the promotion of ${name} ${version}.`);
  } else if (mode === 'production') {
    const sha = git('rev-parse', 'HEAD');
    const pr = mergedPrOf(sha);
    const owner = REPO.split('/')[0];
    const promotion = promotionOf(pr?.head?.ref);
    const hotfix = pr?.head?.ref?.startsWith('hotfix/');
    if (!pr || (!promotion && !hotfix)) {
      console.log('This push to production isn’t a merged promotion or hotfix, so nothing is marked as on production.');
    } else if (pr.merged_by?.login !== owner && process.env.MERGED_BY !== owner) {
      throw new Error(`#${pr.number} was merged by ${pr.merged_by?.login ?? 'someone unknown'}, not ${owner}: only the repository's owner promotes to production.`);
    } else {
      const versions = versionsFrom(readAt('HEAD'), appIds);
      for (const [unit, version] of Object.entries(versions)) {
        if (!version || version === '0.0.0' || (promotion && promotion.unit !== unit)) continue;
        const tag = tagOf(unit, version);
        const release = releaseOf(tag);
        // A hotfix's new version isn't released yet: the release steps after this build it on production.
        if (!release || !release.isPrerelease) continue;
        const record = { schema: 'augur.promotion/v1', unit, version, channel: 'production', from: 'preview', commit: sha, pr: pr.number, mergedBy: pr.merged_by?.login, at: new Date().toISOString() };
        const dir = mkdtempSync(join(tmpdir(), 'promote-'));
        const file = join(dir, 'promotion.json');
        writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
        gh('release', 'upload', tag, file, '--clobber');
        gh('release', 'edit', tag, '--prerelease=false', ...(unit === AUGUR ? ['--latest'] : ['--latest=false']));
        console.log(`${tag} is on production.`);
        if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'promoted=true\n');
      }
      if (hotfix) {
        // The fix goes back to preview and dev, so it isn't lost at the next promotion.
        for (const base of ['preview', 'dev']) {
          const open = JSON.parse(gh('pr', 'list', '--base', base, '--head', 'production', '--state', 'open', '--json', 'number'))[0];
          if (open) continue;
          tryOr(() => gh('pr', 'create', '--base', base, '--head', 'production', '--title', `Back-merge production into ${base} (#${pr.number})`, '--body', `Brings the hotfix #${pr.number} back to ${base}.`), undefined);
          console.log(`Opened a back-merge into ${base}.`);
        }
      }
    }
  } else {
    console.error('Usage: node scripts/promote.mjs check-pr | preview-pr | promote <unit> [<version>] | production | versions [<ref>]');
    process.exit(2);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
