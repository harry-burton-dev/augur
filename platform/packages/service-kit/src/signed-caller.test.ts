import Fastify from 'fastify';
import { SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { callerFromHeaders, callerHeaders, type Caller } from './caller.js';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { BREAK_GLASS, breakGlassFromEnv, CALLER_KEYS_PATH, CALLER_TOKEN_HEADER, callerCheckFor, callerCheckFromEnv, callerSigner, callerSignerFromEnv, signedCallerHeaders, signedCallers, type CallerCheck } from './signed-caller.js';

const sam: Caller = { id: 'u1', name: 'Sam Okafor', email: 'sam@example.org', departments: ['Research'], roles: ['editor'], signedInAt: '2026-10-23T22:00:00.000Z', workspace: { id: 'w1', kind: 'team', role: 'lead' } };

// Another container on the compose network; a call from the service's own container is believed (see below).
const ON_THE_NETWORK = '172.18.0.9';

// A service that answers with whoever callerFromHeaders reads, and the floor id it was sent.
const service = async (callers: CallerCheck | undefined, options?: Parameters<typeof signedCallers>[1]) => {
  const app = Fastify();
  app.addHook('onRequest', signedCallers(callers, options));
  app.get('/who', async (req) => ({ caller: callerFromHeaders(req.headers) ?? null, floor: req.headers['x-workspace-id'] ?? null }));
  return app;
};

describe('signed caller', () => {
  it('passes a caller from the gateway to the service it is signed for', async () => {
    const gateway = callerSigner();
    const app = await service(callerCheckFor(gateway, 'identity'));
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(gateway, sam, 'identity') });
    expect(res.json()).toEqual({ caller: sam, floor: 'w1' });
  });

  it('signs the admin persona someone is acting as beside the person', async () => {
    const gateway = callerSigner();
    const app = await service(callerCheckFor(gateway, 'identity'));
    const acting = { ...sam, persona: 'admin.u1' };
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(gateway, acting, 'identity') });
    expect(res.json().caller).toEqual(acting);
  });

  it('signs the organisation the call is in', async () => {
    const gateway = callerSigner();
    const app = await service(callerCheckFor(gateway, 'identity'));
    const inOrg = { ...sam, org: 'o1' };
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(gateway, inOrg, 'identity') });
    expect(res.json().caller).toEqual(inOrg);
  });

  it('drops x-user-* headers that come without a signature', async () => {
    const app = await service(callerCheckFor(callerSigner(), 'identity'));
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: callerHeaders({ ...sam, roles: ['admin'] }) });
    expect(res.statusCode).toBe(200);
    // A service's own call names a floor with x-workspace-id and no person; the floor id is kept for the service to check.
    expect(res.json()).toEqual({ caller: null, floor: 'w1' });
  });

  it('believes the signed caller over headers sent beside it', async () => {
    const gateway = callerSigner();
    const app = await service(callerCheckFor(gateway, 'identity'));
    const plain = { ...sam, workspace: undefined };
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: { ...callerHeaders({ ...sam, id: 'admin', roles: ['admin'] }), ...(await signedCallerHeaders(gateway, plain, 'identity')) } });
    const { workspace: _, ...expected } = sam;
    expect(res.json()).toEqual({ caller: expected, floor: null });
  });

  it('refuses a caller signed for another service, by another key, or expired', async () => {
    const seed = '5a'.repeat(32);
    const gateway = callerSigner(seed);
    const app = await service(callerCheckFor(gateway, 'identity'));
    const forFolio = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(gateway, sam, 'folio') });
    expect(forFolio.statusCode).toBe(401);
    const byAnother = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(callerSigner(), sam, 'identity') });
    expect(byAnother.statusCode).toBe(401);
    const garbage = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: { [CALLER_TOKEN_HEADER]: 'not.a.token' } });
    expect(garbage.statusCode).toBe(401);

    const { kid } = (await gateway.keys()).keys[0];
    const privateKey = createPrivateKey({ key: Buffer.from(`302e020100300506032b657004220420${seed}`, 'hex'), format: 'der', type: 'pkcs8' });
    const old = await new SignJWT({ name: 'Sam' })
      .setProtectedHeader({ alg: 'EdDSA', kid })
      .setSubject('u1')
      .setIssuer('augur-gateway')
      .setAudience('identity')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
      .sign(privateKey);
    expect((await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: { [CALLER_TOKEN_HEADER]: old } })).statusCode).toBe(401);
  });

  it('answers 503 when the gateway’s key can’t be fetched', async () => {
    const gateway = callerSigner();
    const app = await service(async () => {
      const { CallerKeysUnavailable } = await import('./signed-caller.js');
      throw new CallerKeysUnavailable('gateway unreachable');
    });
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(gateway, sam, 'identity') });
    expect(res.statusCode).toBe(503);
  });

  it('treats a call from inside its own container like any other, unless break-glass is on', async () => {
    const app = await service(callerCheckFor(callerSigner(), 'identity'), { breakGlass: false });
    const res = await app.inject({ remoteAddress: '127.0.0.1', url: '/who', headers: callerHeaders(sam) });
    expect(res.json().caller).toBeNull();
  });

  it('believes a call from inside its own container only while break-glass is on, and says so in the log', async () => {
    const warned: string[] = [];
    const app = Fastify();
    app.addHook('onRequest', async (req) => {
      req.log.warn = ((_: object, msg: string) => warned.push(msg)) as typeof req.log.warn;
    });
    app.addHook('onRequest', signedCallers(callerCheckFor(callerSigner(), 'identity'), { breakGlass: true }));
    app.get('/who', async (req) => ({ caller: callerFromHeaders(req.headers) ?? null }));
    const inside = await app.inject({ remoteAddress: '127.0.0.1', url: '/who', headers: callerHeaders(sam) });
    expect(inside.json().caller).toEqual(sam);
    expect(warned.join(' ')).toMatch(/break-glass/);
    // The container's own health checks name nobody, so they aren't logged.
    await app.inject({ remoteAddress: '127.0.0.1', url: '/who' });
    expect(warned).toHaveLength(1);
    // Break-glass never reaches past the container: a call from the network is still checked.
    const outside = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: callerHeaders(sam) });
    expect(outside.json().caller).toBeNull();
  });

  it('takes break-glass from CALLER_BREAK_GLASS, off unless it says on', () => {
    expect(breakGlassFromEnv({})).toBe(false);
    expect(breakGlassFromEnv({ [BREAK_GLASS]: 'true' })).toBe(false);
    expect(breakGlassFromEnv({ [BREAK_GLASS]: '1' })).toBe(false);
    expect(breakGlassFromEnv({ CALLER_BREAK_GLASS: 'on' })).toBe(true);
  });

  it('changes nothing without a check, as in local dev', async () => {
    const app = await service(undefined);
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: callerHeaders(sam) });
    expect(res.json().caller).toEqual(sam);
  });

  it('publishes the next key beside the one it signs with, so services know it before it is used', async () => {
    const now = 'ab'.repeat(32);
    const next = 'cd'.repeat(32);
    const rotating = callerSigner(now, { next });
    const { keys } = await rotating.keys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toEqual((await callerSigner(now).keys()).keys[0]);
    expect(keys[1]).toEqual((await callerSigner(next).keys()).keys[0]);
    // It signs with the current key, so a service that knows only that one still believes it...
    const app = await service(callerCheckFor(callerSigner(now), 'identity'));
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(rotating, sam, 'identity') });
    expect(res.json().caller).toEqual(sam);
    // ...and once the next key becomes the current one, a service that fetched both believes that too.
    const after = await service(callerCheckFor(rotating, 'identity'));
    const later = await after.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(callerSigner(next), sam, 'identity') });
    expect(later.json().caller).toEqual(sam);
    expect(() => callerSigner(now, { next: now })).toThrow(/CALLER_SIGNING_KEY_NEXT/);
  });

  it('needs CALLER_SIGNING_KEY in production, and takes CALLER_SIGNING_KEY_NEXT beside it', async () => {
    expect(() => callerSignerFromEnv({ NODE_ENV: 'production' })).toThrow(/CALLER_SIGNING_KEY/);
    expect(() => callerSignerFromEnv({ NODE_ENV: 'production', CALLER_SIGNING_KEY: '' })).toThrow(/CALLER_SIGNING_KEY/);
    expect((await callerSignerFromEnv({ NODE_ENV: 'production', CALLER_SIGNING_KEY: 'ab'.repeat(32), CALLER_SIGNING_KEY_NEXT: 'cd'.repeat(32) }).keys()).keys).toHaveLength(2);
    // Outside production (pnpm dev:app, tests) a new key each start is still fine.
    expect((await callerSignerFromEnv({}).keys()).keys).toHaveLength(1);
  });

  it('makes the same key from the same seed, so several gateways can share one', async () => {
    const seed = 'ab'.repeat(32);
    expect(await callerSigner(seed).keys()).toEqual(await callerSigner(seed).keys());
    expect(() => callerSigner('abcd')).toThrow(/64 hex/);
    expect(() => callerSigner('zz'.repeat(32))).toThrow(/64 hex/);
    // An empty seed is no seed, as an unset setting reads.
    expect((await callerSigner('').keys()).keys).toHaveLength(1);
  });
});

describe('callerCheckFromEnv', () => {
  it('fails closed: callers are checked unless a service is plainly told not to', () => {
    expect(callerCheckFromEnv('identity', {})).toBeDefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'production' })).toBeDefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'development' })).toBeDefined();
    expect(callerCheckFromEnv('identity', { AUGUR_INSECURE_DEV_CALLERS: 'true' })).toBeDefined();
    // A container that somehow got NODE_ENV=test is still not a test runner.
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'test' })).toBeDefined();
  });

  it('believes x-user-* headers only under pnpm dev:app or Vitest', () => {
    expect(callerCheckFromEnv('identity', { AUGUR_INSECURE_DEV_CALLERS: '1' })).toBeUndefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'test', VITEST: 'true' })).toBeUndefined();
    expect(callerCheckFromEnv('identity')).toBeUndefined();
  });

  it('always checks in production, and wherever CALLER_KEYS_URL is set', () => {
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'production', AUGUR_INSECURE_DEV_CALLERS: '1' })).toBeDefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'production', VITEST: 'true' })).toBeDefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'test', VITEST: 'true', CALLER_KEYS_URL: 'http://gateway:8080/keys' })).toBeDefined();
  });

  it('checks against the key the gateway at GATEWAY_URL publishes', async () => {
    const signer = callerSigner();
    const asked: string[] = [];
    const gateway = createServer(async (req, res) => {
      asked.push(req.url ?? '');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(await signer.keys()));
    });
    await new Promise<void>((done) => gateway.listen(0, '127.0.0.1', done));
    try {
      const { port } = gateway.address() as AddressInfo;
      const app = await service(callerCheckFromEnv('identity', { GATEWAY_URL: `http://127.0.0.1:${port}/` }));
      const signed = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: await signedCallerHeaders(signer, sam, 'identity') });
      expect(signed.json().caller).toEqual(sam);
      expect(asked).toEqual([CALLER_KEYS_PATH]);
      const claimed = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: callerHeaders({ ...sam, roles: ['admin'] }) });
      expect(claimed.json().caller).toBeNull();
    } finally {
      gateway.close();
    }
  });
});
