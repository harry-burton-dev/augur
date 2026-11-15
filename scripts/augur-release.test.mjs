// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundleFiles, bundleName, deployFiles, devBuild, nextRelease, oldDevBuilds, parseChangeset, pendingDeployTest, readStores, releaseName, storeLevel, storeProblems, storesFrom, titleOf, versionModule, writeBundle } from './augur-release.mjs';

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

test('a setting that becomes required is listed as one to add, as a new one is', () => {
  const next = after(first, { '@augur/registry': '0.3.0', '@augur/mfe-sdk': '1.1.0' }, { all: ['PLATFORM_URL', 'APP_ORIGINS'], required: ['PLATFORM_URL', 'APP_ORIGINS'] });
  assert.equal(next.version, '0.1.1');
  assert.deepEqual(next.settings.added, ['APP_ORIGINS']);
  assert.deepEqual(next.settings.removed, []);
  const build = devBuild(first, { '@augur/registry': { version: '0.3.0' }, '@augur/mfe-sdk': { version: '1.1.0' } }, { all: ['PLATFORM_URL', 'APP_ORIGINS'], required: ['PLATFORM_URL', 'APP_ORIGINS'] }, [], 4, '2026-10-30');
  assert.deepEqual(build.settings.added, ['APP_ORIGINS']);
});

test('the registry is told which release it ships in', () => {
  assert.match(versionModule({ version: '0.4.0', channel: 'stable' }), /export const AUGUR_RELEASE = \{ version: '0\.4\.0', channel: 'stable' \} as const;/);
});

test('the deploy files are the server’s own, by hash, without .env.example or the build overlay', () => {
  const files = deployFiles(['infra/deploy/compose.yml', 'infra/deploy/.env.example', 'infra/deploy/compose.build.yml', 'infra/deploy/backup/backup.sh', 'docs/src/content/docs/run/install.md']);
  assert.deepEqual(Object.keys(files), ['backup/backup.sh', 'compose.yml']);
  assert.match(files['compose.yml'], /^[0-9a-f]{64}$/);
});

test('the deploy bundle holds what a server runs, laid out as a checkout, with sums matching the release file', () => {
  const tracked = ['infra/deploy/compose.yml', 'infra/deploy/.env.example', 'infra/deploy/compose.build.yml', 'infra/deploy/backup/backup.sh', 'scripts/preflight.mjs', 'scripts/seed.mjs', 'docs/src/content/docs/release-notes/upgrade-notes.md'];
  assert.deepEqual(bundleFiles(tracked), ['infra/deploy/.env.example', 'infra/deploy/backup/backup.sh', 'infra/deploy/compose.yml', 'scripts/preflight.mjs']);
  assert.equal(bundleName('0.26.0'), 'augur-deploy-0.26.0.tar.gz');
  const dir = mkdtempSync(join(tmpdir(), 'bundle-test-'));
  const out = writeBundle({ tracked, release: '{"version":"0.26.0"}\n', out: join(dir, bundleName('0.26.0')) });
  const again = writeBundle({ tracked, release: '{"version":"0.26.0"}\n', out: join(dir, 'again.tar.gz') });
  assert.deepEqual(readFileSync(out), readFileSync(again), 'the same files make the same bundle');
  const unpacked = join(dir, 'server');
  mkdirSync(unpacked);
  execFileSync('tar', ['-xzf', out, '-C', unpacked]);
  execFileSync('sha256sum', ['--quiet', '-c', 'SHA256SUMS'], { cwd: unpacked });
  assert.equal(readFileSync(join(unpacked, 'release/augur-release.json'), 'utf8'), '{"version":"0.26.0"}\n');
  assert.ok(statSync(join(unpacked, 'infra/deploy/backup/backup.sh')).mode & 0o100, 'scripts stay executable');
  const sums = Object.fromEntries(readFileSync(join(unpacked, 'SHA256SUMS'), 'utf8').trim().split('\n').map((l) => l.split('  ').reverse()));
  for (const [path, hash] of Object.entries(deployFiles(tracked))) assert.equal(sums[`infra/deploy/${path}`], hash);
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

const stores = { postgres: 'pgvector/pgvector:0.8.7-pg16-bookworm', garage: 'dxflrs/garage:v2.4.1', keycloak: 'quay.io/keycloak/keycloak:26.8.1', openfga: 'openfga/openfga:v1.19.0' };
const parts0 = { '@augur/registry': { version: '0.3.0' }, '@augur/mfe-sdk': { version: '1.1.0' } };

test('the stores are read from the deploy files: Postgres and Garage from compose, Keycloak and OpenFGA from the image build', () => {
  const compose = 'services:\n  postgres:\n    image: pgvector/pgvector:0.8.7-pg16-bookworm\n  backup:\n    image: restic/restic:0.19.1\n  garage:\n    image: dxflrs/garage:v2.4.1\n';
  const dockerfile = 'FROM node:22-alpine AS deps\nFROM quay.io/keycloak/keycloak:26.8.1 AS keycloak\nFROM openfga/openfga:v1.19.0 AS openfga-upstream\nFROM alpine:3.22 AS openfga\n';
  assert.deepEqual(storesFrom({ compose, dockerfile }), stores);
  assert.throws(() => storesFrom({ compose, dockerfile: 'FROM node:22-alpine\n' }), /keycloak/);
  // This repository's own files have all four.
  assert.deepEqual(Object.keys(readStores()).sort(), ['garage', 'keycloak', 'openfga', 'postgres']);
});

test('a release that moves a store’s image is breaking, so a server can’t go back to the old image on data the new one changed', () => {
  const base = { ...nextRelease(undefined, parts0, settings, '2026-10-23', [], stores) };
  assert.deepEqual(base.stores, stores);
  const moved = nextRelease(base, parts0, settings, '2026-10-30', [], { ...stores, keycloak: 'quay.io/keycloak/keycloak:26.9.0' });
  assert.equal(moved.version, '0.2.0');
  assert.equal(moved.upgradeFrom, '>=0.1.0');
  assert.deepEqual(moved.breaking, ['Keycloak quay.io/keycloak/keycloak:26.8.1 → quay.io/keycloak/keycloak:26.9.0: its data can’t go back to the old image']);
  assert.equal(moved.stores.keycloak, 'quay.io/keycloak/keycloak:26.9.0');
  // Unmoved stores change nothing, and a release from before stores were recorded only starts recording them.
  assert.equal(nextRelease(base, parts0, settings, '2026-10-30', [], stores), base);
  const { stores: _, ...older } = base;
  const recorded = nextRelease(older, { ...parts0, '@augur/registry': { version: '0.3.1' } }, settings, '2026-10-30', [], stores);
  assert.deepEqual(recorded.breaking, []);
  assert.deepEqual(recorded.stores, stores);
});

test('a dev build that moves a store’s image is breaking too', () => {
  const base = nextRelease(undefined, parts0, settings, '2026-10-23', [], stores);
  const build = devBuild(base, parts0, settings, [], 7, '2026-10-30', { ...stores, openfga: 'openfga/openfga:v1.20.0' });
  assert.deepEqual(build.breaking, ['OpenFGA openfga/openfga:v1.19.0 → openfga/openfga:v1.20.0: its data can’t go back to the old image']);
  assert.equal(build.upgradeFrom, '>=0.1.0');
});

test('only a move past a patch counts: a new name, a minor, or a Postgres major; never a patch or a digest', () => {
  assert.equal(storeLevel('keycloak', 'quay.io/keycloak/keycloak:26.8.1'), storeLevel('keycloak', 'quay.io/keycloak/keycloak:26.8.2@sha256:ab12'));
  assert.notEqual(storeLevel('keycloak', 'quay.io/keycloak/keycloak:26.8.1'), storeLevel('keycloak', 'quay.io/keycloak/keycloak:26.9.0'));
  assert.equal(storeLevel('garage', 'dxflrs/garage:v2.4.1'), 'dxflrs/garage:2.4');
  assert.equal(storeLevel('postgres', 'pgvector/pgvector:0.8.7-pg16-bookworm'), storeLevel('postgres', 'pgvector/pgvector:0.9.0-pg16-trixie'));
  assert.notEqual(storeLevel('postgres', 'pgvector/pgvector:0.8.7-pg16-bookworm'), storeLevel('postgres', 'pgvector/pgvector:0.8.7-pg17-bookworm'));
  assert.notEqual(storeLevel('postgres', 'pgvector/pgvector:0.8.7-pg16-bookworm'), storeLevel('postgres', 'postgres:16'));
  assert.equal(storeLevel('openfga', 'registry.local:5000/openfga:v1.19.0'), 'registry.local:5000/openfga:1.19');
  const base = nextRelease(undefined, parts0, settings, '2026-10-23', [], stores);
  const patched = nextRelease(base, parts0, settings, '2026-10-30', [], { ...stores, garage: 'dxflrs/garage:v2.4.2' });
  assert.deepEqual(patched.breaking, []);
});

test('a store’s image named through a variable, or behind a --platform flag, is still read or refused', () => {
  const compose = 'services:\n  postgres:\n    image: pgvector/pgvector:0.8.7-pg16-bookworm\n  garage:\n    image: dxflrs/garage:v2.4.1\n';
  const dockerfile = (keycloak) => `FROM ${keycloak} AS keycloak\nFROM openfga/openfga:v1.19.0 AS openfga-upstream\n`;
  assert.equal(storesFrom({ compose, dockerfile: dockerfile('--platform=$BUILDPLATFORM quay.io/keycloak/keycloak:26.8.1') }).keycloak, 'quay.io/keycloak/keycloak:26.8.1');
  assert.throws(() => storesFrom({ compose, dockerfile: dockerfile('${KEYCLOAK_IMAGE}') }), /variable/);
});

test('CI wants an unreleased upgrade note, headed with the store and saying how to go back, and a changeset, for each store that moved', () => {
  const released = { stores };
  const now = { ...stores, postgres: 'pgvector/pgvector:0.8.7-pg17-bookworm' };
  const waiting = [{ bumps: { '@augur/registry': 'patch' } }];
  const notes = (body) => `---\ntitle: Upgrade notes\n---\n\n${body}\n## Older note\n\n**From** augur@0.1.0\n\nPostgres: restore it to go back.\n`;
  const good = '## Postgres moves to 17\n\n**From** unreleased\n\nPostgres rewrites its files. To go back, restore the backup.\n';
  assert.deepEqual(storeProblems(released, stores, notes(''), []), []);
  assert.match(storeProblems(released, now, notes(''), waiting)[0], /Postgres/);
  // A released note doesn't count: it was for an earlier move.
  assert.equal(storeProblems(released, now, notes(good.replace('unreleased', 'augur@0.20.0')), waiting).length, 1);
  // Nor does one that only mentions it, or one that doesn't say how to go back, or an older, released note.
  assert.equal(storeProblems(released, now, notes('## Apps reach the stores\n\n**From** unreleased\n\nThrough Postgres\u2019s relay. Go back as usual.\n'), waiting).length, 1);
  assert.equal(storeProblems(released, now, notes('## Postgres moves to 17\n\n**From** unreleased\n\nNothing to do.\n'), waiting).length, 1);
  assert.deepEqual(storeProblems(released, now, notes(good), waiting), []);
  // Without a changeset that bumps a part, no release would carry the move.
  assert.match(storeProblems(released, now, notes(good), [{ bumps: {} }])[0], /changeset/);
  // Before the release file records stores there is nothing to compare.
  assert.deepEqual(storeProblems({}, now, notes(''), []), []);
});
