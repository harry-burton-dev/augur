// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deployFiles, devBuild, nextRelease, oldDevBuilds, parseChangeset, pendingDeployTest, releaseName, titleOf, versionModule } from './augur-release.mjs';

const settings = { all: ['PLATFORM_URL', 'APP_ORIGINS'], required: ['PLATFORM_URL'] };
const first = nextRelease(undefined, { '@augur/registry': { version: '0.3.0' }, '@augur/mfe-sdk': { version: '1.1.0' } }, settings, '2026-10-23');
const after = (previous, parts, s = settings) => nextRelease(previous, Object.fromEntries(Object.entries(parts).map(([k, version]) => [k, { version }])), s, '2026-10-30');

test('the first AUGUR release is 0.1.0 on the beta channel', () => {
  assert.equal(first.version, '0.1.0');
  assert.equal(first.channel, 'beta');
  assert.equal(first.upgradeFrom, '>=0.1.0');
});

test('nothing changed: no new release', () => {
  assert.equal(after(first, { '@augur/registry': '0.3.0', '@augur/mfe-sdk': '1.1.0' }), first);
});

test('a fix bumps the patch and keeps the upgrade path', () => {
  const next = after(first, { '@augur/registry': '0.3.1', '@augur/mfe-sdk': '1.1.0' });
  assert.equal(next.version, '0.1.1');
  assert.deepEqual(next.changed, ['@augur/registry']);
  assert.equal(next.upgradeFrom, '>=0.1.0');
});

test('a feature or a new part bumps the minor', () => {
  assert.equal(after(first, { '@augur/registry': '0.4.0', '@augur/mfe-sdk': '1.1.0' }).version, '0.2.0');
  assert.equal(after(first, { '@augur/registry': '0.3.0', '@augur/mfe-sdk': '1.1.0', '@augur/updater': '0.1.0' }).version, '0.2.0');
});

test('a breaking change needs the previous release first, and says why', () => {
  const next = after(first, { '@augur/registry': '0.3.0', '@augur/mfe-sdk': '2.0.0' });
  assert.equal(next.version, '0.2.0');
  assert.equal(next.upgradeFrom, '>=0.1.0');
  assert.deepEqual(next.breaking, ['@augur/mfe-sdk 1.1.0 → 2.0.0']);
  const again = after(next, { '@augur/registry': '1.0.0', '@augur/mfe-sdk': '2.0.0' });
  assert.equal(again.upgradeFrom, '>=0.2.0');
  assert.deepEqual(after(next, { '@augur/mfe-sdk': '2.0.0' }).breaking, ['@augur/registry removed']);
});

test('from 1.0 a breaking change bumps the major', () => {
  const stable = { ...first, version: '1.0.0' };
  const next = after(stable, { '@augur/registry': '1.0.0', '@augur/mfe-sdk': '1.1.0' });
  assert.equal(next.version, '2.0.0');
  assert.equal(next.channel, 'stable');
});

test('new and removed settings are listed, and a settings change alone is a release', () => {
  const next = after(first, { '@augur/registry': '0.3.0', '@augur/mfe-sdk': '1.1.0' }, { all: ['PLATFORM_URL', 'OBJECT_STORE_URL'], required: ['PLATFORM_URL', 'OBJECT_STORE_URL'] });
  assert.equal(next.version, '0.1.1');
  assert.deepEqual(next.settings.added, ['OBJECT_STORE_URL']);
  assert.deepEqual(next.settings.removed, ['APP_ORIGINS']);
});

test('the registry is told which release it ships in', () => {
  assert.match(versionModule({ version: '0.4.0', channel: 'stable' }), /export const AUGUR_RELEASE = \{ version: '0\.4\.0', channel: 'stable' \} as const;/);
});

test('the deploy files are the server’s own, by hash, without .env.example or the build overlay', () => {
  const files = deployFiles(['infra/deploy/compose.yml', 'infra/deploy/.env.example', 'infra/deploy/compose.build.yml', 'infra/deploy/backup/backup.sh', 'docs/deploy.md']);
  assert.deepEqual(Object.keys(files), ['backup/backup.sh', 'compose.yml']);
  assert.match(files['compose.yml'], /^[0-9a-f]{64}$/);
});

test('a changeset is read for its bumps and what it says', () => {
  assert.deepEqual(parseChangeset('---\n"@augur/registry": minor\n\'@augur/admin\': patch\n---\n\nA third ring.\n'), { bumps: { '@augur/registry': 'minor', '@augur/admin': 'patch' }, summary: 'A third ring.' });
  assert.deepEqual(parseChangeset('---\n---\n\nNothing to release.\n'), { bumps: {}, summary: 'Nothing to release.' });
  assert.equal(parseChangeset('no frontmatter'), undefined);
});

test('a dev build is the next patch then the run, with what the changesets waiting say', () => {
  const parts = { '@augur/registry': { version: '0.3.0' }, '@augur/mfe-sdk': { version: '1.1.0' } };
  const changesets = [
    { bumps: { '@augur/registry': 'minor' }, summary: 'Dev builds.' },
    { bumps: { '@augur/registry': 'patch', '@apps/gone': 'patch' }, summary: 'A fix\nover two lines.' },
  ];
  const build = devBuild(first, parts, settings, changesets, 48, '2026-10-30');
  assert.equal(build.version, '0.1.1-dev.48');
  assert.equal(build.channel, 'dev');
  assert.equal(build.upgradeFrom, first.upgradeFrom);
  assert.deepEqual(build.changed, ['@augur/registry']);
  assert.deepEqual(build.breaking, []);
  assert.equal(build.changelogs['@augur/registry'], '#### Minor Changes\n\n- Dev builds.\n\n#### Patch Changes\n\n- A fix\n  over two lines.');
  assert.deepEqual(build.parts, { '@augur/registry': { version: '0.3.0' }, '@augur/mfe-sdk': { version: '1.1.0' } });
  assert.throws(() => devBuild(first, parts, settings, [], 'x', '2026-10-30'), /run is a number/);
});

test('a dev build with a major changeset is breaking, and needs the last release first', () => {
  const build = devBuild(first, { '@augur/mfe-sdk': { version: '1.1.0' } }, settings, [{ bumps: { '@augur/mfe-sdk': 'major' }, summary: 'SDK 2.\nMore.' }], 3, '2026-10-30');
  assert.deepEqual(build.breaking, ['@augur/mfe-sdk: SDK 2.']);
  assert.equal(build.upgradeFrom, '>=0.1.0');
});

test('only the newest few of AUGUR’s dev builds are kept, and never a release', () => {
  const tags = ['augur@0.12.0', 'augur@0.12.1-dev.40', 'augur@0.12.1-dev.48', 'augur@0.12.1-dev.9', 'augur@0.13.1-dev.50', 'app/notes@0.1.1-dev.3'];
  assert.deepEqual(oldDevBuilds(tags), ['augur@0.12.1-dev.9']);
  assert.deepEqual(oldDevBuilds(tags, ['augur@0.12.1-dev.9'], 1), ['augur@0.12.1-dev.48', 'augur@0.12.1-dev.40']);
});

test('a new minor or major takes the next release name, and a patch keeps its release’s', () => {
  const names = ['Avocet', 'Bittern'];
  assert.equal(releaseName(undefined, '0.1.0', names), 'Avocet');
  assert.equal(releaseName({ version: '0.13.0' }, '0.14.0', names), 'Avocet', 'after a release with no name, the first');
  assert.equal(releaseName({ version: '0.14.0', name: 'Avocet' }, '0.14.1', names), 'Avocet');
  assert.equal(releaseName({ version: '0.14.1', name: 'Avocet' }, '0.15.0', names), 'Bittern');
  assert.equal(releaseName({ version: '0.15.0', name: 'Bittern' }, '1.0.0', names), undefined, 'the list ran out');
  const named = nextRelease({ ...first, version: '0.14.0', name: 'Avocet' }, { '@augur/registry': { version: '0.4.0' }, '@augur/mfe-sdk': { version: '1.1.0' } }, settings, '2026-11-01', names);
  assert.equal(named.version, '0.15.0');
  assert.equal(named.name, 'Bittern');
  assert.equal(titleOf(named), '0.15.0 Bittern');
  assert.equal(titleOf({ version: '0.13.0' }), '0.13.0');
  assert.equal(after(first, { '@augur/registry': '0.3.1', '@augur/mfe-sdk': '1.1.0' }).name, undefined, 'no names given, no name');
});

test('the kit, taken as packages from augur-kit, is a part at the version installed', async () => {
  const { readParts } = await import('./augur-release.mjs');
  const parts = readParts();
  for (const name of ['@augur/kit-common', '@augur/app-kit', '@augur/shell-kit']) {
    assert.ok(parts[name], `${name} is a part`);
    assert.equal(parts[name].external, true, `${name} comes from another repository`);
  }
  assert.equal(parts['@augur/mfe-sdk'].external, undefined);
});

test('a new release carries a pending deploy test result, which the deploy test replaces; a dev build has none', () => {
  assert.deepEqual(pendingDeployTest({ version: '0.15.0', channel: 'beta', run: '9', at: '2026-11-06T10:00:00Z' }), { schema: 'augur.deploy-test/v1', version: '0.15.0', from: null, passed: null, run: '9', at: '2026-11-06T10:00:00Z' });
  assert.equal(pendingDeployTest({ version: '0.15.1-dev.4', channel: 'dev', run: '9', at: 't' }), undefined);
});
