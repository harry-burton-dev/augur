#!/usr/bin/env node
// A pull request's review tier, from the paths it changes, and whether its description carries what that
// tier needs (REVIEW.md). Low: nothing beyond green CI. Medium: the description's sections and a pre-merge
// review. High: those, and under 400 changed lines or a reason; on the paths in harryOk (what can't be undone
// or gives more access) a /code-review at high effort or more. Harry is not a gate (PER-438): the auto-ok log
// tells him afterwards.
// The tiers' paths are in .github/review-tiers.json, so every repository keeps its own; other repositories
// run this script from here through the reusable Review workflow.
//
// node scripts/review-tier.mjs                in CI on a pull request (BASE_REF, PR_BODY, PR_LABELS, TIERS_FILE)
// node scripts/review-tier.mjs --deploy-test  writes deploytest=true|false to $GITHUB_OUTPUT and always passes
// node scripts/review-tier.mjs --record       on a merged pull request: writes its auto-ok record to RECORD_FILE
//                                             when it merged without Harry's ok (REVIEW.md: the auto-ok log)
//
// The tiers file may also carry `next`, rules on trial: they are worked out and reported on every pull request,
// and a merge they would have spared Harry is logged, but only the current rules decide the check.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
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

/**
 * Why `tiers` want Harry's ok: each path on his list, and each `harryOkWhen` rule a change sets off. A rule
 * matches a path, then a line the change adds (`added`) or takes away (`removed`), both regular expressions,
 * or, with `newAction`, a step that uses an action no workflow on the base uses yet. Empty when he isn't needed.
 */
export const harryReasons = (paths, tiers, { added = () => [], removed = () => [], knownActions = new Set() } = {}) => {
  const out = paths.filter((p) => any(p, tiers.harryOk) && !any(p, tiers.notHigh));
  // A comment grants nothing, so comment lines don't set a rule off.
  const code = (lines) => lines.filter((line) => !/^\s*#/.test(line));
  for (const rule of tiers.harryOkWhen ?? []) {
    const plus = rule.added && new RegExp(rule.added);
    const minus = rule.removed && new RegExp(rule.removed);
    for (const p of paths.filter((path) => any(path, rule.paths) && !any(path, tiers.notHigh))) {
      const hit =
        (plus && code(added(p)).some((line) => plus.test(line))) ||
        (minus && code(removed(p)).some((line) => minus.test(line))) ||
        (rule.newAction && actionsIn(code(added(p))).some((a) => !knownActions.has(a)));
      if (hit) out.push(`${p} (${rule.why})`);
    }
  }
  return out;
};

/** The actions that workflow lines use, by name without the version; local and docker steps aren't actions to trust. */
export const actionsIn = (lines) =>
  lines
    .map((line) => /^\s*-?\s*uses:\s*['"]?([^@'"\s]+)@/.exec(line)?.[1])
    .filter((name) => name && !name.startsWith('./') && !name.startsWith('docker://'));

/**
 * What one set of rules makes of a change. Generated files (`notCount`) don't count towards the tier, nor,
 * with `ignoreRenames`, files only renamed; a renamed file still counts for Harry's ok, and arrives in full as
 * added lines, so a file moved into a workflow is read like a new one. A change that sets off one of Harry's
 * rules is High whatever its paths. With rules that have none of these, this is tierOf and needsHarry.
 */
export const verdict = (paths, rules, { renamed = [], ...lines } = {}) => {
  const counting = paths.filter((p) => !any(p, rules.notCount));
  const { tier, because } = tierOf(rules.ignoreRenames ? counting.filter((p) => !renamed.includes(p)) : counting, rules);
  // Generated files still count for Harry's ok: a new entry in the migrations lock is a new migration.
  const harry = harryReasons(paths, rules, lines);
  return { tier: harry.length ? 'High' : tier, because: harry.length && tier !== 'High' ? harry : because, harry };
};

/**
 * Whether a merged pull request goes in the auto-ok log. In the shadow week (the tiers file has `next`): it
 * waited for Harry under the current rules and the next ones wouldn't have asked him. After the switch
 * (`autoOk` in the tiers file): it is High and merged without his ok. Otherwise nothing is logged.
 */
export const logged = ({ now, next, autoOk = false }) =>
  (autoOk && now.tier === 'High') || Boolean(next && now.harry.length > 0 && !next.harry.length);

const clip = (text = '', max = 400) => {
  const flat = text.trim().replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** The auto-ok comment: a line a machine reads (DevLake, the control centre) and the same in words for Harry. */
export const autoOkComment = (record) => {
  // JSON in an HTML comment: `>` is written as \u003e, so nothing in it can end the comment early.
  const data = JSON.stringify(record).replace(/>/g, '\\u003e');
  const shadow = record.phase === 'shadow';
  const line = (label, text) => (text ? `- ${label}: ${text}` : undefined);
  return [
    `<!-- auto-ok: ${data} -->`,
    shadow
      ? "**Auto-ok (shadow week).** The next review rules would have merged this without Harry's ok. Under the current rules it waited for him."
      : "**Auto-ok.** This merged on its checks and its code review, without Harry.",
    '',
    line('Tier', shadow ? `${record.tier} now, ${record.nextTier} under the next rules` : record.tier),
    line('Because of', record.because.slice(0, 8).map((p) => `\`${p}\``).join(', ')),
    line('Deep review for', (record.deep ?? []).slice(0, 8).map((p) => `\`${p}\``).join(', ')),
    line('Review', record.review),
    `- ${record.files} files, ${record.lines} changed lines. Deploy test: ${record.deployTest ? 'needed' : 'not needed'}.`,
    line('Checks', record.checksRead === false ? "couldn't be read" : record.checks.map((c) => `${c.name} ${c.conclusion}`).join(', ')),
    line('Not run', record.notRun),
    line('How to undo', record.howToUndo),
    line('Risk', record.risk),
    '',
    'If Harry would not have said ok to this, add the `harry-would-not` label: the rule that let it through gets tightened (REVIEW.md).',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
};

/** Whether any path runs on a server, so the deploy test must pass before the merge. Tests don't (`notDeployTest`, or else `notHigh`). */
export const needsDeployTest = (paths, tiers) => paths.some((p) => any(p, tiers.deployTest) && !any(p, tiers.notDeployTest ?? tiers.notHigh));

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

/** The Review section names a /code-review run at high effort or more. */
const DEEP_REVIEW = /\/code-review\s+(high|xhigh|max)\b/i;

/** What a pull request of `tier` still lacks, in words; empty when it may merge. */
export const problems = ({ tier, body, labels = [], lines = 0, harry = false, bot = false }) => {
  if (tier === 'Low') return [];
  // Renovate's pull requests have no description: CI is their gate, and the auto-ok log records them.
  if (bot) return [];
  const found = sectionsOf(body);
  const out = [];
  for (const name of SECTIONS) {
    const text = found.get(name.toLowerCase());
    if (!text?.trim()) out.push(`a "## ${name}" section with something in it`);
  }
  const review = found.get('review') ?? '';
  if (review.trim() && !/\/code-review\b/.test(review)) out.push('the Review section naming the /code-review run (effort, findings, what was fixed or answered)');
  if (tier === 'High') {
    // Harry is no longer the gate (PER-438, 15 Nov): what used to wait for his ok needs a deeper code review.
    if (harry && review.trim() && !DEEP_REVIEW.test(review)) out.push('a /code-review run at high effort or more (high, xhigh or max) named in the Review section, for the files listed under "Needs a deep review"');
    const risk = found.get('risk') ?? '';
    if (lines > MAX_HIGH_LINES && !/over \d+ lines because/i.test(risk)) {
      out.push(`fewer than ${MAX_HIGH_LINES} changed lines (this has ${lines}), or a line in Risk saying "Over ${MAX_HIGH_LINES} lines because …"`);
    }
  }
  return out;
};

/** The paths and changed lines of HEAD against where it left `base` (a ref such as origin/main). */
const diffAgainst = (base) => {
  const range = `${base}...HEAD`;
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1e8 });
  // Without renames, a file moved out of a High path is listed at both ends.
  const paths = git('diff', '--no-renames', '--name-only', range).split('\n').filter(Boolean);
  // The line count keeps renames, so a moved file counts only what changed in it.
  const lines = git('diff', '--numstat', range).split('\n').filter(Boolean).reduce((sum, row) => {
    const [added, removed] = row.split('\t');
    return sum + (Number(added) || 0) + (Number(removed) || 0);
  }, 0);
  // Asked for only by rules that need them, and each worked out once.
  const once = (make) => {
    let value;
    return () => (value ??= make());
  };
  const renames = once(() =>
    git('diff', '-M100%', '--name-status', range).split('\n').filter((row) => row.startsWith('R100')).map((row) => row.split('\t').slice(1)),
  );
  const cache = new Map();
  const diffOf = (path) => {
    if (!cache.has(path)) {
      const rows = git('diff', '-U0', '--no-color', '--no-renames', range, '--', path).split('\n');
      cache.set(path, {
        added: rows.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1)),
        removed: rows.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1)),
      });
    }
    return cache.get(path);
  };
  return {
    paths,
    lines,
    get renamed() {
      return renames().flat();
    },
    added: (path) => diffOf(path).added,
    removed: (path) => diffOf(path).removed,
  };
};

const existsAt = (ref, path) => execFileSync('git', ['ls-tree', '--name-only', ref, '--', path], { encoding: 'utf8' }).trim() !== '';
const fileAt = (ref, path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 1e8 }).split('\n');

/** The actions the base's workflows already use. */
const actionsAt = (base) => {
  try {
    const text = execFileSync('git', ['grep', '-h', '-E', 'uses:', base, '--', '.github/workflows', '.github/actions'], { encoding: 'utf8' });
    return new Set(actionsIn(text.split('\n')));
  } catch {
    return new Set(); // git grep exits 1 when nothing matches
  }
};

/**
 * The tiers as the base branch has them, so a pull request can't loosen the rules it is checked by (a change
 * to the tiers file waits for Harry's ok). Only where the base has no tiers file yet, the pull
 * request that adds it, are its own used.
 */
const tiersAt = (base, file) => {
  // Only a base without the file falls back; a missing base ref or a broken file there fails the check.
  const there = execFileSync('git', ['ls-tree', '--name-only', base, '--', file], { encoding: 'utf8' }).trim();
  if (!there) return { tiers: JSON.parse(readFileSync(file, 'utf8')), from: 'this pull request (the base has no tiers file yet)' };
  return { tiers: JSON.parse(execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' })), from: base };
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { BASE_REF = 'main', BASE_COMMIT, PR_BODY = '', PR_LABELS = '[]', PR_BOT = '', EVENT = 'pull_request', TIERS_FILE = '.github/review-tiers.json', GITHUB_STEP_SUMMARY, GITHUB_OUTPUT } = process.env;
  // On a pull request, where the branch left its base. On a merge (--record), the commit before the merge
  // (BASE_COMMIT): the rules and actions the pull request was checked against, and its change exactly.
  const base = BASE_COMMIT || `origin/${BASE_REF}`;
  const { tiers, from } = tiersAt(base, TIERS_FILE);
  if (process.argv.includes('--deploy-test') && EVENT === 'workflow_dispatch') {
    // A run by hand runs everything.
    console.log('deploytest: true (run by hand)');
    if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, 'deploytest=true\n');
    process.exit(0);
  }
  const change = diffAgainst(base);
  const { paths, lines } = change;
  if (process.argv.includes('--deploy-test')) {
    const needed = needsDeployTest(paths, tiers);
    console.log(`deploytest: ${needed}`);
    if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `deploytest=${needed}\n`);
    process.exit(0);
  }
  const labels = JSON.parse(PR_LABELS).map((l) => (typeof l === 'string' ? l : l.name));
  const knownActions = actionsAt(base);
  const context = {
    get renamed() {
      return change.renamed;
    },
    added: (p) => (change.renamed.includes(p) && existsAt('HEAD', p) ? fileAt('HEAD', p) : change.added(p)),
    removed: change.removed,
    knownActions,
  };
  const now = verdict(paths, tiers, context);
  const { tier, because } = now;
  const harry = now.harry.length > 0;
  // The next rules only report until the switch, so nothing wrong with them may fail this check.
  let next;
  try {
    next = tiers.next && verdict(paths, tiers.next, context);
  } catch (error) {
    console.log(`::warning::The next review rules couldn't be worked out, so they aren't reported: ${error.message}`);
  }
  if (process.argv.includes('--record')) {
    const { RECORD_FILE, PR_NUMBER = '', PR_TITLE = '', MERGE_SHA = '', MERGED_AT = '', GITHUB_REPOSITORY = '', CHECKS = '[]' } = process.env;
    if (!logged({ now, next, autoOk: tiers.autoOk === true })) {
      console.log(`Not for the auto-ok log: ${tier}${harry ? ", waited for Harry's ok" : ''}${next ? `; next rules: ${next.tier}${next.harry.length ? ", Harry's ok" : ''}` : ''}.`);
      if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, 'logged=false\n');
      process.exit(0);
    }
    const found = sectionsOf(PR_BODY);
    const record = {
      v: 1,
      phase: tiers.autoOk === true ? 'live' : 'shadow',
      repo: GITHUB_REPOSITORY,
      pr: Number(PR_NUMBER) || PR_NUMBER,
      title: PR_TITLE,
      sha: MERGE_SHA,
      mergedAt: MERGED_AT,
      tier,
      harry,
      harryOk: labels.includes('harry-ok'),
      deep: now.harry.slice(0, 20),
      nextTier: next?.tier ?? tier,
      because: (next?.because ?? because).slice(0, 20),
      files: paths.length,
      lines,
      deployTest: needsDeployTest(paths, tiers),
      // `unread` when the checks couldn't be read (a private repository's token): an empty list, and a flag.
      checks: CHECKS === 'unread' ? [] : JSON.parse(CHECKS),
      checksRead: CHECKS !== 'unread',
      notRun: clip(found.get('not run')),
      howToUndo: clip(found.get('how to undo')),
      risk: clip(found.get('risk')),
      review: clip(found.get('review')),
    };
    if (RECORD_FILE) writeFileSync(RECORD_FILE, autoOkComment(record));
    console.log(autoOkComment(record));
    if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, 'logged=true\n');
    process.exit(0);
  }
  // Renovate's pull request (dependency updates) has no description to check, so CI is its gate; formerly
  // asked of it, on his paths; CI and, where it applies, the deploy test are its other gates.
  const missing = PR_BOT === 'true' ? problems({ tier, labels, harry, bot: true }) : problems({ tier, body: PR_BODY, labels, lines, harry });
  const summary = [
    `### Review tier: ${tier}${harry ? ', deep review' : ''}${needsDeployTest(paths, tiers) ? ', deploy test before merge' : ''}`,
    '',
    `${paths.length} files, ${lines} changed lines. Tiers from ${from}.`,
    because.length ? `\nBecause of:\n${because.slice(0, 20).map((p) => `- \`${p}\``).join('\n')}${because.length > 20 ? `\n- and ${because.length - 20} more` : ''}` : '',
    harry ? `\nNeeds a deep review (/code-review high, xhigh or max) because of:\n${now.harry.slice(0, 20).map((p) => `- \`${p}\``).join('\n')}${now.harry.length > 20 ? `\n- and ${now.harry.length - 20} more` : ''}` : '',
    next
      ? `\nNext rules (shadow week, they don't decide this check yet): ${next.tier}${next.harry.length ? ", waits for Harry's ok" : ''}.${next.harry.length ? `\n${next.harry.slice(0, 10).map((p) => `- \`${p}\``).join('\n')}` : ''}${harry && !next.harry.length ? "\nIt would merge without Harry's ok, and go in the auto-ok log." : ''}`
      : '',
    missing.length ? `\nStill needs:\n${missing.map((m) => `- ${m}`).join('\n')}` : '\nNothing missing for this tier.',
    '',
    'What each tier needs is in REVIEW.md.',
  ].join('\n');
  console.log(summary);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `tier=${tier.toLowerCase()}\n${next ? `next-tier=${next.tier.toLowerCase()}\nnext-harry=${next.harry.length > 0}\n` : ''}`);
  if (missing.length) {
    for (const m of missing) console.log(`::error::${tier} tier pull request needs ${m}.`);
    process.exit(1);
  }
}
