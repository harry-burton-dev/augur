import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CALLER_KEYS_PATH, callerCheckFor, callerSigner } from '@augur/service-kit';
import { buildApp, defaultUpstreams, parseUpstreams } from './app.ts';
import type { AuthConfig } from './auth.ts';
import { HealthMonitor } from './status.ts';
import { Mailer, NO_RELAY } from '@augur/service-kit/mail';
import { FloorLookupError, identityFloors, type FloorLookup } from './floors.ts';
import { AppAccessUnavailable, registryAppAccess } from './uploads.ts';
import { registryUpstreams, UpstreamsUnavailable } from './upstreams.ts';
import { Readable } from 'node:stream';

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
    // Counts what it was sent, as it arrives.
    upstream.addContentTypeParser('*', (_req, payload, done) => done(null, payload));
    upstream.post('/upload', async (req) => {
      let bytes = 0;
      for await (const chunk of req.body as Readable) bytes += (chunk as Buffer).length;
      return { bytes };
    });
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
    expect(headers['x-user-signed-in-at']).toBeUndefined();
  });

  it('passes on when the caller last entered their password, and never a client’s claim to it', async () => {
    const app = await buildApp({ upstreams: { registry: url }, auth });
    const res = await app.inject({
      method: 'GET',
      url: '/api/registry/echo',
      headers: { authorization: `Bearer ${await sign({ ...ada, auth_time: 1_793_000_000 })}`, 'x-user-signed-in-at': '2099-01-01T00:00:00Z' },
    });
    expect(res.json()['x-user-signed-in-at']).toBe(new Date(1_793_000_000_000).toISOString());
    const without = await app.inject({ method: 'GET', url: '/api/registry/echo', headers: { authorization: `Bearer ${await sign(ada)}`, 'x-user-signed-in-at': '2099-01-01T00:00:00Z' } });
    expect(without.json()['x-user-signed-in-at']).toBeUndefined();
  });

  it('signs the caller for the one service the request goes to', async () => {
    const signer = callerSigner();
    const app = await buildApp({ upstreams: { registry: url }, auth, signer });
    const res = await app.inject({
      method: 'GET',
      url: '/api/registry/echo',
      headers: { authorization: `Bearer ${await sign(ada)}`, 'x-augur-caller': 'forged' },
    });
    const token = res.json()['x-augur-caller'];
    expect(token).not.toBe('forged');
    expect(await callerCheckFor(signer, 'registry')(token)).toEqual({ id: 'u-1', name: 'Alex Rivera', email: 'alex@example.org', roles: ['admin'], departments: ['Finance'] });
    await expect(callerCheckFor(signer, 'identity')(token)).rejects.toThrow(/not valid/);
  });

  it('publishes the key it signs callers with, to anyone', async () => {
    const signer = callerSigner();
    const app = await buildApp({ upstreams: {}, auth, signer, monitor: new HealthMonitor({ probes: [] }) });
    const res = await app.inject({ method: 'GET', url: CALLER_KEYS_PATH });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(await signer.keys());
    expect(res.json().keys[0]).toMatchObject({ kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA' });
    expect(res.json().keys[0].d).toBeUndefined();
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

  describe('uploads', () => {
    const MB = 1024 * 1024;
    const limits = async () => new Map<string, { maxUpload?: number }>([['folio', { maxUpload: 2 }], ['other', {}]]);
    const upload = async (app: FastifyInstance, to: string, payload: Buffer | Readable) =>
      app.inject({ method: 'POST', url: `/api/${to}/upload`, headers: { authorization: `Bearer ${await sign(ada)}`, 'content-type': 'application/octet-stream' }, payload });
    const gateway = (access = limits) => buildApp({ upstreams: { folio: url, other: url, registry: url }, auth, access, monitor: new HealthMonitor({ probes: [] }) });

    it('passes a body up to the app’s limit on to it whole', async () => {
      const res = await upload(await gateway(), 'folio', Buffer.alloc(MB + 5));
      expect(res.json()).toEqual({ bytes: MB + 5 });
    });

    it('refuses a body past the app’s limit before sending it on', async () => {
      const res = await upload(await gateway(), 'folio', Buffer.alloc(2 * MB + 1));
      expect(res.statusCode).toBe(413);
      expect(res.json()).toMatchObject({ error: 'too_large', message: 'This is more than folio takes at once (2 MB).' });
    });

    it('cuts off a streamed body once it passes the limit', async () => {
      const chunks = function* () {
        for (let i = 0; i < 6; i++) yield Buffer.alloc(MB / 2);
      };
      const res = await upload(await gateway(), 'folio', Readable.from(chunks()));
      expect(res.statusCode).toBe(413);
      const fits = await upload(await gateway(), 'folio', Readable.from([Buffer.alloc(MB), Buffer.alloc(MB)]));
      expect(fits.json()).toEqual({ bytes: 2 * MB });
    });

    it('holds an app without a limit of its own to 10 MB, and leaves the platform’s services to theirs', async () => {
      expect((await upload(await gateway(), 'other', Buffer.alloc(10 * MB + 1))).statusCode).toBe(413);
      expect((await upload(await gateway(), 'registry', Buffer.alloc(10 * MB + 1))).json()).toEqual({ bytes: 10 * MB + 1 });
    });

    it('says so when the limit can’t be checked', async () => {
      const res = await upload(await gateway(async () => Promise.reject(new AppAccessUnavailable('down'))), 'folio', Buffer.alloc(10));
      expect(res.statusCode).toBe(503);
    });
  });

  describe('apps on a floor', () => {
    const org = { id: 'w-org', kind: 'org' as const, role: 'member' as const };
    const finance = { id: 'w-finance', kind: 'team' as const, role: 'member' as const };
    const floors: FloorLookup = async () => [org, finance];
    // Folio is on for everyone; notes only on the finance floor.
    const access = vi.fn(async (caller: { workspace?: { id: string } }) =>
      new Map<string, { maxUpload?: number }>(caller.workspace?.id === 'w-finance' ? [['folio', {}], ['notes', {}]] : [['folio', {}]]),
    );
    const gateway = () => buildApp({ upstreams: { folio: url, notes: url, registry: url }, auth, floors, access, monitor: new HealthMonitor({ probes: [] }) });
    const call = async (app: FastifyInstance, to: string, headers: Record<string, string> = {}) =>
      app.inject({ method: 'GET', url: `/api/${to}/echo`, headers: { authorization: `Bearer ${await sign(ada)}`, ...headers } });

    it('passes a call on to an app that is on for the caller on their floor', async () => {
      const res = await call(await gateway(), 'notes', { 'x-workspace-id': 'w-finance' });
      expect(res.statusCode).toBe(200);
      expect(access).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'u-1', workspace: finance }));
    });

    it('refuses a call to an app that is off for the caller on that floor', async () => {
      const app = await gateway();
      expect((await call(app, 'notes', { 'x-workspace-id': 'w-org' })).statusCode).toBe(403);
    });

    it('checks a call that names no floor on the organisation’s, without passing that floor on', async () => {
      const app = await gateway();
      expect((await call(app, 'notes')).statusCode).toBe(403);
      expect(access).toHaveBeenLastCalledWith(expect.objectContaining({ workspace: org }));
      const res = await call(app, 'folio');
      expect(res.statusCode).toBe(200);
      expect(res.json()['x-workspace-id']).toBeUndefined();
    });

    it('leaves the platform’s own services to check their callers', async () => {
      const app = await buildApp({ upstreams: { registry: url }, auth, floors, access: async () => new Map(), monitor: new HealthMonitor({ probes: [] }) });
      expect((await call(app, 'registry')).statusCode).toBe(200);
    });

    it('says so when it can’t find out', async () => {
      const app = await buildApp({ upstreams: { notes: url }, auth, floors: async () => Promise.reject(new FloorLookupError('down')), access, monitor: new HealthMonitor({ probes: [] }) });
      expect((await call(app, 'notes')).statusCode).toBe(503);
    });

    it('reads the catalogue the registry gives the person on that floor, signed for the registry, once while it is fresh', async () => {
      const signer = callerSigner();
      const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const caller = await callerCheckFor(signer, 'registry')((init?.headers as Record<string, string>)['x-augur-caller']);
        expect(caller.id).toBe('u-1');
        expect(caller.workspace?.id).toBe('w-finance');
        expect(String(input)).toBe('http://registry/v1/manifest?workspace=w-finance');
        return Response.json([{ id: 'folio', maxUpload: 200 }, { id: 'home' }]);
      });
      const lookup = registryAppAccess({ registryUrl: 'http://registry', signer, fetchImpl: fetchImpl as typeof fetch });
      const alex = { id: 'u-1', name: 'Alex', departments: [], roles: [], workspace: finance };
      expect(await lookup(alex)).toEqual(new Map([['folio', { maxUpload: 200 }], ['home', {}]]));
      await lookup(alex);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
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

    it('signs the person for identity when it asks for their floors', async () => {
      const signer = callerSigner();
      let token = '';
      const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
        token = (init?.headers as Record<string, string>)['x-augur-caller'];
        return Response.json({ workspaces: [] });
      };
      await identityFloors({ identityUrl: 'http://identity', signer, fetchImpl: fetchImpl as typeof fetch })({ id: 'u-1', name: 'Alex', departments: [], roles: [] });
      expect((await callerCheckFor(signer, 'identity')(token)).id).toBe('u-1');
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

  it('sends an app’s calls wherever the registry says its service is, never over the platform’s own', async () => {
    let asked = 0;
    let found: Record<string, string> = { notes: url, registry: 'http://elsewhere.test' };
    const apps = async () => {
      asked++;
      return { apps: found, previews: {} };
    };
    const app = await buildApp({ upstreams: { registry: url }, auth, apps, access: async () => new Map([['notes', { maxUpload: 1 }]]) });
    const headers = { authorization: `Bearer ${await sign(ada)}` };
    const res = await app.inject({ method: 'GET', url: '/api/notes/echo?x=1', headers });
    expect(res.statusCode).toBe(200);
    // Signed for the app it goes to, the token kept back, as for any other upstream.
    expect(res.json()['x-user-id']).toBe('u-1');
    expect(res.json()['x-augur-caller']).toBeTruthy();
    expect(res.json().authorization).toBeUndefined();
    // Bodies stream through and are held to what the app may be sent.
    const big = await app.inject({ method: 'POST', url: '/api/notes/upload', headers: { ...headers, 'content-type': 'application/octet-stream' }, payload: Buffer.alloc(2 * 1024 * 1024) });
    expect(big.statusCode).toBe(413);
    const small = await app.inject({ method: 'POST', url: '/api/notes/upload', headers: { ...headers, 'content-type': 'application/octet-stream' }, payload: Buffer.alloc(1000) });
    expect(small.json()).toEqual({ bytes: 1000 });
    // A platform service stays where the gateway was started with, whatever the registry says.
    expect((await app.inject({ method: 'GET', url: '/api/registry/echo', headers })).statusCode).toBe(200);
    // Nobody signed in gets nothing, and an app the registry doesn't know of is a 404.
    expect((await app.inject({ method: 'GET', url: '/api/notes/echo' })).statusCode).toBe(401);
    found = {};
    expect((await app.inject({ method: 'GET', url: '/api/papers/echo', headers })).statusCode).toBe(404);
    expect(asked).toBeGreaterThan(0);
  });

  it('sends a developer who chose a pull request’s preview to it, and everyone else to the app', async () => {
    const apps = async () => ({ apps: { notes: 'http://127.0.0.1:9' }, previews: { notes: { 'u-1': url } } });
    const app = await buildApp({ upstreams: {}, auth, apps, access: async () => new Map([['notes', {}]]) });
    const res = await app.inject({ method: 'GET', url: '/api/notes/echo', headers: { authorization: `Bearer ${await sign(ada)}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()['x-user-id']).toBe('u-1');
    const other = await app.inject({ method: 'GET', url: '/api/notes/echo', headers: { authorization: `Bearer ${await sign({ ...ada, sub: 'u-2' })}` } });
    expect(other.statusCode).toBeGreaterThanOrEqual(500);
  });

  it('says so when it can’t find out where apps are', async () => {
    const app = await buildApp({ upstreams: {}, auth, apps: async () => Promise.reject(new UpstreamsUnavailable('down')) });
    const res = await app.inject({ method: 'GET', url: '/api/notes/echo', headers: { authorization: `Bearer ${await sign(ada)}` } });
    expect(res.statusCode).toBe(503);
  });

  it('asks the registry where apps are as the gateway itself, and keeps the last answer through an outage', async () => {
    const signer = callerSigner();
    const check = callerCheckFor(signer, 'registry');
    let now = 0;
    let up = true;
    const fetchImpl = (async (_input: string, init?: RequestInit) => {
      if (!up) throw new Error('refused');
      const caller = await check(new Headers(init?.headers).get('x-augur-caller') ?? '');
      return new Response(JSON.stringify({ apps: { notes: `http://notes:8090#${caller.id}` } }));
    }) as typeof fetch;
    const upstreamsOf = registryUpstreams({ registryUrl: 'http://registry:8082', signer, ttlMs: 1000, fetchImpl, now: () => now });
    expect(await upstreamsOf()).toEqual({ apps: { notes: 'http://notes:8090#augur:gateway' }, previews: {} });
    up = false;
    now = 5000;
    expect(await upstreamsOf()).toEqual({ apps: { notes: 'http://notes:8090#augur:gateway' }, previews: {} });
    await expect(registryUpstreams({ registryUrl: 'http://registry:8082', signer, fetchImpl })()).rejects.toBeInstanceOf(UpstreamsUnavailable);
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
    expect(() => defaultUpstreams({ APP_UPSTREAMS: 'models=http://elsewhere:9000' })).toThrow(/can't name models/);
    expect(defaultUpstreams({ MODELS_URL: 'http://models:8085' }).models).toBe('http://models:8085');
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

  it('says whether sample data may be seeded here, and is off unless the deployment allows it', async () => {
    const ask = async (seedAllowed?: boolean) => {
      const app = await buildApp({ upstreams: {}, auth, monitor: new HealthMonitor({ probes: [] }), ...(seedAllowed === undefined ? {} : { seedAllowed }) });
      return (await app.inject({ method: 'GET', url: '/api/gateway/v1/status', headers: { authorization: `Bearer ${await sign(ada)}` } })).json().seeding;
    };
    expect(await ask(true)).toEqual({ allowed: true });
    expect(await ask(false)).toMatchObject({ allowed: false, whoCanChange: expect.stringContaining('SEED_ALLOWED') });
    expect((await ask()).allowed).toBe(false);
  });

  it('says whether email can be sent, and why not', async () => {
    const ask = async (mailer: Mailer) => {
      const app = await buildApp({ upstreams: {}, auth, monitor: new HealthMonitor({ probes: [] }), mailer });
      return (await app.inject({ method: 'GET', url: '/api/gateway/v1/status', headers: { authorization: `Bearer ${await sign(ada)}` } })).json().email;
    };
    expect(await ask(new Mailer())).toEqual({ state: 'off', problem: NO_RELAY });
    const relay = { host: 'relay.example.org', port: 587, security: 'starttls' as const, from: 'augur@example.org' };
    const verify = vi.fn().mockRejectedValue(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));
    expect(await ask(new Mailer({ relay, transport: { verify, sendMail: vi.fn() } }))).toMatchObject({ state: 'attention', relay: 'relay.example.org:587', problem: expect.stringContaining('SMTP_HOST') });
  });

  it('keeps the platform’s status from people who aren’t admins, and from nobody signed in', async () => {
    const app = await buildApp({ upstreams: {}, auth, monitor: new HealthMonitor({ probes: [] }) });
    const sam = await sign({ ...ada, sub: 'u-2', roles: [] });
    expect((await app.inject({ method: 'GET', url: '/api/gateway/v1/status', headers: { authorization: `Bearer ${sam}` } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/gateway/v1/status' })).statusCode).toBe(401);
  });

  it('tells the shell whether to send browser telemetry, and why not', async () => {
    const off = await buildApp({ upstreams: {}, auth, browserTelemetry: { on: false, why: 'No collector is named.' } });
    const token = await sign(ada);
    const res = await off.inject({ method: 'GET', url: '/api/gateway/v1/telemetry', headers: { authorization: `Bearer ${token}` } });
    expect(res.json()).toEqual({ on: false, why: 'No collector is named.' });
    const sent = await off.inject({ method: 'POST', url: '/api/gateway/v1/telemetry/v1/logs', headers: { authorization: `Bearer ${token}` }, payload: { resourceLogs: [] } });
    expect(sent.statusCode).toBe(409);
    expect((await off.inject({ method: 'GET', url: '/api/gateway/v1/telemetry' })).statusCode).toBe(401);
  });

  it('passes a signed-in browser’s errors on to the collector, stamped as the browser’s', async () => {
    const sent: { url: string; body: string }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: String(init.body) });
      return new Response('{}');
    }) as typeof fetch;
    const app = await buildApp({ upstreams: {}, auth, fetchImpl, browserTelemetry: { on: true, endpoint: 'http://collector:4318', headers: {}, resource: { 'deployment.environment.name': 'dev' } } });
    const token = await sign(ada);
    const payload = { resourceLogs: [{ resource: { attributes: [{ key: 'service.name', value: { stringValue: 'identity' } }] }, scopeLogs: [] }] };
    const res = await app.inject({ method: 'POST', url: '/api/gateway/v1/telemetry/v1/logs', headers: { authorization: `Bearer ${token}` }, payload });
    expect(res.statusCode).toBe(200);
    expect(sent[0].url).toBe('http://collector:4318/v1/logs');
    expect(sent[0].body).toContain('augur-browser');
    expect(sent[0].body).not.toContain('identity');
    expect((await app.inject({ method: 'POST', url: '/api/gateway/v1/telemetry/v1/logs', payload })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/gateway/v1/telemetry/v1/traces', headers: { authorization: `Bearer ${token}` }, payload })).statusCode).toBe(400);
  });
});
