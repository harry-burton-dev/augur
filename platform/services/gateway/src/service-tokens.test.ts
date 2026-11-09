// Acceptance test for P5 (spec 8.6): a platform service's token reaches an app's part through the gateway, as a
// caller named after the service, and nothing else. Written before the change: the gateway refused every service token.
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callerCheckFor, callerSigner, isServiceCaller, serviceOfCaller } from '@augur/service-kit';
import { buildApp } from './app.ts';
import type { AuthConfig } from './auth.ts';
import type { AppGrants } from './grants.ts';
import { HealthMonitor } from './status.ts';

const signer = callerSigner('ef'.repeat(32));
/** What the registry would say: notes is on, dormant is turned off, ghost is unknown. */
const appGrants: AppGrants = async (app) => (app === 'notes' ? { name: 'Notes', on: true, scopes: ['events:subscribe'] } : app === 'dormant' ? { name: 'Dormant', on: false, scopes: [] } : undefined);
const issuer = 'http://sign-in.test/realms/platform';

describe('a platform service’s token at the gateway (spec 8.6)', () => {
  let upstream: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let signService: (service: string) => Promise<string>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    auth = { issuer, audience: 'platform-api', keys: createLocalJWKSet({ keys: [jwk] }) };
    signService = (service) =>
      new SignJWT({ azp: `platform-${service}`, sub: `service-account-platform-${service}` })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(issuer)
        .setAudience('platform-services')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
    upstream = Fastify();
    upstream.post('/augur/events', async (req) => ({ callerToken: req.headers['x-augur-caller'], key: req.headers['idempotency-key'], authorization: req.headers.authorization ?? null }));
    upstream.post('/v1/notifications', async () => ({ reached: true }));
    url = await upstream.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => upstream.close());

  it('reaches an app’s part as a caller named after the service, which the part can check (8.6)', async () => {
    const app = await buildApp({ upstreams: { notes: url, dormant: url }, auth, signer, appGrants, monitor: new HealthMonitor({ probes: [] }) });
    const res = await app.inject({ method: 'POST', url: '/api/notes/augur/events', headers: { authorization: `Bearer ${await signService('events')}`, 'idempotency-key': 'events-12' }, payload: { seq: '12' } });
    expect(res.statusCode).toBe(200);
    const caller = await callerCheckFor(signer, 'app-notes')(res.json().callerToken);
    expect(caller).toMatchObject({ id: 'augur:events', name: 'events' });
    expect(isServiceCaller(caller)).toBe(true);
    expect(serviceOfCaller(caller)).toBe('events');
    expect(res.json().key).toBe('events-12');
    // The service's own token stays at the gateway: the part learns who called from the signed caller alone.
    expect(res.json().authorization).toBeNull();
    // An app that is turned off, or not installed, isn't reached.
    const off = await app.inject({ method: 'POST', url: '/api/dormant/augur/events', headers: { authorization: `Bearer ${await signService('events')}` }, payload: {} });
    expect(off.statusCode).toBe(403);
    expect(off.json().message).toBe('Dormant is turned off.');
  });

  it('refuses a service token on the gateway’s own routes', async () => {
    const app = await buildApp({ upstreams: { notes: url }, auth, signer, appGrants, monitor: new HealthMonitor({ probes: [] }) });
    for (const [method, path] of [['GET', '/api/gateway/v1/telemetry'], ['POST', '/api/gateway/v1/telemetry/v1/logs'], ['GET', '/api/gateway/v1/status']] as const) {
      const res = await app.inject({ method, url: path, headers: { authorization: `Bearer ${await signService('events')}`, 'content-type': 'application/json' }, payload: method === 'POST' ? {} : undefined });
      expect(res.statusCode, path).toBe(403);
      expect(res.json().message).toBe('AUGUR’s own services reach each other inside the deployment, not through the gateway.');
    }
  });

  it('refuses a service token on AUGUR’s own routes: services reach each other inside the deployment (8.6)', async () => {
    const app = await buildApp({ upstreams: { events: url }, auth, signer, appGrants, monitor: new HealthMonitor({ probes: [] }) });
    const res = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signService('identity')}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe('AUGUR’s own services reach each other inside the deployment, not through the gateway.');
  });
});
