import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp, defaultUpstreams, parseUpstreams } from './app.ts';
import type { AuthConfig } from './auth.ts';
import { HealthMonitor } from './status.ts';
import { FloorLookupError, identityFloors, type FloorLookup } from './floors.ts';

const issuer = 'http://sign-in.test/realms/platform';
const audience = 'platform-api';

describe('gateway', () => {
  let upstream: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let sign: (claims: JWTPayload, opts?: { expiresIn?: string; issuer?: string }) => Promise<string>;
  let signingKey: CryptoKey;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    signingKey = privateKey;
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
      },
    });
    expect(res.json()['x-user-id']).toBe('u-2');
    expect(res.json()['x-user-roles']).toBe('');
  });

  it('checks sign-in however the path is spelt', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth, monitor: new HealthMonitor({ probes: [] }) });
    // The router decodes these to /api/registry/echo; none may skip the check.
    for (const path of ['/%61pi/registry/echo', '/api/%72egistry/echo', '/%2561pi/registry/echo', '/nothing-here']) {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode, path).toBe(401);
    }
  });

  it('keeps the person’s token to itself: services get the caller, never the token', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth, monitor: new HealthMonitor({ probes: [] }) });
    const res = await app.inject({ method: 'GET', url: '/api/registry/echo', headers: { authorization: `Bearer ${await sign(ada)}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().authorization).toBeUndefined();
    expect(res.json()['x-user-id']).toBe('u-1');
  });

  it('turns away an app’s own service token: services are reached only inside', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth });
    const appToken = await new SignJWT({ azp: 'app-library' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(issuer)
      .setAudience('platform-services')
      .setExpirationTime('5m')
      .sign(signingKey);
    const res = await app.inject({ method: 'GET', url: '/api/registry/echo', headers: { authorization: `Bearer ${appToken}` } });
    expect(res.statusCode).toBe(401);
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

  it('gives every request an id, passes it on, and hands it back', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth, monitor: new HealthMonitor({ probes: [] }) });
    const token = `Bearer ${await sign(ada)}`;
    const res = await app.inject({ method: 'GET', url: '/api/registry/echo', headers: { authorization: token } });
    expect(res.json()['x-request-id']).toBe(res.headers['x-request-id']);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('adds backups to the status when it knows where they are', async () => {
    const app = await buildApp({ upstreams: {}, auth, monitor: new HealthMonitor({ probes: [] }), backupDir: '/nowhere' });
    const res = await app.inject({ method: 'GET', url: '/api/gateway/v1/status', headers: { authorization: `Bearer ${await sign(ada)}` } });
    expect(res.json().backups).toEqual({ state: 'attention', problem: 'No backup has been taken yet.' });
  });

  describe('floors', () => {
    const finance = { id: 'w-finance', kind: 'team' as const, role: 'lead' as const };
    const floors: FloorLookup = async (caller) => (caller.id === 'u-1' ? [{ id: 'w-me', kind: 'personal', role: 'lead' }, finance] : []);
    const echo = async (app: FastifyInstance, headers: Record<string, string>) =>
      app.inject({ method: 'GET', url: '/api/registry/echo', headers: { authorization: `Bearer ${await sign(ada)}`, ...headers } });

    it('passes on a floor the caller is on, with its kind and their role', async () => {
      const app = await buildApp({ upstreams: { registry: url }, auth, floors, monitor: new HealthMonitor({ probes: [] }) });
      const res = await echo(app, { 'x-workspace-id': 'w-finance', 'x-workspace-role': 'member', 'x-workspace-kind': 'org' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ 'x-workspace-id': 'w-finance', 'x-workspace-kind': 'team', 'x-workspace-role': 'lead' });
    });

    it('refuses a floor the caller is not on', async () => {
      const app = await buildApp({ upstreams: { registry: url }, auth, floors, monitor: new HealthMonitor({ probes: [] }) });
      const res = await echo(app, { 'x-workspace-id': 'w-legal' });
      expect(res.statusCode).toBe(403);
    });

    it('never passes on floor headers a client sent without an id', async () => {
      const app = await buildApp({ upstreams: { registry: url }, auth, floors, monitor: new HealthMonitor({ probes: [] }) });
      const res = await echo(app, { 'x-workspace-kind': 'org', 'x-workspace-role': 'lead' });
      expect(res.json()['x-workspace-kind']).toBeUndefined();
      expect(res.json()['x-workspace-role']).toBeUndefined();
    });

    it('says floors are unavailable when identity cannot say', async () => {
      const app = await buildApp({ upstreams: { registry: url }, auth, floors: async () => Promise.reject(new FloorLookupError('down')), monitor: new HealthMonitor({ probes: [] }) });
      expect((await echo(app, { 'x-workspace-id': 'w-finance' })).statusCode).toBe(503);
      expect((await echo(app, {})).statusCode).toBe(200);
    });

    it('asks identity once per person while the answer is fresh, and again after a failure', async () => {
      let t = 0;
      const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        expect((init?.headers as Record<string, string>)['x-user-id']).toBe('u-1');
        return Response.json({ workspaces: [{ ...finance, name: 'Finance', slug: 'finance', path: [], direct: true }] });
      });
      const lookup = identityFloors({ identityUrl: 'http://identity', ttlMs: 1000, fetchImpl: fetchImpl as typeof fetch, now: () => t });
      const alex = { id: 'u-1', name: 'Alex', departments: [], roles: [] };
      expect(await lookup(alex)).toEqual([finance]);
      await lookup(alex);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      t = 1001;
      await lookup(alex);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      fetchImpl.mockRejectedValueOnce(new TypeError('fetch failed'));
      t = 3000;
      await expect(lookup(alex)).rejects.toBeInstanceOf(FloorLookupError);
      expect(await lookup(alex)).toEqual([finance]);
    });
  });

  it('reads app services from a name=url list', () => {
    expect(parseUpstreams('library=http://library:8083, sample=http://sample:8090')).toEqual({
      library: 'http://library:8083',
      sample: 'http://sample:8090',
    });
    expect(parseUpstreams('')).toEqual({});
  });

  it('refuses an app service named like a platform service', () => {
    expect(() => defaultUpstreams({ APP_UPSTREAMS: 'identity=http://elsewhere:9000' })).toThrow(/can't name identity/);
    expect(defaultUpstreams({ APP_UPSTREAMS: 'library=http://library:8083' }).library).toBe('http://library:8083');
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
