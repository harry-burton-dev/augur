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
// Each service's migrations are the `migrations` export of its built dist/store.js: the platform's
// services in platform/services/*, and apps' own in apps/*/service.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const LOCK = 'release/migrations.lock.json';
const RELEASE_FILE = 'release/augur-release.json';
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** What a migration would do that the release before it can't live with. */
export const DESTRUCTIVE = [
  [/\bdrop\s+(table|column|schema|view|type|function|constraint)\b/i, 'drops something'],
  [/\brename\s+(to|column|constraint)\b/i, 'renames something'],
  [/\btruncate\b/i, 'truncates a table'],
  [/\bdelete\s+from\b/i, 'deletes rows'],
  [/\balter\s+column\s+\S+\s+(set\s+data\s+)?type\b/i, "changes a column's type"],
  [/\bset\s+not\s+null\b/i, 'makes a column required'],
];

export const destructive = (sql) => DESTRUCTIVE.filter(([pattern]) => pattern.test(sql)).map(([, what]) => what);

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
      if (/\.migrations \(/.test(readFileSync(join(path, 'src/store.ts'), 'utf8'))) throw new Error(`${where}'s src/store.ts runs migrations but doesn't export them as \`migrations\`.`);
      continue;
    }
    const { name } = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
    all[name] = migrations.map((m) => ({ id: m.id, hash: fingerprint(m.sql), sql: m.sql }));
  }
  return all;
};

const lockOf = (all) => Object.fromEntries(Object.entries(all).map(([name, list]) => [name, Object.fromEntries(list.map((m) => [m.id, m.hash]))]));

/** The lock as of the last AUGUR release, or undefined before the first one. */
const releasedLock = () => {
  if (!existsSync(join(root, RELEASE_FILE))) return undefined;
  const tag = `augur@${readJson(RELEASE_FILE).version}`;
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}`);
  } catch {
    try {
      git('fetch', '--quiet', '--depth=1', 'origin', `refs/tags/${tag}:refs/tags/${tag}`);
    } catch {
      return undefined; // not released yet
    }
  }
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
  const released = mergeLocks(releasedLock(), frozenAt ? lockAt(frozenAt) : undefined);
  const mayBreak = allowedToBreak();
  for (const [name, list] of Object.entries(all)) {
    const shipped = released[name] ?? {};
    const ids = list.map((m) => m.id);
    for (const [id, hash] of Object.entries(shipped)) {
      const now = list.find((m) => m.id === id);
      if (!now) problems.push(`${name}: migration ${id} shipped${frozenAt ? ` (in a release or on ${frozenAt})` : ' in a release'} and is gone. Servers have run it; put it back.`);
      else if (now.hash !== hash) problems.push(`${name}: migration ${id} changed after it shipped${frozenAt ? ` (in a release or on ${frozenAt})` : ' in a release'}. Servers have run the old one; put it back and add a new migration.`);
    }
    const shippedIds = Object.keys(shipped);
    if (ids.slice(0, shippedIds.length).join() !== shippedIds.join()) problems.push(`${name}: new migrations must come after the released ones (${shippedIds.join(', ')}).`);
    for (const m of list.filter((m) => !(m.id in shipped))) {
      const what = destructive(m.sql);
      if (what.length && !mayBreak.has(name))
        problems.push(`${name}: migration ${m.id} ${what.join(' and ')}, which the release before it can't run on. Migrations only add within a major version: add the new thing now and remove the old one in a later major, or make this a major changeset for ${name}.`);
    }
  }

  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('Migrations only add, and released ones are untouched.');
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
