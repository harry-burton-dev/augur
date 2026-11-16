// The rules that keep database migrations safe to upgrade over and to roll back from (AUGUR's ADR 0053), shared
// by AUGUR's own scripts/check-migrations.mjs and `augur-app migrations` in an app's repository:
//   - a migration that shipped never changes and is never removed: servers have run it;
//   - within a major version, migrations only add. Squawk lints each one that hasn't shipped, with the rules in
//     squawk.toml beside this package (AUGUR's own .squawk.toml is the same), and FALLBACK below covers what
//     Squawk has no rule for. A reviewed `-- squawk-ignore <rule>` comment lets a statement through.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What a migration can do that the release before it can't live with, and Squawk has no rule for. Each has
 * a rule name of its own, so the same `-- squawk-ignore` comment takes it.
 */
export const FALLBACK = [
  ['augur-truncate', /^truncate\b/i, 'Emptying a table removes rows the release before still reads.'],
  ['augur-delete-rows', /^delete\s+from\b/i, 'Deleting rows removes what the release before still reads.'],
  ['augur-bulk-update', /^update\b(?![\s\S]*\bwhere\b)/i, 'Changing every row of a table can change what the release before reads.'],
];

/** The rules a `-- squawk-ignore` (or, with `file`, `-- squawk-ignore-file`) comment in `text` names; true when one names none, which means all. */
const ignoredIn = (text, file) => {
  const names = new Set();
  for (const [, list] of text.matchAll(file ? /--[ \t]*squawk-ignore-file\b([^\n]*)/g : /--[ \t]*squawk-ignore(?!-file)\b([^\n]*)/g)) {
    const each = list.split(',').map((n) => n.trim()).filter(Boolean);
    if (!each.length) return true;
    for (const n of each) names.add(n);
  }
  return names;
};

/**
 * What the fallback rules find in one migration's SQL: [{ rule, line, message }]. It splits statements at
 * semicolons, which is enough for the plain SQL that migrations hold; an ignore comment covers the statement
 * it sits in front of, as in Squawk.
 */
export const fallback = (sql) => {
  const forFile = ignoredIn(sql, true);
  const found = [];
  let line = 1;
  for (const text of sql.split(';')) {
    const statement = text.replace(/--[^\n]*/g, '').trim();
    const forStatement = ignoredIn(text, false);
    const skip = (rule) => forFile === true || forFile.has(rule) || forStatement === true || forStatement.has(rule);
    const at = line + (text.slice(0, text.length - text.trimStart().length).match(/\n/g)?.length ?? 0);
    for (const [rule, pattern, message] of FALLBACK) if (pattern.test(statement) && !skip(rule)) found.push({ rule, line: at, message });
    line += text.match(/\n/g)?.length ?? 0;
  }
  return found;
};

/**
 * A linter for migrations ([{ name, id, sql }]), with Squawk at `squawk` and its `config`, and the fallback rules: { "<name> <id>": [{ rule, line,
 * message }] }, an entry for each one given. Throws when Squawk can't run, so no migration goes unlinted.
 */
export const lintWith = ({ squawk, config }) => (migrations) => {
  const key = (m) => `${m.name} ${m.id}`;
  const found = Object.fromEntries(migrations.map((m) => [key(m), fallback(m.sql)]));
  if (!migrations.length) return found;
  if (!existsSync(squawk)) throw new Error("Squawk isn't installed, so new migrations can't be checked. Add squawk-cli to the repository's devDependencies and run: pnpm install");
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  try {
    const files = migrations.map((_, i) => join(dir, `${i}.sql`));
    migrations.forEach((m, i) => writeFileSync(files[i], m.sql));
    const run = spawnSync(squawk, ['--config', config, '--reporter', 'json', ...files], { encoding: 'utf8' });
    let report;
    try {
      report = JSON.parse(run.stdout);
    } catch {
      throw new Error(`Squawk didn't run: ${(run.stderr || run.stdout || run.error?.message || 'no output').trim()}`);
    }
    for (const v of report) {
      // An ignore that names a fallback rule is for this script, not a rule Squawk should know.
      if (v.rule_name === 'unused-ignore' && FALLBACK.some(([rule]) => v.message.includes(rule))) continue;
      const m = migrations[files.findIndex((f) => f === v.file || f.endsWith(`/${v.file}`))];
      found[key(m)].push({ rule: v.rule_name, line: v.line + 1, message: v.message });
    }
    return found;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

export const fingerprint = (sql) => createHash('sha256').update(sql.trim()).digest('hex').slice(0, 16);

/** Every lock entry in `a` or `b`. */
export const mergeLocks = (a = {}, b = {}) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((name) => [name, { ...(a[name] ?? {}), ...(b[name] ?? {}) }]));

/**
 * What's wrong with the migrations `all` ({ name: [{ id, hash, sql }] }) given what has shipped (`released`,
 * a lock) and the services that may break their tables (`mayBreak`, a Set of names). `lint` finds what each
 * migration that hasn't shipped does that the release before can't live with; `frozenAt` names the branch
 * whose migrations count as shipped too, for the messages.
 */
export const problemsFor = (all, released, mayBreak, { lint, frozenAt }) => {
  const problems = [];
  const where = frozenAt ? ` (in a release or on ${frozenAt})` : ' in a release';
  const fresh = [];
  for (const [name, list] of Object.entries(all)) {
    const shipped = released[name] ?? {};
    const ids = list.map((m) => m.id);
    for (const [id, hash] of Object.entries(shipped)) {
      const now = list.find((m) => m.id === id);
      if (!now) problems.push(`${name}: migration ${id} shipped${where} and is gone. Servers have run it; put it back.`);
      else if (now.hash !== hash) problems.push(`${name}: migration ${id} changed after it shipped${where}. Servers have run the old one; put it back and add a new migration.`);
    }
    const shippedIds = Object.keys(shipped);
    if (ids.slice(0, shippedIds.length).join() !== shippedIds.join()) problems.push(`${name}: new migrations must come after the released ones (${shippedIds.join(', ')}).`);
    for (const m of list.filter((m) => !(m.id in shipped))) if (!mayBreak.has(name)) fresh.push({ name, id: m.id, sql: m.sql });
  }
  const found = lint(fresh);
  for (const m of fresh) {
    const hits = found[`${m.name} ${m.id}`] ?? [];
    if (!hits.length) continue;
    const what = hits.map((h) => `line ${h.line}, ${h.rule}: ${h.message}`).join('\n    ');
    problems.push(
      `${m.name}: migration ${m.id} does what the release before it can't run on:\n    ${what}\n  Migrations only add within a major version: add the new thing now and remove the old one in a later major, or make this a major changeset for ${m.name}. If a reviewer agrees the release before is fine with a statement, put \`-- squawk-ignore <rule>\` and the reason on the line above it.`,
    );
  }
  return problems;
};

// ── An app's own migrations (`augur-app migrations`) ──
// An app keeps its migrations in service/src/migrations.ts as `MIGRATIONS` (the template's), built to
// service/dist/migrations.js, and runs them with the service kit's runMigrations in its `migrate` part. What it
// shipped is service/migrations.lock.json as of its newest stable release, app/<id>@<x.y.z>.

/** Where an app's lock of its migrations lives, from the repository's root. */
export const APP_LOCK = 'service/migrations.lock.json';

/** The Squawk rules an app's migrations are held to: AUGUR's own. */
export const SQUAWK_CONFIG = fileURLToPath(new URL('../squawk.toml', import.meta.url));

/** An app's lock: { "<id>": "<fingerprint>" }, in order. */
export const appLockOf = (migrations) => Object.fromEntries(migrations.map((m) => [m.id, fingerprint(m.sql)]));

/** The lock's text, as written to APP_LOCK. */
export const appLockText = (migrations) => `${JSON.stringify(appLockOf(migrations), null, 2)}\n`;

/** x.y.z as numbers, or undefined for anything else (a dev build or a preview is a prerelease, x.y.z-...). */
const stable = (v) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : undefined);
const before = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * The newest stable release of app `id` at or below `version` (its x.y.z, so a dev build's version counts as
 * its own), from release tags (app/<id>@<x.y.z>): its version, or undefined before the first.
 */
export const newestStable = (tags, id, version) => {
  const at = stable(version.split('-')[0]);
  return tags
    .map((t) => (t.startsWith(`app/${id}@`) ? t.slice(`app/${id}@`.length) : ''))
    .filter((v) => stable(v) && (!at || before(stable(v), at) <= 0))
    .sort((a, b) => before(stable(a), stable(b)))
    .at(-1);
};

/** Whether an app at `version` may break its tables: it is a major past what it released (`released`). */
export const mayBreakSince = (version, released) => !!released && Number(version.split('.')[0]) > Number(released.split('.')[0]);
