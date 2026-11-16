// The migration rules an app shares with AUGUR (ADR 0053): its lock, what it released and when it may break.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { appLockOf, appLockText, fingerprint, mayBreakSince, newestStable, problemsFor, SQUAWK_CONFIG } from './migrations.mjs';

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
  assert.equal(newestStable(tags, 'notes', '1.10.3'), '1.10.0');
  assert.equal(newestStable(tags, 'notes', '1.11.0-dev.5'), '1.10.0');
  assert.equal(newestStable(tags, 'notes', '2.0.0'), '2.0.0');
  assert.equal(newestStable(tags, 'notes', '1.0.0'), undefined);
  assert.equal(newestStable([], 'notes', '0.0.0'), undefined);
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
  symlinkSync(squawk, join(dir, 'node_modules/.bin/squawk'));
  writeFileSync(join(dir, 'service/src/migrations.ts'), '');
  manifestAt('0.1.0');
  built(migrations.slice(0, 1));
  const bin = new URL('../bin/augur-app.mjs', import.meta.url).pathname;
  const cli = (...args) => execFileSync('node', [bin, 'migrations', ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: dir, stdio: 'pipe' });

  assert.throws(() => cli('check'), /migrations.lock.json doesn’t match/);
  assert.match(cli('sync'), /Wrote service\/migrations.lock.json/);
  git('init', '--quiet');
  git('add', 'manifest.json', 'service');
  git('commit', '--quiet', '-m', 'release');
  git('tag', 'app/notes@0.1.0');
  git('remote', 'add', 'origin', dir);
  assert.match(cli('check'), /since notes 0.1.0/);

  built([{ ...migrations[0], sql: 'create table kept_events (id uuid primary key);' }]);
  cli('sync');
  assert.throws(() => cli('check'), /001_kept_events changed after it shipped/);

  built([migrations[0], { id: '002_drop', sql: 'alter table kept_events drop column id;' }]);
  cli('sync');
  assert.throws(() => cli('check'), /002_drop does what the release before it can't run on/);
  manifestAt('1.0.0');
  assert.match(cli('check'), /2 migrations/);
});
