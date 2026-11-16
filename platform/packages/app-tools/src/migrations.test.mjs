// The migration rules an app shares with AUGUR (ADR 0053): its lock, what it released and when it may break.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { appLockOf, appLockText, fingerprint, majorChangesets, mayBreakSince, mergeAppLocks, mergeLocks, newestStable, problemsFor, SQUAWK_CONFIG } from './migrations.mjs';

const migrations = [
  { id: '001_kept_events', sql: 'create table kept_events (id text primary key);' },
  { id: '002_kept_at', sql: 'alter table kept_events add column kept_at timestamptz;' },
];
const noLint = (list) => Object.fromEntries(list.map((m) => [`${m.name} ${m.id}`, []]));
const all = (list) => ({ notes: list.map((m) => ({ ...m, hash: fingerprint(m.sql) })) });

test('an app’s lock names each migration in order, with its fingerprint', () => {
  assert.deepEqual(Object.keys(appLockOf(migrations)), ['001_kept_events', '002_kept_at']);
  assert.equal(appLockOf(migrations)['001_kept_events'], fingerprint(migrations[0].sql));
  assert.ok(appLockText(migrations).endsWith('}\n'));
});

test('what shipped is the newest stable release at or below the app’s version, never a dev build or a preview', () => {
  const tags = ['app/notes@1.2.0', 'app/notes@1.10.0', 'app/notes@1.11.0-dev.4', 'app/notes@2.0.0', 'app/other@9.0.0', 'kit@3.0.0'];
  assert.equal(newestStable(tags, 'app/notes@', '1.10.3'), 'app/notes@1.10.0');
  assert.equal(newestStable(tags, 'app/notes@', '1.11.0-dev.5'), 'app/notes@1.10.0');
  assert.equal(newestStable(tags, 'app/notes@', '2.0.0'), 'app/notes@2.0.0');
  assert.equal(newestStable(tags, 'app/notes@', '1.0.0'), undefined);
  assert.equal(newestStable(tags, 'kit@', '9.0.0'), 'kit@3.0.0');
  assert.equal(newestStable([], 'app/notes@', '0.0.0'), undefined);
});

test('an app may break its tables only when it goes up a major past what it released', () => {
  assert.equal(mayBreakSince('2.0.0', '1.4.0'), true);
  assert.equal(mayBreakSince('1.5.0', '1.4.0'), false);
  assert.equal(mayBreakSince('1.0.0', undefined), false);
});

test('a migration that shipped can’t change or go, and a new one comes after it', () => {
  const shipped = { notes: appLockOf(migrations.slice(0, 1)) };
  assert.deepEqual(problemsFor(all(migrations), shipped, new Set(), { lint: noLint }), []);
  const changed = [{ ...migrations[0], sql: 'create table kept_events (id uuid primary key);' }, migrations[1]];
  assert.match(problemsFor(all(changed), shipped, new Set(), { lint: noLint }).join('\n'), /001_kept_events changed after it shipped/);
  assert.match(problemsFor(all(migrations.slice(1)), shipped, new Set(), { lint: noLint }).join('\n'), /001_kept_events shipped in a release and is gone/);
});

test('a new migration the release before can’t run on fails, unless the app may break its tables', () => {
  const lint = (list) => Object.fromEntries(list.map((m) => [`${m.name} ${m.id}`, [{ rule: 'ban-drop-column', line: 1, message: 'Dropping a column' }]]));
  const dropped = [migrations[0], { id: '002_drop', sql: 'alter table kept_events drop column id;' }];
  const shipped = { notes: appLockOf(migrations.slice(0, 1)) };
  assert.match(problemsFor(all(dropped), shipped, new Set(), { lint, frozenAt: 'origin/main' }).join('\n'), /002_drop does what the release before it can't run on/);
  assert.deepEqual(problemsFor(all(dropped), shipped, new Set(['notes']), { lint }), []);
});

test('where a released lock and the frozen branch disagree, the released fingerprint wins: servers ran it', () => {
  assert.deepEqual(mergeAppLocks({ '001': 'released' }, { '001': 'changed', '002': 'new' }), { '001': 'released', '002': 'new' });
  assert.deepEqual(mergeLocks({ s: { '001': 'released' } }, { s: { '001': 'changed' } }), { s: { '001': 'released' } });
  assert.deepEqual(mergeAppLocks(undefined, undefined), {});
});

test('a waiting changeset that takes a package up a major is found, quoted or not', () => {
  const dir = mkdtempSync(join(tmpdir(), 'changesets-'));
  mkdirSync(join(dir, '.changeset'));
  writeFileSync(join(dir, '.changeset/README.md'), '---\n"@x/readme": major\n---\n');
  writeFileSync(join(dir, '.changeset/a.md'), '---\n"@apps/notes": major\n"@apps/notes-frontend": minor\n---\n\nDrops a column.\n');
  writeFileSync(join(dir, '.changeset/b.md'), "---\n'@apps/other': 'major'\n---\n");
  writeFileSync(join(dir, '.changeset/c.md'), '---\n---\n');
  assert.deepEqual([...majorChangesets(dir)].sort(), ['@apps/notes', '@apps/other']);
  assert.deepEqual([...majorChangesets(join(dir, 'none'))], []);
});

test('an app is held to AUGUR’s own Squawk rules', () => {
  const rules = (text) => text.replace(/^#[^\n]*\n/gm, '');
  assert.equal(rules(readFileSync(SQUAWK_CONFIG, 'utf8')), rules(readFileSync(new URL('../../../../.squawk.toml', import.meta.url), 'utf8')));
});

const squawk = new URL('../../../../node_modules/.bin/squawk', import.meta.url).pathname;

test('augur-app migrations: sync writes the lock, and check holds what the newest stable release shipped', { skip: !existsSync(squawk) && 'Squawk isn’t installed at the repository’s root' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'app-migrations-'));
  const manifestAt = (version) => writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ id: 'notes', version }));
  const built = (list) => writeFileSync(join(dir, 'service/dist/migrations.js'), `export const MIGRATIONS = ${JSON.stringify(list)};`);
  mkdirSync(join(dir, 'service/src'), { recursive: true });
  mkdirSync(join(dir, 'service/dist'));
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true });
  // pnpm's .bin entry finds Squawk from where it sits, so the app's runs the repository's by its own path.
  writeFileSync(join(dir, 'node_modules/.bin/squawk'), `#!/bin/sh\nexec "${squawk}" "$@"\n`, { mode: 0o755 });
  mkdirSync(join(dir, '.changeset'));
  writeFileSync(join(dir, 'service/src/migrations.ts'), '');
  manifestAt('0.1.0');
  built(migrations.slice(0, 1));
  const bin = new URL('../bin/augur-app.mjs', import.meta.url).pathname;
  const cli = (...args) => execFileSync('node', [bin, 'migrations', ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: dir, stdio: 'pipe' });

  git('init', '--quiet');
  git('remote', 'add', 'origin', dir);
  assert.throws(() => cli('check'), /migrations.lock.json doesn’t match/);
  assert.match(cli('sync'), /Wrote service\/migrations.lock.json/);
  assert.match(cli('check'), /no stable release yet/);
  git('add', 'manifest.json', 'service');
  git('commit', '--quiet', '-m', 'release');
  git('tag', 'app/notes@0.1.0');
  assert.match(cli('check'), /since notes 0.1.0/);

  built([{ ...migrations[0], sql: 'create table kept_events (id uuid primary key);' }]);
  cli('sync');
  assert.throws(() => cli('check'), /001_kept_events changed after it shipped/);

  built([migrations[0], { id: '002_drop', sql: 'alter table kept_events drop column id;' }]);
  cli('sync');
  assert.throws(() => cli('check'), /002_drop does what the release before it can't run on/);
  writeFileSync(join(dir, '.changeset/drop.md'), '---\n"@apps/notes": major\n---\n');
  assert.throws(() => cli('check'), /002_drop does what the release before it can't run on/, 'a major for another package isn’t this app’s');
  writeFileSync(join(dir, 'service/package.json'), JSON.stringify({ name: '@apps/notes' }));
  assert.match(cli('check'), /2 migrations/);
  rmSync(join(dir, '.changeset/drop.md'));
  manifestAt('1.0.0');
  assert.match(cli('check'), /2 migrations.*since notes 0.1.0/);

  // Migrations that move out of service/src/migrations.ts still have to account for the ones that shipped.
  rmSync(join(dir, 'service/src/migrations.ts'));
  assert.throws(() => cli('check'), /001_kept_events shipped in a release and is gone/);

  // A check that can't read what shipped fails rather than passing on nothing.
  git('remote', 'set-url', 'origin', join(dir, 'nowhere'));
  writeFileSync(join(dir, 'service/src/migrations.ts'), '');
  assert.throws(() => cli('check'), /git ls-remote failed/);
});
