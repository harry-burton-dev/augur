import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { autoOkComment, logged, needsDeployTest, needsHarry, problems, sectionsOf, tierOf, verdict } from './review-tier.mjs';

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

// The next rules: what takes over after the shadow week (REVIEW.md).
const changes = (lines = {}, gone = {}) => ({ added: (path) => lines[path] ?? [], removed: (path) => gone[path] ?? [], knownActions: new Set(['actions/checkout', 'pnpm/action-setup']) });
const nextVerdict = (paths, rules, context) => verdict(paths, rules.next, context);

test('the next rules ask Harry about what is hard to undo, widens access or changes the rules', () => {
  for (const path of [
    'platform/services/events/src/migrations/014_floors.sql',
    'infra/deploy/backup/backup.sh',
    'scripts/promote.mjs',
    '.github/workflows/release.yml',
    '.github/review-tiers.json',
    'platform/services/identity/src/two-step.ts',
    'platform/services/updater/src/upgrade.ts',
  ]) {
    assert.ok(nextVerdict([path], tiers, changes()).harry.length, path);
  }
});

test('the next rules keep busy areas High without asking Harry', () => {
  for (const path of [
    'platform/services/registry/src/app-entry.ts',
    'platform/services/gateway/src/routes.ts',
    'platform/packages/service-kit/src/jobs.ts',
    'infra/deploy/compose.yml',
    'platform/services/events/src/store.ts',
  ]) {
    const verdict = nextVerdict([path], tiers, changes());
    assert.equal(verdict.tier, 'High', path);
    assert.deepEqual(verdict.harry, [], path);
  }
});

test('generated files and the deploy test harness no longer make a change High', () => {
  assert.equal(nextVerdict(['release/migrations.lock.json', 'docs/seed.md'], tiers, changes()).tier, 'Low');
  assert.equal(nextVerdict(['infra/deploy-test.sh'], tiers, changes()).tier, 'Medium');
  assert.equal(nextVerdict(['.github/pull_request_template.md'], tiers, changes()).tier, 'Low');
  assert.equal(nextVerdict(['docs/release-channels.md'], tiers, changes()).tier, 'Medium');
});

test('a file only renamed does not count towards the tier', () => {
  const paths = ['platform/services/registry/src/old.ts', 'platform/services/registry/src/new.ts', 'docs/seed.md'];
  assert.equal(nextVerdict(paths, tiers, { ...changes(), renamed: paths.slice(0, 2) }).tier, 'Low');
});

test("a rename still counts for Harry's ok, and a file moved into a workflow is read in full", () => {
  const moved = ['platform/services/events/src/migrations/014_a.sql', 'platform/services/events/src/migrations/013_a.sql'];
  assert.ok(nextVerdict(moved, tiers, { ...changes(), renamed: moved }).harry.length);
  const wf = '.github/workflows/deploy.yml';
  const verdictOf = nextVerdict(['docs/example.yml', wf], tiers, { ...changes({ [wf]: ['on: pull_request_target'] }), renamed: ['docs/example.yml', wf] });
  assert.equal(verdictOf.tier, 'High');
  assert.equal(verdictOf.harry.length, 1);
});

test('the current rules are unchanged by the next ones', () => {
  for (const paths of [['.github/workflows/ci.yml'], ['platform/services/registry/src/a.ts'], ['docs/seed.md'], ['infra/deploy/backup/b.sh'], ['platform/frontends/shell/src/app.tsx']]) {
    const now = verdict(paths, tiers, changes());
    assert.equal(now.tier, tierOf(paths, tiers).tier, paths[0]);
    assert.equal(now.harry.length > 0, now.tier === 'High' && needsHarry(paths, tiers), paths[0]);
  }
});

test('a workflow asks Harry only when it gains privilege or a new action', () => {
  const wf = '.github/workflows/ci.yml';
  assert.deepEqual(nextVerdict([wf], tiers, changes({ [wf]: ['      - uses: actions/checkout@abc123 # v4.5.0'] })).harry, []);
  assert.equal(nextVerdict([wf], tiers, changes({ [wf]: ['      contents: write'] })).harry.length, 1);
  assert.equal(nextVerdict([wf], tiers, changes({ [wf]: ['        run: echo ${{ secrets.TOKEN }}'] })).harry.length, 1);
  assert.equal(nextVerdict([wf], tiers, changes({ [wf]: ['      - uses: someone/new-action@def456'] })).harry.length, 1);
  assert.deepEqual(nextVerdict([wf], tiers, changes({ [wf]: ['      - uses: ./.github/workflows/review.yml'] })).harry, []);
  assert.deepEqual(nextVerdict([wf], tiers, changes({ [wf]: ['      # The job needs packages: write to push.'] })).harry, []);
  assert.equal(nextVerdict([wf], tiers, changes({ [wf]: ['    secrets: inherit'] })).harry.length, 1);
  assert.equal(nextVerdict([wf], tiers, changes({ [wf]: ["        run: echo '${{ toJSON(secrets) }}'"] })).harry.length, 1);
  assert.equal(nextVerdict([wf], tiers, changes({}, { [wf]: ['permissions:', '  contents: read'] })).harry.length, 1);
  assert.equal(nextVerdict(['.github/actions/build/action.yml'], tiers, changes({ '.github/actions/build/action.yml': ['    - uses: someone/else@abc'] })).harry.length, 1);
});

test('a content rule makes a change High even off the High paths', () => {
  const local = { next: { ...tiers.next, harryOkWhen: [{ paths: ['manifest.json'], added: '"[a-z-]+:(write|publish)"', why: 'asks for a new permission' }] } };
  const verdict = nextVerdict(['manifest.json'], local, changes({ 'manifest.json': ['    "inbox:write"'] }));
  assert.equal(verdict.tier, 'High');
  assert.match(verdict.harry[0], /new permission/);
  assert.deepEqual(nextVerdict(['manifest.json'], local, changes({ 'manifest.json': ['  "sdk": "^2.1.0",'] })).harry, []);
});

test('the auto-ok log takes what waited for Harry and would not have under the next rules', () => {
  const v = (harry, tier = 'High') => ({ tier, because: [], harry });
  assert.equal(logged({ now: v(['REVIEW.md']), next: v([]) }), true);
  assert.equal(logged({ now: v(['REVIEW.md']), next: v(['REVIEW.md']) }), false);
  assert.equal(logged({ now: v([]), next: v([]) }), false);
  // After the switch (autoOk): a High change that merged without his ok. A repository without either logs nothing.
  assert.equal(logged({ now: v([]), autoOk: true }), true);
  assert.equal(logged({ now: v([], 'Medium'), autoOk: true }), false);
  assert.equal(logged({ now: v([]) }), false);
});

test("the auto-ok comment can't be ended early by what a pull request says", () => {
  const comment = autoOkComment({ phase: 'shadow', tier: 'High', nextTier: 'High', because: ['infra/deploy/compose.yml'], files: 2, lines: 30, deployTest: true, checks: [{ name: 'CI', conclusion: 'success' }], notRun: 'a --> b', howToUndo: 'Revert.', risk: '' });
  const [, data] = /^<!-- auto-ok: (.*) -->$/m.exec(comment);
  assert.equal(JSON.parse(data).notRun, 'a --> b');
  assert.equal(comment.split('\n')[0].match(/-->/g).length, 1);
  assert.match(comment, /harry-would-not/);
});
