// The contract-3 schemas against the spec's fixtures: the example app passes, each broken file is refused
// with the reason the spec's check printed, and a release built from the example is valid.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { APP_RELEASE_2_SCHEMA, appRelease2, asksOf2, pinImages } from './release2.mjs';
import { contractValidators, parseWorkload, partProblems, validateApp } from './validate.mjs';

const fixtures = new URL('../fixtures/', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, fixtures), 'utf8'));
const readPart = (path) => parseWorkload(readFileSync(new URL(path, fixtures), 'utf8'));

const manifest = read('notes/manifest.json');
const partFiles = readdirSync(new URL('notes/score/', fixtures)).sort();
const parts = partFiles.map((f) => readPart(`notes/score/${f}`));
const digest = `sha256:${'2b'.repeat(32)}`;
const signer = { repository: 'example-org/augur-notes', workflow: '.github/workflows/release.yml' };

test('the example app is a valid contract-3 app: its manifest and each part, against Score and AUGUR', () => {
  const v = contractValidators();
  assert.deepEqual(v.manifest(manifest), []);
  for (const p of parts) assert.deepEqual(partProblems(p), [], p.metadata.name);
  assert.deepEqual(validateApp({ manifest, parts: Object.fromEntries(partFiles.map((f, i) => [`score/${f}`, parts[i]])) }), { ok: true, problems: [] });
});

// The first problem each broken file is refused for, as the spec's check printed it (section 18).
const refusals = {
  'manifest-absolute-entry.json': '/frontend/entry must match pattern',
  'manifest-bad-scope.json': '/scopes/4 must match pattern',
  'manifest-no-contract.json': 'must have required propert',
  'manifest-radial-no-command.json': '/contributes/radial/0 must have required propert',
  'manifest-secret-default.json': '/contributes/settings/4 must match "then" schema',
  'score-host-volume.score.yaml': '/containers/worker/volumes/~1data/source must match pattern',
  'score-no-limits.score.yaml': '/containers/worker must have required propert',
  'score-service-no-port.score.yaml': 'must match "then" schema',
  'score-two-containers.score.yaml': '/containers must not have more than 1 properties',
  'score-unknown-resource.score.yaml': '/resources/db/type must be equal to one of the allowed values',
};

for (const file of readdirSync(new URL('invalid/', fixtures)).sort()) {
  test(`invalid/${file} is refused, saying why`, () => {
    const problems = file.endsWith('.json') ? contractValidators().manifest(read(`invalid/${file}`)) : contractValidators().part(readPart(`invalid/${file}`));
    assert.ok(problems.length > 0, 'accepted, but should not be');
    assert.ok(refusals[file], `no expected reason for ${file}`);
    assert.ok(problems.some((p) => p.includes(refusals[file])), `expected "${refusals[file]}" among:\n${problems.join('\n')}`);
  });
}

test('a release built from the example is a valid augur.app-release/v2 with its asks written out', () => {
  const release = appRelease2({ manifest, parts, bundle: { frontend: { artifact: `ghcr.io/example-org/augur-notes/frontend@${digest}`, digest } }, signer, releasedAt: '2026-11-08T19:00:00Z' });
  assert.equal(release.schema, APP_RELEASE_2_SCHEMA);
  assert.deepEqual(contractValidators().release(release), []);
  assert.equal(release.channel, 'stable');
  assert.deepEqual(release.asks.scopes, manifest.scopes);
  assert.deepEqual(release.asks.settings, ['retentionDays', 'allowSharing', 'defaultNotebook', 'theme', 'exportKey']);
  assert.deepEqual(Object.keys(release.asks.limits).sort(), ['migrate', 'web', 'worker']);
  assert.deepEqual(release.asks.resources.filter((r) => r.part === 'web').map((r) => r.type), ['augur-gateway', 'augur-database', 'augur-telemetry', 'augur-settings', 'augur-scratch']);
  assert.equal(release.asks.maxUpload, 25);
  assert.equal(release.asks.canvas, false);
  assert.deepEqual(release.parts.map((p) => p.metadata.name), ['migrate', 'web', 'worker']);
});

test('the release pins each part’s image by digest from what the workflow pushed, and refuses a tag', () => {
  const [migrate] = parts;
  const tagged = { ...migrate, containers: { migrate: { ...migrate.containers.migrate, image: 'ghcr.io/example-org/augur-notes:1.0.0' } } };
  const pushed = `ghcr.io/example-org/augur-notes@${digest}`;
  assert.equal(pinImages([tagged], { migrate: pushed })[0].containers.migrate.image, pushed);
  assert.throws(() => pinImages([tagged]), /must be named by digest/);
});

test('a release is refused when its manifest, a part or the bundle is wrong', () => {
  assert.throws(() => appRelease2({ manifest: { ...manifest, contract: 2 }, parts, bundle: { frontend: { artifact: `x@${digest}`, digest } }, signer }), /manifest.json: \/contract/);
  assert.throws(() => appRelease2({ manifest, parts, signer }), /has a frontend but the bundle has none/);
  const noUi = { ...manifest, frontend: undefined, api: undefined, contributes: { settings: manifest.contributes.settings } };
  delete noUi.frontend;
  delete noUi.api;
  assert.equal(appRelease2({ manifest: noUi, parts, signer }).frontend, null);
  assert.throws(() => appRelease2({ manifest: noUi, parts: [], signer }), /neither a frontend nor a part/);
});

test('asks default the floors and the upload cap when the manifest leaves them out', () => {
  const bare = { ...manifest };
  delete bare.floors;
  delete bare.maxUpload;
  const asks = asksOf2(bare, parts);
  assert.deepEqual(asks.floors, ['personal', 'team', 'org']);
  assert.equal(asks.maxUpload, 10);
});
