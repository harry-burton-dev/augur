import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { reachCheck, readTargets, tryLogin } from '../infra/app-reach-check.mjs';

const servers = [];
after(() => servers.forEach((s) => s.close()));
/** A local server that answers each connection's first bytes with `answer` (nothing: it only accepts). */
const listening = async (answer) => {
  const server = createServer((s) => s.on('data', () => answer && s.write(answer)));
  servers.push(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return server.address().port;
};
/** A port nothing listens on. */
const closed = async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  await new Promise((r) => server.close(r));
  return port;
};
const pgError = (code, message) => {
  const fields = Buffer.from(`SFATAL\0C${code}\0M${message}\0\0`);
  const head = Buffer.alloc(5);
  head.write('E', 0);
  head.writeInt32BE(4 + fields.length, 1);
  return Buffer.concat([head, fields]);
};
// What Postgres says first to a login it will let on: "send a password" (R, an authentication request).
const passwordPlease = Buffer.from([0x52, 0, 0, 0, 12, 0, 0, 0, 5, 1, 2, 3, 4]);
const at = (port, name = 'x') => ({ name, host: '127.0.0.1', port });
const relayRefusal = pgError('28000', 'Through the apps’ relay, only an app’s own login reaches Postgres, never AUGUR’s own logins.');

test('passes when the gateway is reached and none of AUGUR’s other containers is', async () => {
  const lines = await reachCheck({ mustReach: [at(await listening(), 'the gateway')], mustNotReach: [at(await closed(), 'identity')] }, 500);
  assert.ok(lines.every((l) => l.ok), lines.map((l) => l.line).join('\n'));
});

test('fails when an app can reach one of AUGUR’s containers, such as the sign-in service', async () => {
  const lines = await reachCheck({ mustNotReach: [at(await listening(), 'keycloak')] }, 500);
  assert.equal(lines[0].ok, false);
  assert.match(lines[0].line, /REACHED, and an app must never reach it/);
});

test('fails when the gateway isn’t reached, since then it isn’t looking from the app’s network', async () => {
  const [line] = await reachCheck({ mustReach: [at(await closed(), 'the gateway')] }, 500);
  assert.equal(line.ok, false);
  assert.match(line.line, /isn't looking from the app's network/);
});

test('passes on a database only when the relay is there and turns AUGUR’s own logins away', async () => {
  const relay = await listening(relayRefusal);
  const [good] = await reachCheck({ database: { ...at(relay), logins: ['platform'] } }, 500);
  assert.equal(good.ok, true, good.line);
  // Postgres itself, letting the login as far as a password.
  const [open] = await reachCheck({ database: { ...at(await listening(passwordPlease)), logins: ['platform'] } }, 500);
  assert.match(open.line, /ACCEPTED/);
  // Nothing there: nothing was tested, so it fails rather than passing quietly.
  const [none] = await reachCheck({ database: { ...at(await closed()), logins: ['platform'] } }, 500);
  assert.equal(none.ok, false);
  assert.match(none.line, /the relay should be there/);
  // The relay saying it can't reach Postgres is a 28000 too, but proves nothing.
  const down = await listening(pgError('28000', 'The apps’ relay can’t reach Postgres right now.'));
  const [unproven] = await reachCheck({ database: { ...at(down), logins: ['platform'] } }, 500);
  assert.equal(unproven.ok, false);
  assert.equal(await tryLogin(at(relay), 'platform_identity', 500), 'refused (28000): Through the apps’ relay, only an app’s own login reaches Postgres, never AUGUR’s own logins.');
});

test('wants the targets spelled out: at least the gateway and one of AUGUR’s containers', () => {
  assert.throws(() => readTargets(undefined));
  assert.throws(() => readTargets('{"mustReach":[],"mustNotReach":[]}'), /gateway/);
  assert.throws(() => readTargets(JSON.stringify({ mustReach: [at(1)], mustNotReach: [] })), /AUGUR/);
  assert.ok(readTargets(JSON.stringify({ mustReach: [at(1)], mustNotReach: [at(2)], database: { host: 'postgres', port: 5432, logins: ['platform'] } })));
});

test('run as a script, it exits 1 on a wrong target and 2 without targets', async () => {
  const script = fileURLToPath(new URL('../infra/app-reach-check.mjs', import.meta.url));
  const run = (env) => promisify(execFile)(process.execPath, [script], { env: { ...process.env, ...env } }).then(() => 0, (err) => err.code);
  assert.equal(await run({ REACH_TARGETS: '' }), 2);
  assert.equal(await run({ REACH_TARGETS: JSON.stringify({ mustReach: [at(await listening())], mustNotReach: [at(await listening())] }) }), 1);
  assert.equal(await run({ REACH_TARGETS: JSON.stringify({ mustReach: [at(await listening())], mustNotReach: [at(await closed())] }) }), 0);
});
