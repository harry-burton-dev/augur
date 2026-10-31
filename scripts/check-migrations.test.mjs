// pnpm test:scripts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destructive, mergeLocks } from './check-migrations.mjs';

test('adding is fine', () => {
  assert.deepEqual(destructive('create table registry.installs (id text primary key); alter table registry.apps add column floors jsonb not null default \'[]\'; create index if not exists x on y (z);'), []);
});

test('anything the release before it could not run on is caught', () => {
  assert.deepEqual(destructive('alter table registry.apps drop column enabled'), ['drops something']);
  assert.deepEqual(destructive('alter table a rename column b to c'), ['renames something']);
  assert.deepEqual(destructive('truncate events.audit'), ['truncates a table']);
  assert.deepEqual(destructive('delete from identity.preferences where true'), ['deletes rows']);
  assert.deepEqual(destructive('alter table a alter column b type bigint'), ["changes a column's type"]);
  assert.deepEqual(destructive('alter table a alter column b set not null'), ['makes a column required']);
});

test('on dev, what dev has run counts as shipped beside the last release', () => {
  const released = { '@augur/registry': { '001_apps': 'a' } };
  const dev = { '@augur/registry': { '001_apps': 'a', '002_more': 'b' }, '@apps/notes': { '001_notes': 'c' } };
  assert.deepEqual(mergeLocks(released, dev), { '@augur/registry': { '001_apps': 'a', '002_more': 'b' }, '@apps/notes': { '001_notes': 'c' } });
  assert.deepEqual(mergeLocks(released, undefined), released);
  assert.deepEqual(Object.keys(mergeLocks(released, dev)['@augur/registry']), ['001_apps', '002_more']);
});
