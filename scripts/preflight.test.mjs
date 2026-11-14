// pnpm test:scripts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare, fillSecrets, installChecks, preflight, readEnv } from './preflight.mjs';

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

// A fresh install (--install).
const schema = {
  required: ['PLATFORM_VERSION', 'PLATFORM_URL', 'TS_AUTHKEY', 'POSTGRES_PASSWORD', 'GARAGE_RPC_SECRET', 'PLATFORM_ADMIN_EMAIL'],
  properties: {
    PLATFORM_VERSION: {},
    PLATFORM_URL: { pattern: '^https://[^/]+$' },
    TS_HOSTNAME: { default: 'platform' },
    TS_AUTHKEY: { writeOnly: true, pattern: '^tskey-' },
    POSTGRES_PASSWORD: { writeOnly: true, minLength: 16, 'x-generate': true },
    GARAGE_RPC_SECRET: { writeOnly: true, pattern: '^[0-9a-fA-F]{64}$', 'x-generate': true },
    PLATFORM_ADMIN_EMAIL: { format: 'email' },
    SERVER_RING: { enum: ['dev', 'preview', 'production'] },
    GITHUB_READ_USER: {},
    DEPLOYMENT_ID: {},
  },
};
const fresh = { version: '0.19.0', channel: 'beta', settings: { required: ['PLATFORM_VERSION'] } };
const ready = (extra) => ({ PLATFORM_VERSION: '0.19.0', PLATFORM_URL: 'https://platform.tail1.ts.net', TS_AUTHKEY: 'tskey-auth-x', POSTGRES_PASSWORD: 'a'.repeat(64), GARAGE_RPC_SECRET: 'b'.repeat(64), PLATFORM_ADMIN_EMAIL: 'me@example.org', DEPLOYMENT_ID: 'staging', ...extra });
const stops = (env, host) => installChecks({ release: fresh, schema, env, host }).filter((c) => c.stop).map((c) => c.text);

test('an install is ready when every setting is set and fits', () => {
  assert.deepEqual(stops(ready(), { memoryBytes: 16 * 1024 ** 3, freeDiskBytes: 200 * 1024 ** 3 }), []);
});

test('an install stops on the wrong release, a blank secret, and settings that don’t fit', () => {
  const found = stops(ready({ PLATFORM_VERSION: '0.18.0', POSTGRES_PASSWORD: '', GARAGE_RPC_SECRET: 'short', PLATFORM_URL: 'https://platform.tail1.ts.net/', SERVER_RING: 'staging', PLATFORM_ADMIN_EMAIL: 'me' }));
  assert.ok(found.some((t) => /deploy files here are augur@0\.19\.0/.test(t)));
  assert.ok(found.some((t) => /POSTGRES_PASSWORD\): run this again with --fill-secrets/.test(t)));
  assert.ok(found.some((t) => /GARAGE_RPC_SECRET doesn’t fit/.test(t)));
  assert.ok(found.some((t) => /no path or trailing slash/.test(t)));
  assert.ok(found.some((t) => /SERVER_RING is "staging"/.test(t)));
  assert.ok(found.some((t) => /isn’t an email address/.test(t)));
  assert.ok(!found.some((t) => t.includes('short')), 'a secret’s value is never shown');
});

test('an install stops on shared secrets, a machine name that differs, half a read key and a readable .env', () => {
  const found = stops(ready({ GARAGE_RPC_SECRET: 'a'.repeat(64), PLATFORM_URL: 'https://augur-staging.tail1.ts.net', GITHUB_READ_USER: 'augur-deploy' }), { readKey: false, envReadableByOthers: true });
  assert.ok(found.some((t) => /POSTGRES_PASSWORD and GARAGE_RPC_SECRET are the same/.test(t)));
  assert.ok(found.some((t) => /names the machine augur-staging, but TS_HOSTNAME is platform/.test(t)));
  assert.ok(found.some((t) => /github-read-key isn’t there/.test(t)));
  assert.ok(found.some((t) => /chmod 600/.test(t)));
});

test('a small host is a note, not a stop', () => {
  const checks = installChecks({ release: fresh, schema, env: ready(), host: { memoryBytes: 8 * 1024 ** 3, freeDiskBytes: 20 * 1024 ** 3 } });
  assert.ok(checks.some((c) => c.note && /^Memory: 8\.0 GB/.test(c.text)));
  assert.ok(checks.some((c) => c.note && /^Disk: 20 GB free/.test(c.text)));
  assert.ok(!checks.some((c) => c.stop));
});

test('filling secrets writes only blank x-generate ones, in place or at the end', () => {
  const text = '# Secrets\nPOSTGRES_PASSWORD=\nTS_AUTHKEY=\n# GARAGE_RPC_SECRET=\n';
  const { text: out, filled } = fillSecrets(text, schema, () => 'f'.repeat(64));
  assert.deepEqual(filled, ['POSTGRES_PASSWORD', 'GARAGE_RPC_SECRET']);
  assert.equal(out, `# Secrets\nPOSTGRES_PASSWORD=${'f'.repeat(64)}\nTS_AUTHKEY=\nGARAGE_RPC_SECRET=${'f'.repeat(64)}\n`);
  assert.deepEqual(fillSecrets(out, schema).filled, [], 'a set value is never changed');
  assert.match(fillSecrets('PLATFORM_URL=x', schema, () => 'e').text, /^PLATFORM_URL=x\nPOSTGRES_PASSWORD=e\nGARAGE_RPC_SECRET=e\n$/);
});
