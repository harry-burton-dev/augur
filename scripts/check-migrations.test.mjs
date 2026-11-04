// pnpm test:scripts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fallback, lint, mergeLocks, problemsFor } from './check-migrations.mjs';

/** The rules Squawk and the fallback find in one statement. */
const rules = (sql) => lint([{ name: 'svc', id: '001', sql }])['svc 001'].map((f) => f.rule);

test('adding is fine', () => {
  assert.deepEqual(
    rules(
      "create table registry.installs (id text primary key, n int, at timestamptz not null default now()); alter table registry.apps add column floors jsonb not null default '[]'; alter table registry.apps add column note text; create index if not exists x on registry.apps (floors); create unique index y on registry.installs (n) where n is not null; update registry.apps set floors = '[\"o\"]' where floors = '[]'",
    ),
    [],
  );
});

test('anything the release before it could not run on is caught', () => {
  // What the regex guard missed (PER-214), then what it caught.
  assert.deepEqual(rules('alter table a drop b'), ['ban-drop-column']);
  assert.deepEqual(rules('alter table a rename b to c'), ['renaming-column']);
  assert.deepEqual(rules('alter table a alter b type int'), ['changing-column-type']);
  assert.deepEqual(rules('drop index registry.x'), ['ban-drop-index']);
  assert.deepEqual(rules('update identity.preferences set prefs = \'{}\''), ['augur-bulk-update']);
  assert.deepEqual(rules('alter table a add column b text not null'), ['adding-required-field']);
  assert.deepEqual(rules('alter table registry.apps drop column enabled'), ['ban-drop-column']);
  assert.deepEqual(rules('alter table a rename column b to c'), ['renaming-column']);
  assert.deepEqual(rules('alter table a rename to b'), ['renaming-table']);
  assert.deepEqual(rules('drop table a'), ['ban-drop-table']);
  assert.deepEqual(rules('truncate events.audit'), ['augur-truncate']);
  assert.deepEqual(rules('delete from identity.preferences where true'), ['augur-delete-rows']);
  assert.deepEqual(rules('alter table a alter column b type bigint'), ['changing-column-type']);
  assert.deepEqual(rules('alter table a alter column b set not null'), ['adding-not-nullable-field']);
  assert.deepEqual(rules('alter table a alter column b drop default'), ['ban-drop-default']);
  assert.deepEqual(rules('alter table a add constraint c check (b > 0)'), ['constraint-missing-not-valid']);
});

test('a reviewed statement can be let through by name, and only that statement', () => {
  const sql = `
    -- The unique index below takes its place.
    -- squawk-ignore ban-drop-index
    drop index registry.x;
    create unique index x on registry.t (a, b);
    -- squawk-ignore augur-bulk-update
    update registry.t set c = a;
    update registry.t set d = a`;
  assert.deepEqual(
    lint([{ name: 'svc', id: '001', sql }])['svc 001'].map((f) => [f.rule, f.line]),
    [['augur-bulk-update', 8]],
  );
  assert.deepEqual(rules('-- squawk-ignore-file augur-truncate, ban-drop-table\ntruncate a; drop table a; drop table b'), []);
  assert.deepEqual(rules('-- squawk-ignore ban-drop-column\nalter table a drop column b;\nalter table a drop column c'), ['ban-drop-column']);
});

test('the fallback reads only what Squawk has no rule for, in statements, not comments', () => {
  assert.deepEqual(fallback('-- delete from a, once\ncreate table a (id text)'), []);
  assert.deepEqual(fallback("insert into a values ('truncate')"), []);
  assert.deepEqual(fallback('create table a (id text);\n\ndelete from a').map((f) => [f.rule, f.line]), [['augur-delete-rows', 3]]);
});

const hash = (s) => s;
const service = (...list) => list.map(([id, sql]) => ({ id, hash: hash(sql), sql }));
const noLint = () => ({});

test('a shipped migration that changed, went or moved is a problem', () => {
  const all = { '@augur/registry': service(['001_apps', 'create table a (id text)'], ['002_more', 'x2'], ['003_new', 'x3']) };
  assert.deepEqual(problemsFor(all, { '@augur/registry': { '001_apps': 'create table a (id text)', '002_more': 'x2' } }, new Set(), { lint: noLint }), []);
  const [changed] = problemsFor(all, { '@augur/registry': { '001_apps': 'old', '002_more': 'x2' } }, new Set(), { lint: noLint });
  assert.match(changed, /001_apps changed after it shipped in a release/);
  const [gone] = problemsFor(all, { '@augur/registry': { '000_gone': 'g' } }, new Set(), { lint: noLint, frozenAt: 'origin/main' });
  assert.match(gone, /000_gone shipped \(in a release or on origin\/main\) and is gone/);
  const moved = problemsFor(all, { '@augur/registry': { '002_more': 'x2' } }, new Set(), { lint: noLint });
  assert.ok(moved.some((p) => /must come after the released ones \(002_more\)/.test(p)));
});

test('only migrations that have not shipped are linted, and a major changeset lets them break', () => {
  const all = { '@augur/registry': service(['001_apps', 'drop table old'], ['002_drop', 'alter table a drop column b']) };
  const released = { '@augur/registry': { '001_apps': 'drop table old' } };
  const [problem, ...rest] = problemsFor(all, released, new Set());
  assert.deepEqual(rest, []);
  assert.match(problem, /@augur\/registry: migration 002_drop does what the release before it can't run on/);
  assert.match(problem, /line 1, ban-drop-column/);
  assert.match(problem, /major changeset for @augur\/registry/);
  assert.match(problem, /squawk-ignore/);
  let linted;
  assert.deepEqual(problemsFor(all, released, new Set(['@augur/registry']), { lint: (list) => ((linted = list), {}) }), []);
  assert.deepEqual(linted, []);
});

test('on dev, what dev has run counts as shipped beside the last release', () => {
  const released = { '@augur/registry': { '001_apps': 'a' } };
  const dev = { '@augur/registry': { '001_apps': 'a', '002_more': 'b' }, '@apps/notes': { '001_notes': 'c' } };
  assert.deepEqual(mergeLocks(released, dev), { '@augur/registry': { '001_apps': 'a', '002_more': 'b' }, '@apps/notes': { '001_notes': 'c' } });
  assert.deepEqual(mergeLocks(released, undefined), released);
  assert.deepEqual(Object.keys(mergeLocks(released, dev)['@augur/registry']), ['001_apps', '002_more']);
});
