// Keeps database migrations safe to upgrade over and to roll back from.
//   node scripts/check-migrations.mjs sync    after adding a migration: writes release/migrations.lock.json
//   node scripts/check-migrations.mjs check   in CI, after `pnpm build`: fails when a rule is broken
//
// The rules:
//   - a migration that shipped in an AUGUR release never changes and is never removed: servers have run it.
//     Add a new migration instead. On a pull request into dev, one already on dev counts as shipped too
//     (MIGRATIONS_FROZEN_AT=origin/dev): the preview server has run it, from a dev build.
//   - within a major version, migrations only add. A new one that drops, renames, truncates, deletes rows,
//     changes a column's type or makes one required would break the release before it, which is what a
//     deployment rolls back to. It needs a major bump of its service (a major changeset), so the AUGUR
//     release is breaking and nobody can skip the release before it.
//     Squawk lints each migration that hasn't shipped, with the rules in .squawk.toml (ADR 0053). The few
//     things it has no rule for are FALLBACK below. A statement a reviewer agreed the release before can
//     live with carries `-- squawk-ignore <rule>, <rule>` on the line above it, with the reason.
// Each service's migrations are the `migrations` export of its built dist/store.js: the platform's
// services in platform/services/*, and apps' own in apps/*/service.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const LOCK = 'release/migrations.lock.json';
const RELEASE_FILE = 'release/augur-release.json';
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

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

/** Squawk, as `pnpm install` puts it in the root's node_modules (squawk-cli, ADR 0053). */
const SQUAWK = join(root, 'node_modules/.bin/squawk');

/**
 * Lints migrations ([{ name, id, sql }]) with Squawk and the fallback rules: { "<name> <id>": [{ rule, line,
 * message }] }, an entry for each one given. Throws when Squawk can't run, so no migration goes unlinted.
 */
export const lint = (migrations) => {
  const key = (m) => `${m.name} ${m.id}`;
  const found = Object.fromEntries(migrations.map((m) => [key(m), fallback(m.sql)]));
  if (!migrations.length) return found;
  if (!existsSync(SQUAWK)) throw new Error("Squawk isn't installed, so new migrations can't be checked. Run: pnpm install");
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  try {
    const files = migrations.map((_, i) => join(dir, `${i}.sql`));
    migrations.forEach((m, i) => writeFileSync(files[i], m.sql));
    const run = spawnSync(SQUAWK, ['--config', join(root, '.squawk.toml'), '--reporter', 'json', ...files], { encoding: 'utf8' });
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

const fingerprint = (sql) => createHash('sha256').update(sql.trim()).digest('hex').slice(0, 16);

/** Every service's folder: the platform's, then each app's. */
const serviceDirs = () => [
  ...readdirSync(join(root, 'platform/services'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(root, 'platform/services', d.name)),
  ...readdirSync(join(root, 'apps'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(root, 'apps', d.name, 'service')).filter((p) => existsSync(p)),
];

/** Every service's migrations, in order: { "@augur/registry": [{ id, hash, sql }] }. */
const readMigrations = async () => {
  const all = {};
  for (const path of serviceDirs()) {
    const where = path.slice(root.length);
    const store = join(path, 'dist/store.js');
    if (!existsSync(join(path, 'src/store.ts'))) continue;
    if (!existsSync(store)) throw new Error(`${where} isn't built: run pnpm build first.`);
    const { migrations } = await import(pathToFileURL(store).href);
    if (!migrations) {
      // A service that keeps a migrations table must show its migrations, or they'd go unchecked.
      if (/\.migrations \(|runMigrations\(/.test(readFileSync(join(path, 'src/store.ts'), 'utf8'))) throw new Error(`${where}'s src/store.ts runs migrations but doesn't export them as \`migrations\`.`);
      continue;
    }
    const { name } = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
    all[name] = migrations.map((m) => ({ id: m.id, hash: fingerprint(m.sql), sql: m.sql }));
  }
  return all;
};

const lockOf = (all) => Object.fromEntries(Object.entries(all).map(([name, list]) => [name, Object.fromEntries(list.map((m) => [m.id, m.hash]))]));

/** `a` and `b` (x.y.z) compared, as for sort. */
const byVersion = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

/** The newest stable AUGUR release tag at or below `version`, fetched if need be; undefined before the first. */
const releaseTag = (version, git) => {
  try {
    git('rev-parse', '--verify', '--quiet', `refs/tags/augur@${version}`);
    return `augur@${version}`;
  } catch {
    // not here: look on origin, and take the release before when this one has no tag yet
  }
  let tags;
  try {
    tags = git('ls-remote', '--tags', '--refs', 'origin', 'refs/tags/augur@*')
      .split('\n')
      .map((l) => l.split('refs/tags/augur@')[1])
      .filter((v) => v && /^\d+\.\d+\.\d+$/.test(v) && byVersion(v, version) <= 0)
      .sort(byVersion);
  } catch {
    return undefined;
  }
  const newest = tags.at(-1);
  if (!newest) return undefined; // not released yet
  try {
    git('fetch', '--quiet', '--depth=1', 'origin', `refs/tags/augur@${newest}:refs/tags/augur@${newest}`);
    return `augur@${newest}`;
  } catch {
    return undefined;
  }
};

/** The lock as of the last AUGUR release, or undefined before the first one. */
const releasedLock = () => {
  if (!existsSync(join(root, RELEASE_FILE))) return undefined;
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const tag = releaseTag(readJson(RELEASE_FILE).version, git);
  if (!tag) return undefined;
  try {
    return JSON.parse(git('show', `${tag}:${LOCK}`));
  } catch {
    return undefined; // released before migrations were locked
  }
};

/** The lock on `ref` (such as origin/dev), fetched if need be; undefined when it has none. */
const lockAt = (ref) => {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const branch = ref.replace(/^origin\//, '');
  try {
    git('fetch', '--quiet', '--depth=1', 'origin', `${branch}:refs/remotes/origin/${branch}`);
  } catch {
    // already fetched, or not there
  }
  try {
    return JSON.parse(git('show', `${ref}:${LOCK}`));
  } catch {
    return undefined;
  }
};

/** Every lock entry in `a` or `b`. */
export const mergeLocks = (a = {}, b = {}) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((name) => [name, { ...(a[name] ?? {}), ...(b[name] ?? {}) }]));

/** Packages that may break their tables in this change: a major changeset waiting, or already bumped past the release. */
const allowedToBreak = () => {
  const allowed = new Set();
  const dir = mkdtempSync(join(tmpdir(), 'changesets-'));
  try {
    execFileSync('pnpm', ['changeset', 'status', `--output=${join(dir, 'status.json')}`], { cwd: root, stdio: 'ignore' });
    for (const r of JSON.parse(readFileSync(join(dir, 'status.json'), 'utf8')).releases ?? []) if (r.type === 'major') allowed.add(r.name);
  } catch {
    // no changesets waiting
  }
  if (existsSync(join(root, RELEASE_FILE))) {
    const released = readJson(RELEASE_FILE).parts;
    for (const dir of serviceDirs()) {
      const pkg = join(dir, 'package.json');
      if (!existsSync(pkg)) continue;
      const { name, version } = JSON.parse(readFileSync(pkg, 'utf8'));
      const was = released[name]?.version;
      if (was && Number(version.split('.')[0]) > Number(was.split('.')[0])) allowed.add(name);
    }
  }
  return allowed;
};

/**
 * What's wrong with the migrations `all` ({ name: [{ id, hash, sql }] }) given what has shipped (`released`,
 * a lock) and the services that may break their tables (`mayBreak`, a Set of names). `lint` finds what each
 * migration that hasn't shipped does that the release before can't live with; `frozenAt` names the branch
 * whose migrations count as shipped too, for the messages.
 */
export const problemsFor = (all, released, mayBreak, { lint: lintWith = lint, frozenAt } = {}) => {
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
  const found = lintWith(fresh);
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

const main = async () => {
  const mode = process.argv[2];
  const all = await readMigrations();
  const lock = `${JSON.stringify(lockOf(all), null, 2)}\n`;
  if (mode === 'sync') {
    writeFileSync(join(root, LOCK), lock);
    return console.log(`Wrote ${LOCK}.`);
  }
  if (mode !== 'check') {
    console.error('Usage: node scripts/check-migrations.mjs sync|check');
    process.exit(2);
  }

  const problems = [];
  if (!existsSync(join(root, LOCK)) || readFileSync(join(root, LOCK), 'utf8') !== lock) problems.push(`${LOCK} doesn't match the migrations. Run: pnpm build && node scripts/check-migrations.mjs sync`);
  const frozenAt = process.env.MIGRATIONS_FROZEN_AT;
  problems.push(...problemsFor(all, mergeLocks(releasedLock(), frozenAt ? lockAt(frozenAt) : undefined), allowedToBreak(), { frozenAt }));

  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('Migrations only add, and released ones are untouched.');
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
