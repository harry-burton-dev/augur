// Services check the gateway's signed caller unless they are told not to (docs/signed-caller.md), and
// always in production. These hold every way a deployment starts a service to NODE_ENV=production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('every Node stage an image runs from sets NODE_ENV=production', () => {
  const stages = read('infra/service.Dockerfile').split(/^FROM /m).slice(1);
  const running = stages.filter((s) => /^CMD \["node"/m.test(s));
  assert.ok(running.length >= 3, 'the service, registry and updater stages run node');
  for (const stage of running) assert.match(stage, /^ENV NODE_ENV=production$/m, `stage ${stage.split('\n')[0]}`);
});

test('compose runs every AUGUR service in production, and never lets them believe plain caller headers', () => {
  const text = read('infra/deploy/compose.yml');
  assert.doesNotMatch(text, /AUGUR_INSECURE_DEV_CALLERS/);
  const { services } = parse(text, { merge: true });
  for (const [name, service] of Object.entries(services)) {
    const env = service.environment ?? {};
    if ('NODE_ENV' in env) assert.equal(env.NODE_ENV, 'production', name);
  }
  for (const name of ['gateway', 'identity', 'registry', 'events', 'models', 'updater']) assert.equal(services[name]?.environment?.NODE_ENV, 'production', name);
});

test('a deployment can’t name the dev setting', () => {
  assert.doesNotMatch(read('infra/deploy/.env.example'), /AUGUR_INSECURE_DEV_CALLERS/);
  assert.equal(JSON.parse(read('infra/deploy/settings.schema.json')).properties?.AUGUR_INSECURE_DEV_CALLERS, undefined);
});
