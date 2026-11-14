// Every AUGUR service that answers calls stops cleanly and says when it is ready (PER-411): it runs through the
// service kit's serve(), its healthcheck asks /readyz, and Docker gives it longer to stop than serve() takes.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

/** How long serve() plans for Docker to wait (STOP_BUDGET_MS in the service kit), in seconds: its grace, closing and flush fit inside it. */
const budget = /export const STOP_BUDGET_MS = ([\d_]+);/.exec(read('platform/packages/service-kit/src/serve.ts'));
const STOP_BUDGET_SECONDS = Number(budget?.[1].replaceAll('_', '')) / 1000;

/** The platform services that listen for calls: each one whose index.ts starts a server. */
const listening = readdirSync(new URL('platform/services/', root)).filter((name) => {
  const index = new URL(`platform/services/${name}/src/index.ts`, root);
  return existsSync(index) && /\b(serve|listen)\(/.test(readFileSync(index, 'utf8'));
});

const seconds = (duration) => {
  const m = /^(\d+)(s|m)$/.exec(String(duration ?? ''));
  return m ? Number(m[1]) * (m[2] === 'm' ? 60 : 1) : 0;
};

test('every platform service that answers calls runs through serve()', () => {
  assert.ok(listening.length >= 7, `found ${listening.join(', ')}`);
  for (const name of listening) {
    const index = read(`platform/services/${name}/src/index.ts`);
    assert.match(index, /\bawait serve\(app,/, `${name} starts with serve()`);
    assert.doesNotMatch(index, /\bapp\.listen\(/, `${name} doesn't listen on its own`);
  }
});

test('compose asks each of them /readyz, and gives it time to stop', () => {
  assert.ok(STOP_BUDGET_SECONDS > 0, 'the service kit says how long serve() plans for Docker to wait');
  const { services } = parse(read('infra/deploy/compose.yml'), { merge: true });
  for (const name of listening) {
    const service = services[name];
    assert.ok(service, `${name} is in compose`);
    assert.match(JSON.stringify(service.healthcheck?.test ?? []), /127\.0\.0\.1:\d+\/readyz/, `${name}'s healthcheck asks /readyz`);
    assert.ok(seconds(service.stop_grace_period) >= STOP_BUDGET_SECONDS, `${name}'s stop_grace_period (${service.stop_grace_period ?? 'Docker’s 10s'}) is at least serve()'s ${STOP_BUDGET_SECONDS}s`);
  }
});
