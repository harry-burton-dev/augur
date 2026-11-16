// Keeps database migrations safe to upgrade over and to roll back from.
//   node scripts/check-migrations.mjs sync    after adding a migration: writes release/migrations.lock.json
//   node scripts/check-migrations.mjs check   in CI, after `pnpm build`: fails when a rule is broken
//
// The rules:
//   - a migration that shipped in an AUGUR release never changes and is never removed: servers have run it.
//     Add a new migration instead. On a pull request into main, one already on main counts as shipped too
//     (MIGRATIONS_FROZEN_AT=origin/main): the workbench has run it, from a dev build.
//   - within a major version, migrations only add. A new one that drops, renames, truncates, deletes rows,
//     changes a column's type or makes one required would break the release before it, which is what a
//     deployment rolls back to. It needs a major bump of its service (a major changeset), so the AUGUR
//     release is breaking and nobody can skip the release before it.
//     Squawk lints each migration that hasn't shipped, with the rules in .squawk.toml (ADR 0053). The few
//     things it has no rule for are FALLBACK below. A statement a reviewer agreed the release before can
//     live with carries `-- squawk-ignore <rule>, <rule>` on the line above it, with the reason.
// The rules themselves live in app-tools (src/migrations.mjs), which apps' own repositories check with too
// (`augur-app migrations check`). Each service's migrations are the `migrations` export of its built dist/store.js: the platform's
// services in platform/services/*, and apps' own in apps/*/service.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fallback, fingerprint, lintWith, mergeLocks, problemsFor as problemsWith } from '../platform/packages/app-tools/src/migrations.mjs';

export { fallback, mergeLocks };

const root = fileURLToPath(new URL('..', import.meta.url));
const LOCK = 'release/migrations.lock.json';
const RELEASE_FILE = 'release/augur-release.json';
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** Squawk, as `pnpm install` puts it in the root's node_modules (squawk-cli, ADR 0053). */
export const lint = lintWith({ squawk: join(root, 'node_modules/.bin/squawk'), config: join(root, '.squawk.toml') });

/** What's wrong with the platform's migrations (app-tools' problemsFor), linted with the platform's Squawk unless `lint` is given. */
export const problemsFor = (all, released, mayBreak, options = {}) => problemsWith(all, released, mayBreak, { lint, ...options });

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
  problems.push(...problemsFor(all, mergeLocks(releasedLock(), frozenAt ? lockAt(frozenAt) : undefined), allowedToBreak(), { frozenAt }));

  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('Migrations only add, and released ones are untouched.');
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
