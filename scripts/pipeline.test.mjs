// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPipeline, mergesFrom, releaseOf, releasePulls, stagesFrom, unitsOf } from './pipeline.mjs';

test('a release tag is of AUGUR or one app', () => {
  assert.deepEqual(releaseOf('augur@0.12.1-dev.48'), { unit: 'augur', version: '0.12.1-dev.48' });
  assert.deepEqual(releaseOf('app/mandate@0.1.4'), { unit: 'mandate', version: '0.1.4' });
  assert.equal(releaseOf('@augur/registry@0.3.0'), undefined);
});

test('a changeset moves AUGUR for its parts and an app for its own packages', () => {
  assert.deepEqual(unitsOf({ '@augur/registry': 'minor', '@apps/mandate-frontend': 'patch', '@other/x': 'patch' }, ['@augur/registry'], { '@apps/mandate-frontend': 'mandate' }), ['augur', 'mandate']);
});

test('the merges between two commits come from squash merges and merge commits', () => {
  const log = 'Merge pull request #164 from o/b\x1fUC2: AUGUR dev builds\n\nMore.\x1f2026-10-30T21:55:53+00:00\x1e\nName each AUGUR minor (#178)\x1fBody.\x1f2026-11-01T18:20:00+00:00\x1e\nVersion packages\x1f\x1f2026-10-30T20:00:00+00:00\x1e\n';
  assert.deepEqual(mergesFrom(log), [
    { number: 164, title: 'UC2: AUGUR dev builds', mergedAt: '2026-10-30T21:55:53+00:00' },
    { number: 178, title: 'Name each AUGUR minor', mergedAt: '2026-11-01T18:20:00+00:00' },
  ]);
});

test('the line waits only on the Version packages pull request into the trunk', () => {
  const pulls = releasePulls([
    { number: 1, title: 'Version packages', url: 'u1', headRefName: 'changeset-release/main', baseRefName: 'main' },
    { number: 2, title: 'Version packages (release/augur-0.14)', url: 'u2', headRefName: 'changeset-release/release/augur-0.14', baseRefName: 'release/augur-0.14' },
    { number: 4, title: 'A feature', url: 'u4', headRefName: 'feature', baseRefName: 'main' },
  ]);
  assert.deepEqual(pulls, { versionPackages: { number: 1, title: 'Version packages', url: 'u1' }, promoteToProduction: [] });
  assert.equal(releasePulls([{ number: 1, title: 'Version packages', url: 'u1', headRefName: 'changeset-release/dev', baseRefName: 'dev' }], 'dev').versionPackages.number, 1);
});

test('preview is each unit’s newest release and production its newest stable one', () => {
  const stages = stagesFrom([
    { tagName: 'augur@0.14.1-dev.3', isPrerelease: true },
    { tagName: 'augur@0.14.0', isPrerelease: true },
    { tagName: 'augur@0.13.0', isPrerelease: false },
    { tagName: 'augur@0.12.0', isPrerelease: false },
    { tagName: 'app/mandate@0.1.6-pr.20.1', isPrerelease: true },
    { tagName: 'app/mandate@0.1.5', isPrerelease: false },
    { tagName: 'app/notes@0.1.0', isPrerelease: true },
    { tagName: '@augur/registry@0.3.0', isPrerelease: false },
  ]);
  assert.deepEqual(stages, { preview: { augur: '0.14.0', mandate: '0.1.5', notes: '0.1.0' }, production: { augur: '0.13.0', mandate: '0.1.5' } });
});

test('the pipeline puts each unit on each branch, with its newest dev build, previews and what waits', () => {
  const pipeline = buildPipeline({
    generatedAt: '2026-10-30T22:00:00Z',
    repository: 'o/r',
    heads: { dev: { sha: 'aa' }, preview: { sha: 'bb' }, production: { sha: 'cc' } },
    versions: { dev: { augur: '0.13.0', mandate: '0.1.5' }, preview: { augur: '0.12.0', mandate: '0.1.4' }, production: { augur: '0.11.0' } },
    names: { augur: 'AUGUR', mandate: 'Mandate' },
    changesets: [{ id: 'dev-ring', summary: 'A third ring.\nMore.', units: ['augur'], bumps: { '@augur/registry': 'minor' } }],
    merges: { dev: [{ number: 164, title: 'UC2' }], preview: [] },
    releases: [
      { tagName: 'augur@0.13.1-dev.9' },
      { tagName: 'augur@0.13.1-dev.12', publishedAt: '2026-10-30T21:00:00Z' },
      { tagName: 'app/mandate@0.1.5-pr.20.3' },
      { tagName: 'app/mandate@0.1.5-pr.20.4' },
      { tagName: 'app/mandate@0.1.5-pr.21.1' },
    ],
  });
  assert.equal(pipeline.schema, 'augur.pipeline/v1');
  assert.deepEqual(pipeline.branches.map((b) => b.name), ['dev', 'preview', 'production']);
  const [augur, mandate] = pipeline.units;
  assert.deepEqual(augur, { id: 'augur', name: 'AUGUR', versions: { dev: '0.13.0', preview: '0.12.0', production: '0.11.0' }, devBuild: { version: '0.13.1-dev.12', released: '2026-10-30T21:00:00Z' }, waiting: ['dev-ring'], previews: [] });
  assert.deepEqual(mandate.versions, { dev: '0.1.5', preview: '0.1.4', production: null });
  assert.deepEqual(mandate.previews, [{ pr: 21, version: '0.1.5-pr.21.1' }, { pr: 20, version: '0.1.5-pr.20.4' }]);
  assert.deepEqual(pipeline.changesets, [{ id: 'dev-ring', summary: 'A third ring.', units: ['augur'], bumps: { '@augur/registry': 'minor' } }]);
  assert.deepEqual(pipeline.steps, [
    { from: 'dev', to: 'preview', merged: 1, pulls: [{ number: 164, title: 'UC2' }] },
    { from: 'preview', to: 'production', merged: 0, pulls: [] },
  ]);
});
