// Skeleton acceptance test for PR 1 (spec 8.2, 8.3): the gateway admits an app's own token and enforces its grant.
// Written before the change (red until P1): the gateway accepted only audience platform-api.
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import type { AuthConfig } from './auth.ts';
import type { AppGrants } from './grants.ts';

/** What the registry would say: notes is installed, on and granted two scopes; ghost is unknown. */
const appGrants: AppGrants = async (app) => (app === 'notes' ? { name: 'Notes', on: true, scopes: ['notifications:send', 'events:publish'] } : undefined);

const issuer = 'http://sign-in.test/realms/platform';

describe('an app token at the gateway (spec 8.2, 8.3)', () => {
  let upstream: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let signApp: (app: string, aud?: string) => Promise<string>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    auth = { issuer, audience: 'platform-api', keys: createLocalJWKSet({ keys: [jwk] }) };
    signApp = (app, aud = 'platform-services') =>
      new SignJWT({ azp: `app-${app}`, sub: `service-account-app-${app}` })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(issuer)
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
    upstream = Fastify();
    upstream.post('/v1/notifications', async (req) => ({ caller: req.headers['x-augur-caller'] ? 'signed' : 'none' }));
    url = await upstream.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => upstream.close());

  it('forwards a call within the app’s grant with a signed caller naming the app (8.2, 8.3)', async () => {
    const app = await buildApp({ upstreams: { events: url }, auth, appGrants });
    const res = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('notes')}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ caller: 'signed' });
  });

  it('refuses a call outside the app’s grant with 403 and names the scope (8.3)', async () => {
    const app = await buildApp({ upstreams: { identity: url }, auth, appGrants });
    const res = await app.inject({ method: 'GET', url: '/api/identity/v1/admin/people', headers: { authorization: `Bearer ${await signApp('notes')}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toMatch(/people:read|isn.t allowed/);
  });

  it('refuses a token for an app that isn’t installed, saying so (8.2)', async () => {
    const app = await buildApp({ upstreams: { events: url }, auth, appGrants });
    const res = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('ghost')}` } });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toMatch(/isn.t installed here/);
  });
});
