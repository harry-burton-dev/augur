// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { haltedOf } from './publish-feed.mjs';
import { haltProblem, haltRecord, tagOf } from './halt.mjs';

const ok = { mode: 'halt', unit: 'augur', version: '0.14.0', reason: 'Sign-in fails', actor: 'harry', owner: 'harry' };

test('only the owner halts, with a reason, a real unit and a version', () => {
  assert.equal(haltProblem(ok), undefined);
  assert.match(haltProblem({ ...ok, actor: 'someone' }), /Only the repository's owner/);
  assert.match(haltProblem({ ...ok, reason: ' ' }), /Say why/);
  assert.match(haltProblem({ ...ok, version: 'latest' }), /not a version/);
  assert.match(haltProblem({ ...ok, unit: 'Bad Unit' }), /not a unit/);
  assert.equal(haltProblem({ ...ok, mode: 'resume', reason: '' }), undefined);
});

test('the record it writes is the one the feed reads', () => {
  assert.equal(tagOf('augur', '0.14.0'), 'augur@0.14.0');
  assert.equal(tagOf('mandate', '0.2.0'), 'app/mandate@0.2.0');
  const record = haltRecord({ reason: ' Sign-in fails ', actor: 'harry', at: '2026-11-01T20:00:00Z', run: '7' });
  assert.deepEqual(haltedOf(record), { reason: 'Sign-in fails', at: '2026-11-01T20:00:00Z', by: 'harry' });
});
