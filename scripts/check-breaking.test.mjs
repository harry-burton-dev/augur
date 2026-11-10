import { test } from 'node:test';
import assert from 'node:assert/strict';
import { majorOf, saysNotBreaking, verdict } from './check-breaking.mjs';

const spec = (version) => `openapi: 3.1.0\ninfo:\n  title: X\n  version: ${version}\npaths: {}\n`;

test('reads the major of a contract', () => {
  assert.equal(majorOf(spec('1.4.0')), 1);
  assert.equal(majorOf(spec('12.0.1')), 12);
  assert.equal(majorOf('openapi: 3.1.0\n'), undefined);
});

test('a new contract, or one moving to a new major, is not compared', () => {
  assert.deepEqual(verdict({ base: null, head: spec('1.0.0'), file: 'x.openapi.yaml', changesets: [] }), { check: false, why: 'new' });
  assert.equal(verdict({ base: spec('1.4.0'), head: spec('2.0.0'), file: 'x.openapi.yaml', changesets: [] }).check, false);
});

test('within a major a contract is compared, and a break is allowed only when a changeset says why for that file', () => {
  assert.deepEqual(verdict({ base: spec('1.3.0'), head: spec('1.4.0'), file: 'x.openapi.yaml', changesets: [] }), { check: true, allowed: false });
  const sets = ['---\n"@augur/x": minor\n---\n\nAdds a route.\n\nNot breaking: x.openapi.yaml documents what the service always sent.\n'];
  assert.deepEqual(verdict({ base: spec('1.3.0'), head: spec('1.4.0'), file: 'x.openapi.yaml', changesets: sets }), { check: true, allowed: true });
  assert.equal(saysNotBreaking(sets, 'y.openapi.yaml'), false);
  assert.equal(saysNotBreaking(['Not breaking, x.openapi.yaml'], 'x.openapi.yaml'), false);
});
