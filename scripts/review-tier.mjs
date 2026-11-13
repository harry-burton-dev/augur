#!/usr/bin/env node
// A pull request's review tier, from the paths it changes, and whether its description carries what that
// tier needs (REVIEW.md). Low: nothing beyond green CI. Medium: the description's sections and a pre-merge
// review. High: those, and under 400 changed lines or a reason; on the paths in harryOk, Harry's ok too
// (the `harry-ok` label).
// The tiers' paths are in .github/review-tiers.json, so every repository keeps its own; other repositories
// run this script from here through the reusable Review workflow.
//
// node scripts/review-tier.mjs                in CI on a pull request (BASE_REF, PR_BODY, PR_LABELS, TIERS_FILE)
// node scripts/review-tier.mjs --deploy-test  writes deploytest=true|false to $GITHUB_OUTPUT and always passes
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_HIGH_LINES = 400;
export const SECTIONS = ['Testing', 'Not run', 'Risk', 'How to undo', 'Review'];

// matchesGlob never lets `*` or `**` match a name that starts with a dot, so `infra/**` would miss
// `infra/deploy/.env.example`. Matching with each leading dot spelled out, in the path and the glob alike, fixes that.
const undot = (text) => text.replace(/(^|\/)\./g, '$1_dot_');
const any = (path, globs = []) => globs.some((glob) => matchesGlob(undot(path), undot(glob)));

/** Low when every path is low and none is high; High when any path is high; otherwise Medium. */
export const tierOf = (paths, tiers) => {
  const high = paths.filter((p) => any(p, tiers.high) && !any(p, tiers.notHigh));
  if (high.length) return { tier: 'High', because: high };
  const low = (p) => any(p, tiers.low) && !any(p, tiers.notLow);
  if (paths.length && paths.every(low)) return { tier: 'Low', because: [] };
  return { tier: 'Medium', because: paths.filter((p) => !low(p)) };
};

/** Whether any High path is one that also waits for Harry's ok. */
export const needsHarry = (paths, tiers) => paths.some((p) => any(p, tiers.harryOk) && !any(p, tiers.notHigh));

/** Whether any path runs on a server, so the deploy test must pass before the merge. */
export const needsDeployTest = (paths, tiers) => paths.some((p) => any(p, tiers.deployTest) && !any(p, tiers.notHigh));

/** The body's `## Heading` sections, by heading, each with its text. */
export const sectionsOf = (body) => {
  const out = new Map();
  let current;
  for (const line of (body ?? '').split(/\r?\n/)) {
    const heading = /^#{2,3}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1].toLowerCase();
      out.set(current, '');
    } else if (current) out.set(current, `${out.get(current)}${line}\n`);
  }
  return out;
};

/** What a pull request of `tier` still lacks, in words; empty when it may merge. */
export const problems = ({ tier, body, labels = [], lines = 0, harry = false }) => {
  if (tier === 'Low') return [];
  const found = sectionsOf(body);
  const out = [];
  for (const name of SECTIONS) {
    const text = found.get(name.toLowerCase());
    if (!text?.trim()) out.push(`a "## ${name}" section with something in it`);
  }
  const review = found.get('review') ?? '';
  if (review.trim() && !/\/code-review\b/.test(review)) out.push('the Review section naming the /code-review run (effort, findings, what was fixed or answered)');
  if (tier === 'High') {
    if (harry && !labels.includes('harry-ok')) out.push("Harry's ok (the harry-ok label, added only after he says ok to the three questions)");
    const risk = found.get('risk') ?? '';
    if (lines > MAX_HIGH_LINES && !/over \d+ lines because/i.test(risk)) {
      out.push(`fewer than ${MAX_HIGH_LINES} changed lines (this has ${lines}), or a line in Risk saying "Over ${MAX_HIGH_LINES} lines because …"`);
    }
  }
  return out;
};

/** The paths and changed lines of HEAD against where it left `base`. */
const diffAgainst = (base) => {
  const range = `origin/${base}...HEAD`;
  // Without renames, a file moved out of a High path is listed at both ends.
  const paths = execFileSync('git', ['diff', '--no-renames', '--name-only', range], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const numstat = execFileSync('git', ['diff', '--no-renames', '--numstat', range], { encoding: 'utf8' });
  const lines = numstat.split('\n').filter(Boolean).reduce((sum, row) => {
    const [added, removed] = row.split('\t');
    return sum + (Number(added) || 0) + (Number(removed) || 0);
  }, 0);
  return { paths, lines };
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { BASE_REF = 'main', PR_BODY = '', PR_LABELS = '[]', PR_BOT = '', EVENT = 'pull_request', TIERS_FILE = '.github/review-tiers.json', GITHUB_STEP_SUMMARY, GITHUB_OUTPUT } = process.env;
  const tiers = JSON.parse(readFileSync(TIERS_FILE, 'utf8'));
  if (process.argv.includes('--deploy-test') && EVENT === 'workflow_dispatch') {
    // A run by hand runs everything.
    console.log('deploytest: true (run by hand)');
    if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, 'deploytest=true\n');
    process.exit(0);
  }
  const { paths, lines } = diffAgainst(BASE_REF);
  if (process.argv.includes('--deploy-test')) {
    const needed = needsDeployTest(paths, tiers);
    console.log(`deploytest: ${needed}`);
    if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `deploytest=${needed}\n`);
    process.exit(0);
  }
  const { tier, because } = tierOf(paths, tiers);
  const labels = JSON.parse(PR_LABELS).map((l) => (typeof l === 'string' ? l : l.name));
  const harry = tier === 'High' && needsHarry(paths, tiers);
  // A bot's pull request (Renovate's dependency updates) has no description to check: CI and, where it
  // applies, the deploy test are its gates.
  const missing = PR_BOT === 'true' ? [] : problems({ tier, body: PR_BODY, labels, lines, harry });
  const summary = [
    `### Review tier: ${tier}${harry ? ", waits for Harry's ok" : ''}${needsDeployTest(paths, tiers) ? ', deploy test before merge' : ''}`,
    '',
    `${paths.length} files, ${lines} changed lines.`,
    because.length ? `\nBecause of:\n${because.slice(0, 20).map((p) => `- \`${p}\``).join('\n')}${because.length > 20 ? `\n- and ${because.length - 20} more` : ''}` : '',
    missing.length ? `\nStill needs:\n${missing.map((m) => `- ${m}`).join('\n')}` : '\nNothing missing for this tier.',
    '',
    'What each tier needs is in REVIEW.md.',
  ].join('\n');
  console.log(summary);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `tier=${tier.toLowerCase()}\n`);
  if (missing.length) {
    for (const m of missing) console.log(`::error::${tier} tier pull request needs ${m}.`);
    process.exit(1);
  }
}
