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
//     things it has no rule for are FALLBACK, in app-tools. A statement a reviewer agreed the release before can
//     live with carries `-- squawk-ignore <rule>, <rule>` on the line above it, with the reason.
// The rules themselves live in app-tools (src/migrations.mjs), which apps' own repositories check with too
// (`augur-app migrations check`). Each service's migrations are the `migrations` export of its built dist/store.js: the platform's
// services in platform/services/*, and apps' own in apps/*/service.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fallback, fingerprint, gitIn, lintWith, lockOnBranch, majorReleases, mergeLocks, problemsFor as problemsWith, releasedLock } from '../platform/packages/app-tools/src/migrations.mjs';

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

/** Packages that may break their tables in this change: a major changeset waiting, or already bumped past the release. */
const allowedToBreak = () => {
  const allowed = majorReleases(root).names;
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
  const git = gitIn(root);
  const released = existsSync(join(root, RELEASE_FILE)) ? releasedLock({ git, prefix: 'augur@', version: readJson(RELEASE_FILE).version, path: LOCK }).lock : undefined;
  problems.push(...problemsFor(all, mergeLocks(released, frozenAt ? lockOnBranch({ git, ref: frozenAt, path: LOCK }) : undefined), allowedToBreak(), { frozenAt }));

  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('Migrations only add, and released ones are untouched.');
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
}
