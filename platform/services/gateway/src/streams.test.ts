// AUGUR's own services behind the gateway: every open tab holds the events service's streams, and they must never take
// the connections that the events service's other calls need. A service that stops answering answers in words, in time.
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import type { AuthConfig } from './auth.ts';
import { DEFAULT_APP_LIMITS, DEFAULT_PLATFORM_LIMITS, platformLimitsFromEnv } from './limits.ts';
import { HealthMonitor } from './status.ts';

const issuer = 'http://sign-in.test/realms/platform';

describe('platform limits', () => {
  it('read the settings, falling back to the defaults for anything missing or malformed', () => {
    expect(platformLimitsFromEnv({})).toEqual(DEFAULT_PLATFORM_LIMITS);
    expect(platformLimitsFromEnv({ PLATFORM_RESPONSE_TIMEOUT_MS: '5000', PLATFORM_CONNECTIONS: 'many', PLATFORM_STREAM_CONNECTIONS: '0' })).toEqual({ ...DEFAULT_PLATFORM_LIMITS, responseTimeoutMs: 5000 });
  });
});

describe('the events service’s streams at the gateway', () => {
  let events: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let sign: () => Promise<string>;
  const open = new Set<() => void>();

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    auth = { issuer, audience: 'platform-api', keys: createLocalJWKSet({ keys: [jwk] }) };
    sign = () => new SignJWT({ sub: 'u-1', name: 'Alex' }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(issuer).setAudience('platform-api').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    events = Fastify();
    // A stream stays open until the test ends it, as a tab's would.
    const stream = (_req: unknown, reply: import('fastify').FastifyReply) => {
      reply.hijack();
      reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      reply.raw.write(': open\n\n');
      const end = () => reply.raw.end();
      open.add(end);
      reply.raw.on('close', () => open.delete(end));
    };
    events.get('/v1/notifications/stream', stream);
    events.get('/v1/domain-events/stream', stream);
    events.get('/v1/notifications', async () => ({ items: [] }));
    events.get('/v1/slow', () => new Promise((resolve) => setTimeout(() => resolve({ late: true }), 2_500)));
    url = await events.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => {
    for (const end of open) end();
    events.server.closeAllConnections();
    await events.close();
  });

  const gateway = (platform: Partial<typeof DEFAULT_PLATFORM_LIMITS> = {}) =>
    buildApp({ upstreams: { events: url }, auth, monitor: new HealthMonitor({ probes: [] }), limits: DEFAULT_APP_LIMITS, platformLimits: { ...DEFAULT_PLATFORM_LIMITS, ...platform } });

  it('still answers the events service’s other calls with 130 streams open', async () => {
    const app = await gateway();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const aborter = new AbortController();
    try {
      const token = await sign();
      const headers = { authorization: `Bearer ${token}` };
      // Two streams a tab, as the shell holds them: 65 tabs.
      const streams = await Promise.all(
        Array.from({ length: 130 }, (_, i) =>
          fetch(`${address}/api/events/v1/${i % 2 ? 'domain-events' : 'notifications'}/stream`, { headers, signal: aborter.signal }),
        ),
      );
      expect(streams.every((s) => s.status === 200)).toBe(true);
      const started = performance.now();
      const res = await fetch(`${address}/api/events/v1/notifications`, { headers, signal: AbortSignal.timeout(2_000) });
      expect(res.status).toBe(200);
      expect(performance.now() - started).toBeLessThan(2_000);
    } finally {
      aborter.abort();
      for (const end of open) end();
      await app.close();
    }
  }, 15_000);

  // undici's timers tick about once a second, so a service that is late by two seconds is late enough.
  it('answers 504 naming the service when it takes longer than the response timeout, and leaves a stream open past it', async () => {
    const app = await gateway({ responseTimeoutMs: 300 });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const aborter = new AbortController();
    try {
      const token = await sign();
      const headers = { authorization: `Bearer ${token}` };
      const stream = await fetch(`${address}/api/events/v1/notifications/stream`, { headers, signal: aborter.signal });
      const slow = await fetch(`${address}/api/events/v1/slow`, { headers });
      expect(slow.status).toBe(504);
      expect(await slow.json()).toMatchObject({ error: 'timeout', message: 'AUGUR’s events service didn’t answer in time.' });
      // The stream has outlived the deadline and is still being read.
      const reader = stream.body!.getReader();
      const first = await reader.read();
      expect(first.done).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      expect(open.size).toBeGreaterThan(0);
    } finally {
      aborter.abort();
      for (const end of open) end();
      await app.close();
    }
  }, 15_000);
});
