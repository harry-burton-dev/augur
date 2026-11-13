// AUGUR's own services behind the gateway: every open tab holds streams from them, and the streams must never take
// the connections the services' other calls need. A service that stops answering is named, in time.
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import type { AuthConfig } from './auth.ts';
import { DEFAULT_APP_LIMITS, DEFAULT_PLATFORM_LIMITS, platformLimitsFromEnv } from './limits.ts';
import { HealthMonitor } from './status.ts';

const issuer = 'http://sign-in.test/realms/platform';

describe('limits on AUGUR’s services', () => {
  it('read the settings, falling back to the defaults for anything missing or malformed', () => {
    expect(platformLimitsFromEnv({})).toEqual(DEFAULT_PLATFORM_LIMITS);
    expect(platformLimitsFromEnv({ GATEWAY_SERVICE_RESPONSE_TIMEOUT_MS: '5000', GATEWAY_SERVICE_CONNECTIONS: 'many', GATEWAY_STREAM_CONNECTIONS: '0' })).toEqual({ ...DEFAULT_PLATFORM_LIMITS, responseTimeoutMs: 5000 });
  });
});

describe('services’ streams at the gateway', () => {
  let events: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let sign: () => Promise<string>;
  /** Each open stream's way to end it, keyed by what the test called it. */
  const open = new Map<string, () => void>();

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    auth = { issuer, audience: 'platform-api', keys: createLocalJWKSet({ keys: [jwk] }) };
    sign = () => new SignJWT({ sub: 'u-1', name: 'Alex' }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(issuer).setAudience('platform-api').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    events = Fastify();
    // A stream stays open until the test ends it, as a tab's would, and says something every 200 ms.
    events.get('/v1/:resource/stream', (req, reply: FastifyReply) => {
      reply.hijack();
      reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      reply.raw.write(': open\n\n');
      const tick = setInterval(() => reply.raw.write(': tick\n\n'), 200);
      const key = String((req.query as { k?: string }).k ?? Math.random());
      const end = () => {
        clearInterval(tick);
        reply.raw.end();
      };
      open.set(key, end);
      reply.raw.on('close', () => {
        clearInterval(tick);
        open.delete(key);
      });
    });
    events.get('/v1/notifications', async () => ({ items: [] }));
    events.get('/v1/slow', () => new Promise((resolve) => setTimeout(() => resolve({ late: true }), 2_500)));
    url = await events.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => {
    for (const end of open.values()) end();
    events.server.closeAllConnections();
    await events.close();
  });

  const gateway = (platform: Partial<typeof DEFAULT_PLATFORM_LIMITS> = {}, upstreams: Record<string, string> = { events: url }) =>
    buildApp({ upstreams, auth, monitor: new HealthMonitor({ probes: [] }), limits: DEFAULT_APP_LIMITS, platformLimits: { ...DEFAULT_PLATFORM_LIMITS, ...platform } });

  const endAll = () => {
    for (const end of open.values()) end();
  };

  it('still answers the events service’s other calls with 130 streams open', async () => {
    const app = await gateway();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const aborter = new AbortController();
    try {
      const headers = { authorization: `Bearer ${await sign()}` };
      // Two streams a tab, as the shell holds them: 65 tabs.
      const streams = await Promise.all(
        Array.from({ length: 130 }, (_, i) => fetch(`${address}/api/events/v1/${i % 2 ? 'domain-events' : 'notifications'}/stream?k=t${i}`, { headers, signal: aborter.signal })),
      );
      expect(streams.every((s) => s.status === 200)).toBe(true);
      const started = performance.now();
      const res = await fetch(`${address}/api/events/v1/notifications`, { headers, signal: AbortSignal.timeout(2_000) });
      expect(res.status).toBe(200);
      expect(performance.now() - started).toBeLessThan(2_000);
    } finally {
      aborter.abort();
      endAll();
      await app.close();
    }
  }, 15_000);

  it('holds a service’s streams of every kind in one budget', async () => {
    // A budget of one stream: a stream of a second kind waits for the first to close.
    const app = await gateway({ streamConnections: 1 });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const aborter = new AbortController();
    try {
      const headers = { authorization: `Bearer ${await sign()}` };
      const first = await fetch(`${address}/api/events/v1/notifications/stream?k=b1`, { headers, signal: aborter.signal });
      expect(first.status).toBe(200);
      // The second kind waits behind the first: the budget is one stream, not one of each kind.
      const second = fetch(`${address}/api/events/v1/domain-events/stream?k=b2`, { headers, signal: aborter.signal });
      const waited = await Promise.race([second.then(() => 'answered'), new Promise((resolve) => setTimeout(() => resolve('waiting'), 1_000))]);
      expect(waited).toBe('waiting');
      open.get('b1')?.();
      expect((await second).status).toBe(200);
    } finally {
      aborter.abort();
      endAll();
      await app.close();
    }
  }, 15_000);

  // undici's timers tick about once a second, so a service that is late by two seconds is late enough.
  it('answers 504 naming the service when it takes longer than the response timeout, and leaves a stream open past it', async () => {
    const app = await gateway({ responseTimeoutMs: 300 });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const aborter = new AbortController();
    try {
      const headers = { authorization: `Bearer ${await sign()}` };
      const stream = await fetch(`${address}/api/events/v1/notifications/stream?k=d1`, { headers, signal: aborter.signal });
      const reader = stream.body!.getReader();
      await reader.read();
      const slow = await fetch(`${address}/api/events/v1/slow`, { headers });
      expect(slow.status).toBe(504);
      expect(await slow.json()).toMatchObject({ error: 'timeout', message: 'AUGUR’s events service didn’t answer in time.' });
      // Well past the deadline, this stream still brings what the service says.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const later = await reader.read();
      expect(later.done).toBe(false);
      expect(new TextDecoder().decode(later.value)).toContain(': tick');
    } finally {
      aborter.abort();
      endAll();
      await app.close();
    }
  }, 15_000);

  it('answers 502 naming the service when it can’t be reached', async () => {
    const app = await gateway({}, { events: 'http://127.0.0.1:1' });
    const res = await app.inject({ method: 'GET', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await sign()}` } });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'bad_gateway', message: 'AUGUR’s events service isn’t answering right now.' });
  });
});
