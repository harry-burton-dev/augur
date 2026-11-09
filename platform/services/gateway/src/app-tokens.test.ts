// Skeleton acceptance test for PR 1 (spec 8.2, 8.3): the gateway admits an app's own token and enforces its grant.
// Written before the change (red until P1): the gateway accepted only audience platform-api.
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callerCheckFor, callerSigner } from '@augur/service-kit';
import { buildApp } from './app.ts';
import type { AuthConfig } from './auth.ts';
import type { AppGrants } from './grants.ts';

/** What the registry would say: notes is installed, on and granted two scopes; ghost is unknown. */
const signer = callerSigner('cd'.repeat(32));
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
    upstream.post('/v1/notifications', async (req) => ({ caller: req.headers['x-augur-caller'] ? 'signed' : 'none', callerToken: req.headers['x-augur-caller'], authorization: req.headers.authorization }));
    url = await upstream.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => upstream.close());

  it('forwards a call within the app’s grant with a signed caller naming the app (8.2, 8.3)', async () => {
    const app = await buildApp({ upstreams: { events: url }, auth, appGrants });
    const res = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('notes')}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ caller: 'signed' });
  });

  it('refuses a call outside the app’s grant with 403 and names the scope (8.3)', async () => {
    const app = await buildApp({ upstreams: { identity: url }, auth, appGrants });
    const res = await app.inject({ method: 'GET', url: '/api/identity/v1/directory', headers: { authorization: `Bearer ${await signApp('notes')}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe('Notes isn’t allowed to look people up (people:read).');
    // A route no app calls is refused too, in words.
    const other = await app.inject({ method: 'GET', url: '/api/identity/v1/admin/people', headers: { authorization: `Bearer ${await signApp('notes')}` } });
    expect(other.statusCode).toBe(403);
    expect(other.json().message).toBe('Notes isn’t allowed to manage people and teams (people:manage).');
  });

  it('carries the floor the call is for to the service, as the registry checked it (8.3)', async () => {
    const floors: AppGrants = async (app, workspace) => (app === 'notes' ? { name: 'Notes', on: true, scopes: ['notifications:send'], ...(workspace === 'w1' ? { floorKind: 'team' as const } : {}) } : undefined);
    const app = await buildApp({ upstreams: { events: url }, auth, appGrants: floors, signer });
    const res = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('notes')}`, 'x-workspace-id': 'w1' } });
    expect(res.statusCode).toBe(200);
    const caller = await callerCheckFor(signer, 'events')(res.json().callerToken);
    expect(caller).toMatchObject({ id: 'app:notes', app: 'notes', scopes: ['notifications:send'], workspace: { id: 'w1', kind: 'team', role: 'member' } });
    // The app's own token goes on with the call (the services' second line); a malformed floor id is refused before the registry is asked.
    expect(res.json().authorization).toMatch(/^Bearer /);
    expect((await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('notes')}`, 'x-workspace-id': 'not a floor!' } })).statusCode).toBe(400);
  });

  it('refuses a token for an app that isn’t installed, saying so (8.2)', async () => {
    const app = await buildApp({ upstreams: { events: url }, auth, appGrants });
    const res = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('ghost')}` } });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toMatch(/isn.t installed here/);
  });
});
