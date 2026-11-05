// Halts a release, or lets it go on again (ADR 0018, docs/release-channels.md "Halting a release").
//   node scripts/halt.mjs halt <unit> <version> <reason>
//   node scripts/halt.mjs resume <unit> <version>
// The unit is augur or an app's id. Halting puts halted.json (why, when, by whom) on the release;
// the Release feed workflow then lists it as halted, and no deployment is offered it or takes it by
// itself. A deployment already running it is told what to move to. Resuming takes the file off.
// Only the repository's owner may run it. Needs gh, signed in (GH_TOKEN), and GITHUB_ACTOR.
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';

const REPO = process.env.GITHUB_REPOSITORY ?? 'harry-burton-dev/augur';
const UNIT = /^(augur|[a-z][a-z0-9-]{1,39})$/;

/** The release's tag: augur@<version>, or app/<id>@<version>. */
export const tagOf = (unit, version) => (unit === 'augur' ? `augur@${version}` : `app/${unit}@${version}`);

/** What's wrong with a request, or undefined when it may go ahead. */
export const haltProblem = ({ mode, unit, version, reason, actor, owner }) => {
  if (mode !== 'halt' && mode !== 'resume') return 'The action is halt or resume.';
  if (!UNIT.test(unit ?? '')) return `"${unit}" is not a unit: augur, or an app's id.`;
  if (!semver.valid(version ?? '')) return `"${version}" is not a version.`;
  if (mode === 'halt' && !reason?.trim()) return 'Say why it is halted: deployments show the reason to their admins.';
  if (actor !== owner) return `Only the repository's owner (${owner}) halts or resumes a release, not ${actor ?? 'someone unknown'}.`;
  return undefined;
};

/** halted.json as the feed reads it (scripts/publish-feed.mjs, haltedOf). */
export const haltRecord = ({ reason, actor, at, run }) => ({ schema: 'augur.halt/v1', reason: reason.trim(), by: actor, at, run });

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

const main = () => {
  const [mode, unit, version, ...words] = process.argv.slice(2);
  const reason = words.join(' ');
  const actor = process.env.GITHUB_ACTOR;
  const problem = haltProblem({ mode, unit, version, reason, actor, owner: REPO.split('/')[0] });
  if (problem) throw new Error(problem);
  const tag = tagOf(unit, version);
  const assets = JSON.parse(gh('release', 'view', tag, '--repo', REPO, '--json', 'assets')).assets.map((a) => a.name);
  if (mode === 'halt') {
    const file = join(mkdtempSync(join(tmpdir(), 'halt-')), 'halted.json');
    writeFileSync(file, `${JSON.stringify(haltRecord({ reason, actor, at: new Date().toISOString(), run: process.env.GITHUB_RUN_ID }), null, 2)}\n`);
    gh('release', 'upload', tag, file, '--clobber', '--repo', REPO);
    console.log(`${tag} is halted: ${reason.trim()}`);
  } else if (assets.includes('halted.json')) {
    gh('release', 'delete-asset', tag, 'halted.json', '--yes', '--repo', REPO);
    console.log(`${tag} goes on again.`);
  } else {
    console.log(`${tag} wasn't halted.`);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${tag}\n`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
