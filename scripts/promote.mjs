// Release channels (docs/release-channels.md): one branch, main. Every merge into it is a dev build;
// merging the Version packages pull request releases each unit whose version moved, built and signed
// once, as a GitHub pre-release (the beta channel); promoting a release makes that same release stable,
// with no rebuild. A unit is AUGUR (the platform, its services and the pillar apps, as one release) or
// one app the app runner installs. A hotfix is made on a release/<unit>-<major.minor> branch cut from
// the release it fixes, and released the same way.
//   node scripts/promote.mjs check-pr               in CI on a pull request (BASE_REF, HEAD_REF): may it go into its base?
//   node scripts/promote.mjs stable <unit> [<v>]    from the Promote workflow: makes the release stable, with promotion.json
//   node scripts/promote.mjs versions [<ref>]       prints each unit's version at a ref (default HEAD)
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';
import { readApps } from './app-release.mjs';
import { REPO } from './repo.mjs';

const root = new URL('..', import.meta.url).pathname;
export const AUGUR = 'augur';
/** The branch work merges into. */
export const TRUNK = 'main';
/** A hotfix branch: release/<unit>-<major>.<minor>, cut from that unit's release tag. */
const RELEASE_BRANCH = /^release\/([a-z][a-z0-9-]*?)-(\d+)\.(\d+)$/;

/** The unit a file belongs to: an app's own folder is the app's, everything else is AUGUR's. */
export const unitOf = (path, appIds) => {
  const m = /^apps\/([^/]+)\//.exec(path);
  return m && appIds.includes(m[1]) ? m[1] : AUGUR;
};

/** The unit and line (major.minor) a release branch is for, or undefined. */
export const releaseLineOf = (branch) => {
  const m = RELEASE_BRANCH.exec(branch ?? '');
  return m ? { unit: m[1], major: Number(m[2]), minor: Number(m[3]) } : undefined;
};

/**
 * Why a pull request may not go into its base, or nothing. `files` are the paths it changes. Into the
 * trunk anything goes. Into a release branch only fixes to that one unit, which keep to its line.
 */
export const prProblems = ({ base, head, files = [], appIds = [], versions = {} }) => {
  const problems = [];
  const line = releaseLineOf(base);
  if (base === TRUNK || !base.startsWith('release/')) return problems;
  if (!line) return [`${base} isn't a release branch: hotfixes go into release/<unit>-<major>.<minor>, such as release/augur-0.13.`];
  if (!head.startsWith('hotfix/') && !head.startsWith('changeset-release/')) problems.push(`Only a hotfix/* branch (or its Version packages pull request) goes into ${base}, not ${head}. Everything else merges into ${TRUNK}.`);
  const others = files.filter((p) => unitOf(p, appIds) !== line.unit && p !== 'pnpm-lock.yaml' && !p.startsWith('.changeset/'));
  if (others.length) problems.push(`A hotfix to ${line.unit} may only change its own files, but this changes ${others.slice(0, 5).join(', ')}${others.length > 5 ? ` and ${others.length - 5} more` : ''}.`);
  const version = versions[line.unit];
  if (version && (semver.major(version) !== line.major || semver.minor(version) !== line.minor)) problems.push(`${base} is for ${line.unit} ${line.major}.${line.minor}.x, but this makes it ${version}: a hotfix is a patch.`);
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

/**
 * Where a unit's releases are, for a promotion: AUGUR and the apps released from this repository are
 * here; an app in its own repository (release/app-repos.json, ADR 0047) is there, and is changed with
 * APP_PROMOTE_TOKEN. A pillar app is refused: it reaches stable inside the AUGUR release that ships it
 * (ADR 0049). Returns { repo, own } or { problem }.
 */
export const promotionSource = (unit, { repo, here = [], own = {}, shipped = [] }) => {
  if (unit === AUGUR || here.includes(unit)) return { repo, own: false };
  if (own[unit]) return { repo: own[unit], own: true };
  if (shipped.includes(unit)) return { problem: `${unit} ships with AUGUR (release/shipped-apps.json, ADR 0049), so it becomes stable with the AUGUR release that ships it. Promote augur instead.` };
  const all = [AUGUR, ...here, ...Object.keys(own)];
  return { problem: `"${unit}" is not a unit: ${all.join(', ')}.` };
};

/** The tag a unit's release has. */
export const tagOf = (unit, version) => (unit === AUGUR ? `augur@${version}` : `app/${unit}@${version}`);

/** The release a promotion takes: the one asked for, or the unit's newest beta that isn't a dev build or a preview. */
export const promotionTarget = (unit, wanted, releases) => {
  const of = releases
    .map((r) => ({ ...r, version: r.tagName.startsWith(`${unit === AUGUR ? 'augur' : `app/${unit}`}@`) ? r.tagName.slice(r.tagName.indexOf('@') + 1) : undefined }))
    .filter((r) => r.version && semver.valid(r.version) && !/-(dev|pr)\./.test(r.version));
  if (wanted) return of.find((r) => r.version === wanted);
  return of.filter((r) => r.isPrerelease).sort((a, b) => semver.rcompare(a.version, b.version))[0];
};

/** The record a stable release carries: who made it stable, from which release, when, and how long it had baked. */
export const promotionRecord = ({ unit, version, actor, at, run, bake }) => ({ schema: 'augur.promotion/v2', unit, version, channel: 'stable', from: 'beta', promotedBy: actor, run, at, ...(bake ? { bake } : {}) });

/** ADR 0018: how long a release must have run on a preview deployment, with no going back, before it's made stable. */
export const BAKE_HOURS = 72;
export const BAKE_RING = 'preview';

/**
 * Whether a release has baked (ADR 0018), from the portal's answer (GET /api/augur/bake): each
 * deployment that ran it, its ring, hours and whether it went back. Undefined `evidence` means the
 * workflow can't ask the portal yet, which is said in the record rather than taken for a pass.
 * `skip` is the owner's override, recorded too. Returns the problem when it may not go stable.
 */
export const bakeVerdict = ({ evidence, hours = BAKE_HOURS, skip = false, notAsked }) => {
  if (!evidence) return { record: { checked: false, why: notAsked ?? 'The portal wasn’t asked.' } };
  const deployments = evidence.deployments ?? [];
  const back = deployments.filter((d) => d.wentBack);
  const preview = deployments.filter((d) => d.ring === BAKE_RING && !d.wentBack).sort((a, b) => b.hours - a.hours);
  const best = preview[0];
  let problem;
  if (back.length) problem = `${back.map((d) => d.deployment).join(', ')} went back from it.`;
  else if (!best) problem = `No ${BAKE_RING} deployment has reported running it.`;
  else if (best.hours < hours) problem = `It has run on ${best.deployment} for ${best.hours} hour${best.hours === 1 ? '' : 's'}, and it takes ${hours}.`;
  const facts = { checked: true, needs: hours, ...(best ? { deployment: best.deployment, hours: best.hours } : {}), ...(back.length ? { wentBack: back.map((d) => d.deployment) } : {}) };
  if (!problem) return { record: facts };
  if (skip) return { record: { ...facts, overridden: true, problem } };
  return { problem: `${problem} Bake time is ${hours} hours on a ${BAKE_RING} deployment with no going back (ADR 0018). To make it stable anyway, run again with "Skip the bake time" ticked; that is recorded in promotion.json.`, record: facts };
};

/** Asks the portal how long the release has baked, or says why it can't be asked. */
const askPortal = async (unit, version, portalUrl = process.env.PORTAL_URL) => {
  if (!portalUrl) return { notAsked: 'PORTAL_URL isn’t set for the Promote workflow (a repository variable), so bake time wasn’t checked. docs/release-channels.md says how to set it up.' };
  const url = `${portalUrl.replace(/\/$/, '')}/api/augur/bake?unit=${encodeURIComponent(unit)}&version=${encodeURIComponent(version)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    return { unreachable: `The portal at ${portalUrl} didn’t answer (${err.message}). Is the workflow on the tailnet (TS_OAUTH_CLIENT_ID and TS_OAUTH_SECRET)?` };
  }
  if (!res.ok) return { unreachable: `The portal answered ${res.status} for ${url}.` };
  return { evidence: await res.json() };
};

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

const main = async () => {
  const [mode, ...args] = process.argv.slice(2);
  const appIds = readApps().map((a) => a.id);

  if (mode === 'versions') {
    console.log(JSON.stringify(versionsFrom(readAt(args[0] ?? 'HEAD'), appIds), null, 2));
  } else if (mode === 'check-pr') {
    const base = process.env.BASE_REF ?? '';
    const head = process.env.HEAD_REF ?? '';
    const files = git('diff', '--name-only', `origin/${base}...HEAD`).split('\n').filter(Boolean);
    const problems = prProblems({ base, head, files, appIds, versions: versionsFrom(readAt('HEAD'), appIds) });
    if (problems.length) {
      for (const p of problems) console.error(`✗ ${p}`);
      process.exit(1);
    }
    console.log(`✓ ${head} may go into ${base}.`);
  } else if (mode === 'stable') {
    const [unit, wanted] = args;
    const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
    const source = promotionSource(unit, { repo: REPO, here: appIds, own: json('release/app-repos.json').apps ?? {}, shipped: Object.keys(json('release/shipped-apps.json').apps ?? {}) });
    if (source.problem) throw new Error(source.problem);
    const owner = REPO.split('/')[0];
    const actor = process.env.GITHUB_ACTOR;
    if (actor !== owner) throw new Error(`Only the repository's owner (${owner}) makes a release stable, not ${actor ?? 'someone unknown'}.`);
    // An app's own repository is changed with a token that may write its releases, kept for this workflow alone.
    const promoteToken = process.env.APP_PROMOTE_TOKEN?.trim();
    if (source.own && !promoteToken) throw new Error(`${unit} is released from ${source.repo}, and APP_PROMOTE_TOKEN isn’t set to mark its releases stable (docs/release-channels.md, "An app in its own repository").`);
    const ghAt = (...args) =>
      source.own ? execFileSync('gh', [...args, '--repo', source.repo], { cwd: root, encoding: 'utf8', env: { ...process.env, GH_TOKEN: promoteToken } }).trim() : gh(...args);
    const releases = JSON.parse(ghAt('release', 'list', '--limit', '500', '--json', 'tagName,isPrerelease'));
    const target = promotionTarget(unit, wanted, releases);
    if (!target) throw new Error(wanted ? `${tagOf(unit, wanted)} isn't released.` : `${unit} has no beta release to promote.`);
    const tag = tagOf(unit, target.version);
    if (!target.isPrerelease) return console.log(`${tag} is stable already.`);
    const skip = process.env.SKIP_BAKE === 'true';
    const asked = await askPortal(unit, target.version);
    if (asked.unreachable && !skip) throw new Error(`${asked.unreachable} Bake time couldn’t be checked; run again with "Skip the bake time" ticked to make it stable anyway.`);
    const verdict = bakeVerdict({ evidence: asked.evidence, hours: Number(process.env.BAKE_HOURS || BAKE_HOURS), skip, notAsked: asked.notAsked ?? asked.unreachable });
    if (verdict.problem) throw new Error(`${tag} isn’t made stable: ${verdict.problem}`);
    if (!verdict.record.checked) console.log(`::warning::${verdict.record.why}`);
    else if (verdict.record.overridden) console.log(`::warning::Bake time skipped by ${actor}: ${verdict.record.problem}`);
    else console.log(`${tag} baked ${verdict.record.hours} hours on ${verdict.record.deployment}.`);
    const dir = mkdtempSync(join(tmpdir(), 'promote-'));
    const file = join(dir, 'promotion.json');
    writeFileSync(file, `${JSON.stringify(promotionRecord({ unit, version: target.version, actor, at: new Date().toISOString(), run: process.env.GITHUB_RUN_ID, bake: verdict.record }), null, 2)}\n`);
    ghAt('release', 'upload', tag, file, '--clobber');
    // AUGUR's newest stable release is the repository's latest; an app's never is.
    const newest = unit === AUGUR && !releases.some((r) => r.tagName.startsWith('augur@') && !r.isPrerelease && semver.valid(r.tagName.slice(6)) && semver.gt(r.tagName.slice(6), target.version));
    ghAt('release', 'edit', tag, '--prerelease=false', `--latest=${newest}`);
    console.log(`${tag} is stable${source.own ? ` in ${source.repo}` : ''}.`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `promoted=${tag}\n`);
  } else {
    console.error('Usage: node scripts/promote.mjs check-pr | stable <unit> [<version>] | versions [<ref>]');
    process.exit(2);
  }
};

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
