// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deployFiles, nextRelease, versionModule } from './augur-release.mjs';

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
