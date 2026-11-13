import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { needsDeployTest, needsHarry, problems, sectionsOf, tierOf } from './review-tier.mjs';

const tiers = JSON.parse(readFileSync(new URL('../.github/review-tiers.json', import.meta.url), 'utf8'));

const body = (extra = {}) =>
  ['Testing', 'Not run', 'Risk', 'How to undo', 'Review']
    .map((name) => `## ${name}\n${extra[name] ?? (name === 'Review' ? '/code-review high: 7 findings, ranks 1 to 6 fixed or answered.' : 'Something.')}\n`)
    .join('\n');

test('a change to docs, tests and changesets is Low', () => {
  assert.equal(tierOf(['docs/seed.md', '.changeset/x.md', 'platform/services/models/src/a.test.ts'], tiers).tier, 'Low');
});

test('AGENTS.md and the upgrade guide are never Low', () => {
  assert.equal(tierOf(['AGENTS.md'], tiers).tier, 'Medium');
  assert.equal(tierOf(['docs/upgrade.md'], tiers).tier, 'Medium');
});

test('ordinary product code is Medium', () => {
  assert.equal(tierOf(['platform/frontends/shell/src/app.tsx'], tiers).tier, 'Medium');
});

test('any path where the escapes landed makes it High', () => {
  for (const path of [
    'platform/services/updater/src/upgrade.ts', // E02, E14
    'platform/packages/service-kit/src/jobs.ts', // E01
    'platform/services/events/src/store.ts', // E10
    'infra/deploy/observability/tempo.yaml', // E04
    'infra/deploy/compose.yml', // E05
    'platform/services/registry/src/app-entry.ts', // E06, E12
    'platform/services/identity/src/two-step.ts', // E09
    '.github/workflows/release.yml', // E32
    'platform/services/knowledge/src/store.ts', // migrations
    '.github/review-tiers.json', // the tiers themselves
  ]) {
    assert.equal(tierOf(['docs/seed.md', path], tiers).tier, 'High', path);
  }
});

test('names that start with a dot match like any other', () => {
  assert.equal(tierOf(['infra/deploy/.env.example'], tiers).tier, 'High');
  assert.equal(needsDeployTest(['infra/deploy/.env.example'], tiers), true);
  assert.equal(tierOf(['.changeset/a.md'], tiers).tier, 'Low');
  assert.equal(needsHarry(['.github/workflows/ci.yml'], tiers), true);
});

test('tests of High code alone are Low', () => {
  assert.equal(tierOf(['platform/services/updater/src/upgrade.test.ts'], tiers).tier, 'Low');
});

test('the deploy test is needed where a change runs on a server, not for every High path', () => {
  assert.equal(needsDeployTest(['infra/deploy/compose.yml'], tiers), true);
  assert.equal(needsDeployTest(['platform/packages/service-kit/src/jobs.ts'], tiers), true);
  assert.equal(needsDeployTest(['.github/workflows/ci.yml'], tiers), false);
  assert.equal(needsDeployTest(['platform/services/storage/src/postgres.ts'], tiers), true);
  assert.equal(needsDeployTest(['pnpm-lock.yaml'], tiers), true);
  assert.equal(needsDeployTest(['platform/frontends/shell/src/App.tsx'], tiers), false);
  assert.equal(needsDeployTest(['platform/services/events/src/store.test.ts'], tiers), false);
});

test('sections are read by heading, whatever their case', () => {
  const found = sectionsOf('Intro\n## Testing\npnpm test: 12 passed\n### not run\nPostgres suites\n');
  assert.equal(found.get('testing').trim(), 'pnpm test: 12 passed');
  assert.equal(found.get('not run').trim(), 'Postgres suites');
});

test('Low needs nothing', () => {
  assert.deepEqual(problems({ tier: 'Low', body: '' }), []);
});

test('Medium needs every section and a named review', () => {
  assert.deepEqual(problems({ tier: 'Medium', body: body() }), []);
  assert.equal(problems({ tier: 'Medium', body: '' }).length, 5);
  assert.match(problems({ tier: 'Medium', body: body({ Review: 'Looked fine.' }) })[0], /code-review/);
});

test("High on Harry's paths needs his ok; other High doesn't", () => {
  assert.match(problems({ tier: 'High', body: body(), harry: true }).join(), /harry-ok/);
  assert.deepEqual(problems({ tier: 'High', body: body(), harry: true, labels: ['harry-ok'], lines: 120 }), []);
  assert.deepEqual(problems({ tier: 'High', body: body(), lines: 120 }), []);
});

test("Harry's paths are the release path, the updater, sign-in, permissions, backups and workflows", () => {
  assert.equal(needsHarry(['platform/services/updater/src/upgrade.ts'], tiers), true);
  assert.equal(needsHarry(['.github/workflows/release.yml'], tiers), true);
  assert.equal(needsHarry(['infra/deploy/backup/backup.sh'], tiers), true);
  assert.equal(needsHarry(['platform/services/events/src/store.ts'], tiers), false);
  assert.equal(needsHarry(['platform/services/identity/src/two-step.test.ts'], tiers), false);
});

test('the dev stack and upgrade notes are not High', () => {
  assert.equal(tierOf(['infra/docker-compose.yml'], tiers).tier, 'Medium');
  assert.equal(tierOf(['docs/upgrade.md'], tiers).tier, 'Medium');
});

test("a bot's pull request needs only Harry's ok, on his paths", () => {
  assert.deepEqual(problems({ tier: 'High', bot: true }), []);
  assert.match(problems({ tier: 'High', bot: true, harry: true }).join(), /harry-ok/);
  assert.deepEqual(problems({ tier: 'High', bot: true, harry: true, labels: ['harry-ok'] }), []);
});

test('a change to a package a service runs gets the deploy test', () => {
  assert.equal(needsDeployTest(['platform/packages/app-tools/src/manifest.ts'], tiers), true);
  assert.equal(needsDeployTest(['contracts/registry.yaml'], tiers), true);
});

test('High over 400 lines needs a reason', () => {
  assert.match(problems({ tier: 'High', body: body(), lines: 975 }).join(), /400/);
  const reasoned = body({ Risk: 'Over 400 lines because the migration and its store move together.' });
  assert.deepEqual(problems({ tier: 'High', body: reasoned, lines: 975 }), []);
});
