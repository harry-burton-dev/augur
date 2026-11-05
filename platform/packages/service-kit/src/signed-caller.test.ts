import Fastify from 'fastify';
import { SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { callerFromHeaders, callerHeaders, type Caller } from './caller.js';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CALLER_KEYS_PATH, CALLER_TOKEN_HEADER, callerCheckFor, callerCheckFromEnv, callerSigner, signedCallerHeaders, signedCallers, type CallerCheck } from './signed-caller.js';

const sam: Caller = { id: 'u1', name: 'Sam Okafor', email: 'sam@example.org', departments: ['Research'], roles: ['editor'], signedInAt: '2026-10-23T22:00:00.000Z', workspace: { id: 'w1', kind: 'team', role: 'lead' } };

// Another container on the compose network; a call from the service's own container is believed (see below).
const ON_THE_NETWORK = '172.18.0.9';

// A service that answers with whoever callerFromHeaders reads, and the floor id it was sent.
const service = async (callers: CallerCheck | undefined) => {
  const app = Fastify();
  app.addHook('onRequest', signedCallers(callers));
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

  it('believes a call from inside its own container, as a server admin makes one', async () => {
    const app = await service(callerCheckFor(callerSigner(), 'identity'));
    const res = await app.inject({ remoteAddress: '127.0.0.1', url: '/who', headers: callerHeaders(sam) });
    expect(res.json().caller).toEqual(sam);
  });

  it('changes nothing without a check, as in local dev', async () => {
    const app = await service(undefined);
    const res = await app.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: callerHeaders(sam) });
    expect(res.json().caller).toEqual(sam);
  });

  it('makes the same key from the same seed, so several gateways can share one', async () => {
    const seed = 'ab'.repeat(32);
    expect(await callerSigner(seed).keys()).toEqual(await callerSigner(seed).keys());
    expect(() => callerSigner('abcd')).toThrow(/64 hex/);
  });
});

describe('callerCheckFromEnv', () => {
  it('fails closed: callers are checked unless a service is plainly told not to', () => {
    expect(callerCheckFromEnv('identity', {})).toBeDefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'production' })).toBeDefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'development' })).toBeDefined();
    expect(callerCheckFromEnv('identity', { AUGUR_INSECURE_DEV_CALLERS: 'true' })).toBeDefined();
  });

  it('believes x-user-* headers only under pnpm dev:app or a test runner', () => {
    expect(callerCheckFromEnv('identity', { AUGUR_INSECURE_DEV_CALLERS: '1' })).toBeUndefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'test' })).toBeUndefined();
  });

  it('always checks in production, and wherever CALLER_KEYS_URL is set', () => {
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'production', AUGUR_INSECURE_DEV_CALLERS: '1' })).toBeDefined();
    expect(callerCheckFromEnv('identity', { NODE_ENV: 'test', CALLER_KEYS_URL: 'http://gateway:8080/keys' })).toBeDefined();
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
