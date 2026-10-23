// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextRelease } from './platform-release.mjs';

const settings = { all: ['PLATFORM_URL', 'APP_ORIGINS'], required: ['PLATFORM_URL'] };
const first = nextRelease(undefined, { '@platform/registry': { version: '0.3.0' }, '@platform/mfe-sdk': { version: '1.1.0' } }, settings, '2026-10-23');
const after = (previous, parts, s = settings) => nextRelease(previous, Object.fromEntries(Object.entries(parts).map(([k, version]) => [k, { version }])), s, '2026-10-30');

test('the first platform release is 0.1.0 on the beta channel', () => {
  assert.equal(first.platform, '0.1.0');
  assert.equal(first.channel, 'beta');
  assert.equal(first.upgradeFrom, '>=0.1.0');
});

test('nothing changed: no new release', () => {
  assert.equal(after(first, { '@platform/registry': '0.3.0', '@platform/mfe-sdk': '1.1.0' }), first);
});

test('a fix bumps the patch and keeps the upgrade path', () => {
  const next = after(first, { '@platform/registry': '0.3.1', '@platform/mfe-sdk': '1.1.0' });
  assert.equal(next.platform, '0.1.1');
  assert.deepEqual(next.changed, ['@platform/registry']);
  assert.equal(next.upgradeFrom, '>=0.1.0');
});

test('a feature or a new part bumps the minor', () => {
  assert.equal(after(first, { '@platform/registry': '0.4.0', '@platform/mfe-sdk': '1.1.0' }).platform, '0.2.0');
  assert.equal(after(first, { '@platform/registry': '0.3.0', '@platform/mfe-sdk': '1.1.0', '@platform/updater': '0.1.0' }).platform, '0.2.0');
});

test('a breaking change needs the previous release first, and says why', () => {
  const next = after(first, { '@platform/registry': '0.3.0', '@platform/mfe-sdk': '2.0.0' });
  assert.equal(next.platform, '0.2.0');
  assert.equal(next.upgradeFrom, '>=0.1.0');
  assert.deepEqual(next.breaking, ['@platform/mfe-sdk 1.1.0 → 2.0.0']);
  const again = after(next, { '@platform/registry': '1.0.0', '@platform/mfe-sdk': '2.0.0' });
  assert.equal(again.upgradeFrom, '>=0.2.0');
  assert.deepEqual(after(next, { '@platform/mfe-sdk': '2.0.0' }).breaking, ['@platform/registry removed']);
});

test('from 1.0 a breaking change bumps the major', () => {
  const stable = { ...first, platform: '1.0.0' };
  const next = after(stable, { '@platform/registry': '1.0.0', '@platform/mfe-sdk': '1.1.0' });
  assert.equal(next.platform, '2.0.0');
  assert.equal(next.channel, 'stable');
});

test('new and removed settings are listed, and a settings change alone is a release', () => {
  const next = after(first, { '@platform/registry': '0.3.0', '@platform/mfe-sdk': '1.1.0' }, { all: ['PLATFORM_URL', 'OBJECT_STORE_URL'], required: ['PLATFORM_URL', 'OBJECT_STORE_URL'] });
  assert.equal(next.platform, '0.1.1');
  assert.deepEqual(next.settings.added, ['OBJECT_STORE_URL']);
  assert.deepEqual(next.settings.removed, ['APP_ORIGINS']);
});
