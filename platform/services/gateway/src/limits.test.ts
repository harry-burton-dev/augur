// The brakes on an app's part (spec 7.5): a part that doesn't answer in time, or can't be reached, or has too many
// calls in flight, answers in words, while AUGUR's own routes are untouched.
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import type { AuthConfig } from './auth.ts';
import { appFailure, appLimitsFromEnv, DEFAULT_APP_LIMITS, InFlight } from './limits.ts';
import { HealthMonitor } from './status.ts';

const issuer = 'http://sign-in.test/realms/platform';

describe('app limits', () => {
  it('read the settings, falling back to the defaults for anything missing or malformed', () => {
    expect(appLimitsFromEnv({})).toEqual(DEFAULT_APP_LIMITS);
    expect(appLimitsFromEnv({ APP_CONNECT_TIMEOUT_MS: '2000', APP_RESPONSE_TIMEOUT_MS: 'soon', APP_CONCURRENT_CALLS: '0' })).toEqual({ ...DEFAULT_APP_LIMITS, connectTimeoutMs: 2000 });
  });

  it('count calls in flight per app up to the cap', () => {
    const inFlight = new InFlight(2);
    expect([inFlight.take('a'), inFlight.take('a'), inFlight.take('a'), inFlight.take('b')]).toEqual([true, true, false, true]);
    inFlight.release('a');
    expect(inFlight.take('a')).toBe(true);
    expect(inFlight.of('b')).toBe(1);
  });

  it('say what went wrong at the app’s door, and nothing for other errors', () => {
    expect(appFailure(Object.assign(new Error('x'), { code: 'FST_REPLY_FROM_GATEWAY_TIMEOUT' }), 'Notes')).toEqual({ status: 504, message: 'Notes didn’t answer in time.' });
    // reply-from wraps what undici said; the cause carries the code.
    expect(appFailure(Object.assign(new Error('wrapped'), { code: 'FST_REPLY_FROM_INTERNAL_SERVER_ERROR', cause: Object.assign(new Error('x'), { code: 'ECONNREFUSED' }) }), 'Notes')).toEqual({ status: 502, message: 'Notes isn’t answering right now.' });
    expect(appFailure(new Error('x'), 'Notes')).toBeUndefined();
  });
});

describe('an app route at the gateway', () => {
  let part: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let sign: () => Promise<string>;
  let release: (() => void)[] = [];

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    auth = { issuer, audience: 'platform-api', keys: createLocalJWKSet({ keys: [jwk] }) };
    sign = () => new SignJWT({ sub: 'u-1', name: 'Alex' }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(issuer).setAudience('platform-api').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    part = Fastify();
    part.get('/v1/quick', async () => ({ ok: true }));
    part.get('/v1/slow', () => new Promise((resolve) => setTimeout(() => resolve({ late: true }), 2_500)));
    // Answers only when the test lets it, so calls pile up.
    part.get('/v1/held', () => new Promise<{ held: true }>((resolve) => release.push(() => resolve({ held: true }))));
    url = await part.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => part.close());

  const access = async () => new Map([['notes', { name: 'Notes', maxUpload: 10 }]]);
  const gateway = (limits: Partial<typeof DEFAULT_APP_LIMITS> = {}) =>
    buildApp({ upstreams: { registry: url, notes: url }, auth, access, monitor: new HealthMonitor({ probes: [] }), limits: { ...DEFAULT_APP_LIMITS, responseTimeoutMs: 300, connectTimeoutMs: 300, ...limits } });
  const get = async (app: Awaited<ReturnType<typeof buildApp>>, path: string) => app.inject({ method: 'GET', url: path, headers: { authorization: `Bearer ${await sign()}` } });

  // undici's timers tick about once a second, so a part that is late by two seconds is late enough.
  it('answers 504 in words when the part takes longer than the response timeout, while a platform route still answers', async () => {
    const app = await gateway();
    const [slow, quick, platform] = await Promise.all([get(app, '/api/notes/v1/slow'), get(app, '/api/notes/v1/quick'), get(app, '/api/registry/v1/slow')]);
    expect(slow.statusCode).toBe(504);
    expect(slow.json()).toMatchObject({ error: 'timeout', message: 'Notes didn’t answer in time.' });
    expect(quick.statusCode).toBe(200);
    // AUGUR's own services keep their own time.
    expect(platform.statusCode).toBe(200);
  }, 10_000);

  it('answers 502 in words when the part can’t be reached', async () => {
    const app = await buildApp({ upstreams: { notes: 'http://127.0.0.1:1' }, auth, access, monitor: new HealthMonitor({ probes: [] }) });
    const res = await get(app, '/api/notes/v1/quick');
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'bad_gateway', message: 'Notes isn’t answering right now.' });
  });

  it('answers 503 in words past the app’s cap on calls in flight, and takes calls again once one finishes', async () => {
    const app = await gateway({ concurrentCalls: 2, responseTimeoutMs: 5_000 });
    release = [];
    const first = get(app, '/api/notes/v1/held');
    const second = get(app, '/api/notes/v1/held');
    await new Promise((r) => setTimeout(r, 100));
    expect(release).toHaveLength(2);
    const third = await get(app, '/api/notes/v1/quick');
    expect(third.statusCode).toBe(503);
    expect(third.json()).toMatchObject({ error: 'unavailable', message: 'Notes is busy; try again in a moment.' });
    // Platform routes are never held by an app's cap.
    expect((await get(app, '/api/registry/v1/quick')).statusCode).toBe(200);
    release.forEach((r) => r());
    expect((await Promise.all([first, second])).map((r) => r.statusCode)).toEqual([200, 200]);
    expect((await get(app, '/api/notes/v1/quick')).statusCode).toBe(200);
  });
});
