// pnpm test:scripts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destructive } from './check-migrations.mjs';

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
