import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, parseUpstreams } from './app.ts';
import type { AuthConfig } from './auth.ts';
import { HealthMonitor } from './status.ts';

const issuer = 'http://sign-in.test/realms/platform';
const audience = 'platform-api';

describe('gateway', () => {
  let upstream: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let sign: (claims: JWTPayload, opts?: { expiresIn?: string; issuer?: string }) => Promise<string>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    auth = { issuer, audience, keys: createLocalJWKSet({ keys: [jwk] }) };
    sign = (claims, opts = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(opts.issuer ?? issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(opts.expiresIn ?? '5m')
        .sign(privateKey);

    upstream = Fastify();
    upstream.get('/echo', async (req) => req.headers);
    upstream.get('/healthz', async () => ({ status: 'ok', service: 'registry', version: '0.4.0', api: 'v1' }));
    url = await upstream.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => upstream.close());

  const ada = { sub: 'u-1', name: 'Alex Rivera', email: 'alex@example.org', roles: ['admin'], departments: ['Finance'] };

  it('reports healthy without signing in', async () => {
    const app = await buildApp({ upstreams: {}, auth });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('turns away a request with no token', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth });
    const res = await app.inject({ method: 'GET', url: '/api/registry/echo' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.json().message).toBe('Sign in to continue.');
  });

  it('forwards a signed-in request with the caller in headers', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth });
    const res = await app.inject({
      method: 'GET',
      url: '/api/registry/echo',
      headers: { authorization: `Bearer ${await sign(ada)}` },
    });
    expect(res.statusCode).toBe(200);
    const headers = res.json();
    expect(headers['x-user-id']).toBe('u-1');
    expect(headers['x-user-name']).toBe('Alex%20Rivera');
    expect(headers['x-user-roles']).toBe('admin');
    expect(headers['x-user-departments']).toBe('Finance');
  });

  it('never passes on caller headers a client sent itself', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth });
    const res = await app.inject({
      method: 'GET',
      url: '/api/registry/echo',
      headers: {
        authorization: `Bearer ${await sign({ sub: 'u-2' })}`,
        'x-user-roles': 'admin',
        'x-user-id': 'someone-else',
        'x-service-token': 'guessed',
        'x-service-name': 'registry',
      },
    });
    expect(res.json()['x-user-id']).toBe('u-2');
    expect(res.json()['x-service-token']).toBeUndefined();
    expect(res.json()['x-service-name']).toBeUndefined();
    expect(res.json()['x-user-roles']).toBe('');
  });

  it('rejects expired tokens and tokens from another issuer', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth });
    const expired = await sign(ada, { expiresIn: '-1m' });
    const foreign = await sign(ada, { issuer: 'http://elsewhere.test' });
    const a = await app.inject({ method: 'GET', url: '/api/registry/echo', headers: { authorization: `Bearer ${expired}` } });
    const b = await app.inject({ method: 'GET', url: '/api/registry/echo', headers: { authorization: `Bearer ${foreign}` } });
    expect([a.statusCode, a.json().message]).toEqual([401, 'Your sign-in has expired. Sign in again.']);
    expect([b.statusCode, b.json().message]).toEqual([401, 'Your sign-in is not valid. Sign in again.']);
  });

  it('says sign-in is unavailable when the signing keys cannot be fetched', async () => {
    const down: AuthConfig = { ...auth, keys: async () => Promise.reject(new TypeError('fetch failed')) };
    const app = await buildApp({ upstreams: { registry: url }, auth: down });
    const res = await app.inject({
      method: 'GET',
      url: '/api/registry/echo',
      headers: { authorization: `Bearer ${await sign(ada)}` },
    });
    expect(res.statusCode).toBe(503);
  });

  it('reads app services from a name=url list', () => {
    expect(parseUpstreams('library=http://library:8083, sample=http://sample:8090')).toEqual({
      library: 'http://library:8083',
      sample: 'http://sample:8090',
    });
    expect(parseUpstreams('')).toEqual({});
  });

  it('shows admins whether every part of the platform is answering', async () => {
    const monitor = new HealthMonitor({ probes: [{ name: 'registry', kind: 'service', url: `${url}/healthz` }] });
    await monitor.checkAll();
    const app = await buildApp({ upstreams: { registry: url }, auth, monitor });
    const res = await app.inject({ method: 'GET', url: '/api/gateway/v1/status', headers: { authorization: `Bearer ${await sign(ada)}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().components.map((c: { name: string; state: string; version: string }) => [c.name, c.state, c.version])).toEqual([
      ['gateway', 'up', expect.any(String)],
      ['registry', 'up', '0.4.0'],
    ]);
  });

  it('keeps the platform’s status from people who aren’t admins, and from nobody signed in', async () => {
    const app = await buildApp({ upstreams: {}, auth, monitor: new HealthMonitor({ probes: [] }) });
    const sam = await sign({ ...ada, sub: 'u-2', roles: [] });
    expect((await app.inject({ method: 'GET', url: '/api/gateway/v1/status', headers: { authorization: `Bearer ${sam}` } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/gateway/v1/status' })).statusCode).toBe(401);
  });
});
