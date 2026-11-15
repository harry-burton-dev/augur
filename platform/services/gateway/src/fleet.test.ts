// The fleet's machine client (ADR 0100): its token reaches only the registry's routes for what the server runs,
// as the caller client:platform-fleet signed for the registry, and nothing else through the gateway.
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callerCheckFor, callerSigner, isFleetCaller, isServiceCaller } from '@augur/service-kit';
import { buildApp } from './app.ts';
import type { AuthConfig } from './auth.ts';
import type { AppGrants } from './grants.ts';
import { fleetMayCall, FLEET_REFUSED } from './fleet.ts';
import { HealthMonitor } from './status.ts';

const signer = callerSigner('fe'.repeat(32));
const appGrants: AppGrants = async (app) => (app === 'notes' ? { name: 'Notes', on: true, scopes: [] } : undefined);
const issuer = 'http://sign-in.test/realms/platform';

describe('the fleet’s client at the gateway (ADR 0100)', () => {
  let upstream: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let token: (client: string) => Promise<string>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    auth = { issuer, audience: 'platform-api', keys: createLocalJWKSet({ keys: [jwk] }) };
    token = (client) =>
      new SignJWT({ azp: client, sub: `service-account-${client}` }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(issuer).setAudience('platform-services').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    upstream = Fastify();
    upstream.all('/*', async (req) => ({ path: req.url, callerToken: req.headers['x-augur-caller'] ?? null, authorization: req.headers.authorization ?? null }));
    url = await upstream.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => upstream.close());

  const gateway = () => buildApp({ upstreams: { registry: url, events: url, notes: url }, auth, signer, appGrants, monitor: new HealthMonitor({ probes: [] }) });

  it('reaches the registry’s upgrade, desired-state and app-job routes as client:platform-fleet, signed for the registry', async () => {
    const app = await gateway();
    for (const [method, path] of [
      ['GET', '/api/registry/v1/platform/overview'],
      ['GET', '/api/registry/v1/app-runner/apps'],
      ['GET', '/api/registry/v1/app-runner/jobs'],
      ['PUT', '/api/registry/v1/platform/upgrade'],
      ['PUT', '/api/registry/v1/platform/units/folio/desired-state'],
      ['POST', '/api/registry/v1/app-runner/jobs'],
    ] as const) {
      const res = await app.inject({ method, url: path, headers: { authorization: `Bearer ${await token('platform-fleet')}` }, payload: method === 'GET' ? undefined : {} });
      expect(res.statusCode, path).toBe(200);
      expect(res.json().path).toBe(path.slice('/api/registry'.length));
      const caller = await callerCheckFor(signer, 'registry')(res.json().callerToken);
      expect(isFleetCaller(caller)).toBe(true);
      // It comes from outside the deployment: not one of AUGUR's own services.
      expect(isServiceCaller(caller)).toBe(false);
      expect(caller.name).toBe('platform-fleet');
      // Its own token stays at the gateway.
      expect(res.json().authorization).toBeNull();
    }
  });

  it('is refused everywhere else: other registry routes, other services, app parts, the gateway’s own', async () => {
    const app = await gateway();
    for (const [method, path] of [
      ['PUT', '/api/registry/v1/platform/go-back'],
      // The updates page names the admins who upgraded before: the fleet follows its upgrade on the overview.
      ['GET', '/api/registry/v1/platform/updates'],
      ['PUT', '/api/registry/v1/platform/upgrade/halted'],
      ['GET', '/api/registry/v1/apps'],
      ['DELETE', '/api/registry/v1/app-runner/jobs/1'],
      ['DELETE', '/api/registry/v1/platform/upgrade'],
      ['PUT', '/api/registry/v1/platform/units/a/desired-state'],
      ['GET', '/api/registry/v1/platform/upgrade'],
      ['PUT', '/api/registry/v1/platform/%75pgrade'],
      ['PUT', '/api/registry/v1/platform/units/../go-back'],
      ['POST', '/api/events/v1/notifications'],
      ['POST', '/api/notes/augur/events'],
      ['GET', '/api/gateway/v1/status'],
    ] as const) {
      const res = await app.inject({ method, url: path, headers: { authorization: `Bearer ${await token('platform-fleet')}` }, payload: method === 'GET' ? undefined : {} });
      expect(res.statusCode, `${method} ${path}`).toBe(403);
      expect(res.json().message).toBe(FLEET_REFUSED);
    }
  });

  it('gives no other service’s token the fleet’s routes', async () => {
    const app = await gateway();
    const res = await app.inject({ method: 'PUT', url: '/api/registry/v1/platform/upgrade', headers: { authorization: `Bearer ${await token('platform-events')}` }, payload: {} });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe('AUGUR’s own services reach each other inside the deployment, not through the gateway.');
  });

  it('matches only exact paths', () => {
    expect(fleetMayCall('PUT', '/api/registry/v1/platform/upgrade?x=1')).toBe(true);
    expect(fleetMayCall('PUT', '/api/registry/v1/platform/upgrade/')).toBe(false);
    expect(fleetMayCall('PUT', '/api/registry//v1/platform/upgrade')).toBe(false);
    expect(fleetMayCall('PUT', '/api/registry/v1/platform/units/Folio/desired-state')).toBe(false);
    expect(fleetMayCall('put', '/api/registry/v1/platform/upgrade')).toBe(false);
    expect(fleetMayCall('PUT', '/api/registry/v1/platform/units/../upgrade')).toBe(false);
  });
});
