// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { desiredEnv, diff, factsScript, fetchScript, isSecret, newEnv, problems, q, readFacts, sha256, statusLine } from './augurctl/augurctl.mjs';

const doc = {
  schema: 'augur.deployment/v1',
  name: 'preview-1',
  ring: 'preview',
  release: '0.27.0',
  host: { ssh: 'augur@preview-1', dir: '/opt/augur' },
  settings: { PLATFORM_URL: 'https://preview-1.example.org', TS_HOSTNAME: 'preview-1' },
  secrets: '../secrets/preview-1.sops.env',
  apps: [{ id: 'folio', version: '0.9.0' }],
};

test('a deployment file is held to the schema and to AUGUR’s settings', () => {
  assert.deepEqual(problems(doc, 'deployments/preview-1.yaml'), []);
  assert.match(problems({ ...doc, ring: 'staging' }, 'deployments/preview-1.yaml')[0], /ring must be equal to one of the allowed values/);
  assert.match(problems(doc, 'deployments/other.yaml')[0], /its name is preview-1/);
  const wrong = problems({ ...doc, settings: { NOT_A_SETTING: 'x', POSTGRES_PASSWORD: 'x', SERVER_RING: 'dev' }, apps: [doc.apps[0], doc.apps[0]] }, 'deployments/preview-1.yaml');
  assert.equal(wrong.length, 4);
  assert.match(wrong.join('\n'), /NOT_A_SETTING isn't a setting/);
  assert.match(wrong.join('\n'), /POSTGRES_PASSWORD is a secret/);
  assert.match(wrong.join('\n'), /SERVER_RING comes from ring/);
  assert.match(wrong.join('\n'), /folio is listed twice/);
  assert.ok(isSecret('POSTGRES_PASSWORD') && isSecret('NOTES_DATABASE_PASSWORD') && !isSecret('PLATFORM_URL'));
});

test('the plan lists each difference, secrets by hash only, and nothing when the server matches', () => {
  const env = { ...desiredEnv(doc), TS_AUTHKEY: sha256('tskey-1') };
  assert.deepEqual(diff(doc, { env, apps: { folio: '0.9.0' } }, { TS_AUTHKEY: 'tskey-1' }), []);
  const lines = diff(doc, { env: { ...env, PLATFORM_VERSION: '0.26.0', SERVER_RING: '' }, apps: { folio: '0.8.0', atlas: '0.5.0' } }, { TS_AUTHKEY: 'tskey-2', OPENFGA_TOKEN: 'x' });
  assert.deepEqual(lines, [
    '~ PLATFORM_VERSION: 0.26.0 → 0.27.0',
    '~ SERVER_RING: (not set) → preview',
    '~ TS_AUTHKEY: (secret, differs from the secrets file)',
    '+ OPENFGA_TOKEN: (secret, not set on the server)',
    '~ app folio: 0.8.0 → 0.9.0',
    '- app atlas: 0.5.0 (installed, not in the file)',
  ]);
  assert.ok(!lines.join('\n').includes('tskey'), 'no secret is printed');
  assert.match(diff(doc, { env, apps: {}, appsRead: false }).join('\n'), /^\? apps: .*can't be read/);
  assert.equal(desiredEnv({ ...doc, release: 'follow' }).PLATFORM_VERSION, undefined, 'a server that follows its ring is never told its version');
});

test('the server’s facts are read without its secrets leaving it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'augurctl-'));
  mkdirSync(join(dir, 'infra/deploy/apps'), { recursive: true });
  mkdirSync(join(dir, 'infra/deploy/backups/status'), { recursive: true });
  writeFileSync(join(dir, 'infra/deploy/.env'), 'PLATFORM_VERSION=0.27.0\nSERVER_RING=preview\nTS_AUTHKEY=tskey-1\n');
  writeFileSync(join(dir, 'infra/deploy/apps/state.json'), JSON.stringify({ apps: { folio: { active: { version: '0.9.0' } }, gone: { retiring: { version: '0.1.0' } } } }));
  writeFileSync(join(dir, 'infra/deploy/backups/status/last-backup.json'), JSON.stringify({ ok: true, at: '2026-11-14T02:00:00Z' }));
  // No docker here: ps and the last upgrade come back empty, as on a server whose stack is down.
  const out = execFileSync('sh', ['-s'], { input: factsScript(dir, ['PLATFORM_VERSION', 'SERVER_RING', 'PLATFORM_URL'], ['TS_AUTHKEY']), encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
  assert.ok(!out.includes('tskey-1'));
  const facts = readFacts(out);
  assert.deepEqual(facts.env, { PLATFORM_VERSION: '0.27.0', SERVER_RING: 'preview', TS_AUTHKEY: sha256('tskey-1') });
  assert.deepEqual(facts.apps, { folio: '0.9.0' });
  assert.match(statusLine(doc, facts), /^preview-1 \(preview\): 0\.27\.0 · 0 running · backup ok 2026-11-14T02:00 · no upgrade yet · folio 0\.9\.0$/);
  assert.throws(() => readFacts(execFileSync('sh', ['-s'], { input: factsScript('/no/such/dir', [], []), encoding: 'utf8' })), /No folder \/no\/such\/dir/);
  assert.throws(() => factsScript(dir, ['X; rm -rf /'], []), /Not a setting name/);
});

test('a status line names what’s unwell and why the last upgrade went back', () => {
  const facts = {
    env: { PLATFORM_VERSION: '0.26.0' },
    apps: {},
    appsRead: true,
    backup: { ok: false, at: '2026-11-14T02:00:00Z' },
    ps: [{ Service: 'gateway', State: 'running', Health: 'healthy' }, { Service: 'events', State: 'running', Health: 'unhealthy' }, { Service: 'storage', State: 'exited', ExitCode: 0 }],
    upgrade: { from_version: '0.26.0', version: '0.27.0', state: 'rolled-back', message: 'events did not answer' },
  };
  assert.equal(statusLine(doc, facts), 'preview-1 (preview): 0.26.0 · 2 running, 1 unwell: events · backup FAILED 2026-11-14T02:00 · upgrade 0.26.0→0.27.0 rolled-back (events did not answer) · no apps');
});

test('a new server’s .env is .env.example with the file’s values in place', () => {
  const example = '# The release\nPLATFORM_VERSION=\nPLATFORM_URL=https://platform.example-tailnet.ts.net\n# SERVER_RING=production\nPOSTGRES_PASSWORD=\n';
  assert.equal(newEnv(example, { PLATFORM_VERSION: '0.27.0', SERVER_RING: 'preview', PLATFORM_URL: 'https://p', TS_AUTHKEY: 'k' }), '# The release\nPLATFORM_VERSION=0.27.0\nPLATFORM_URL=https://p\nSERVER_RING=preview\nPOSTGRES_PASSWORD=\nTS_AUTHKEY=k\n');
  const script = fetchScript(doc, 'acme/augur');
  assert.match(script, /releases\/download\/augur%400\.27\.0\/augur-deploy-0\.27\.0\.tar\.gz/);
  assert.match(script, /is installed already/);
  assert.equal(q("it's"), `'it'\\''s'`);
});
