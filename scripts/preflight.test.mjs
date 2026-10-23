// pnpm test:scripts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare, preflight, readEnv } from './preflight.mjs';

const release = { version: '0.3.0', channel: 'beta', upgradeFrom: '>=0.2.0', breaking: ['@augur/mfe-sdk 1.3.0 → 2.0.0'], settings: { required: ['PLATFORM_VERSION', 'PLATFORM_URL', 'OBJECT_STORE_URL'], removed: ['SERVICE_TOKEN'] } };
const env = (extra) => ({ PLATFORM_VERSION: '0.2.4', PLATFORM_URL: 'https://augur.example.ts.net', OBJECT_STORE_URL: 'http://minio:9000', ...extra });

test('versions compare by number', () => {
  assert.ok(compare('0.10.0', '0.9.9') > 0);
  assert.equal(compare('1.2.3', '1.2.3'), 0);
});

test('reads a .env, dropping quotes and comments', () => {
  assert.deepEqual(readEnv('# a comment\nPLATFORM_URL="https://x"\nEMPTY=\n  ORG_NAME = Acme \n'), { PLATFORM_URL: 'https://x', EMPTY: '', ORG_NAME: 'Acme' });
});

test('ready when the path and settings are right, listing what breaks', () => {
  const { errors, notes } = preflight(release, env());
  assert.deepEqual(errors, []);
  assert.ok(notes.includes('Breaking: @augur/mfe-sdk 1.3.0 → 2.0.0.'));
});

test('stops a server too far behind and names the release to go through', () => {
  const { errors } = preflight(release, env({ PLATFORM_VERSION: '0.1.7' }));
  assert.match(errors[0], /Upgrade to 0\.2\.0 first \(augur@0\.2\.0\)/);
});

test('stops when a required setting is missing, but never for PLATFORM_VERSION itself', () => {
  const { errors } = preflight(release, env({ OBJECT_STORE_URL: '', PLATFORM_VERSION: undefined }));
  assert.deepEqual(errors, ['Set OBJECT_STORE_URL in .env first (see infra/deploy/.env.example).']);
});

test('notes settings that are no longer read, and going back', () => {
  const { errors, notes } = preflight(release, env({ SERVICE_TOKEN: 'x', PLATFORM_VERSION: '0.4.0' }));
  assert.deepEqual(errors, []);
  assert.ok(notes.some((n) => n.includes('SERVICE_TOKEN is no longer read')));
  assert.ok(notes.some((n) => n.includes('going back')));
});
