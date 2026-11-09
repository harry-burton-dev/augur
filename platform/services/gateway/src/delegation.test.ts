// Acting for a person (spec 8.5): the host names the app, the gateway signs a delegated caller for the part, and the
// part's onward call for that person gets a fresh caller for the target.
import Fastify, { type FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_HEADER, appClientId, callerCheckFor, callerSigner, DELEGATION_HEADER, signDelegation, type Caller } from '@augur/service-kit';
import { buildApp } from './app.ts';
import type { AuthConfig } from './auth.ts';
import { AppGrantsUnavailable, type AppGrants } from './grants.ts';
import { HealthMonitor } from './status.ts';
import type { FloorLookup } from './floors.ts';

const issuer = 'http://sign-in.test/realms/platform';
const w1 = { id: 'w1', kind: 'team' as const, role: 'member' as const };

describe('a call made for an app', () => {
  let upstream: FastifyInstance;
  let url: string;
  let auth: AuthConfig;
  let signPerson: () => Promise<string>;
  let signApp: (app: string) => Promise<string>;
  const signer = callerSigner('ab'.repeat(32));
  const appGrants: AppGrants = async (app, workspace) => (app === 'notes' ? { name: 'Notes', on: workspace !== 'off-floor', scopes: ['notifications:send'] } : undefined);
  const appGrants3: AppGrants = async (app, workspace) => (app === 'notes' ? { name: 'Notes', on: workspace !== 'off-floor', scopes: ['notifications:send'], contract: 3 } : undefined);
  const floors: FloorLookup = async () => [w1, { id: 'off-floor', kind: 'team', role: 'member' }];
  const access = async () => new Map([['notes', { name: 'Notes', maxUpload: 10 }]]);
  const alex = { sub: 'u-1', name: 'Alex Rivera', roles: ['editor'], departments: ['Finance'] };

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    auth = { issuer, audience: 'platform-api', keys: createLocalJWKSet({ keys: [jwk] }) };
    const token = (claims: Record<string, unknown>, aud: string) => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(issuer).setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey);
    signPerson = () => token(alex, 'platform-api');
    signApp = (app) => token({ azp: appClientId(app), sub: `service-account-${appClientId(app)}` }, 'platform-services');
    upstream = Fastify();
    upstream.all('*', async (req) => ({ headers: req.headers, url: req.url }));
    url = await upstream.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => upstream.close());

  const gateway = (grants: AppGrants = appGrants) => buildApp({ upstreams: { events: url, notes: url }, auth, signer, appGrants: grants, floors, access, monitor: new HealthMonitor({ probes: [] }), delegationSeconds: 120 });
  const callerIn = async (res: { json: () => { headers: Record<string, string> } }, audience: string): Promise<Caller & { exp?: number }> => {
    const token = res.json().headers['x-augur-caller'];
    const caller = await callerCheckFor(signer, audience)(token);
    const exp = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).exp as number;
    return { ...caller, exp };
  };

  it('hands the app’s part a delegated caller naming the app and its scopes, lasting APP_DELEGATION_SECONDS (8.5)', async () => {
    const app = await gateway();
    const res = await app.inject({ method: 'GET', url: '/api/notes/v1/items', headers: { authorization: `Bearer ${await signPerson()}`, [APP_HEADER]: 'notes', 'x-workspace-id': 'w1' } });
    expect(res.statusCode).toBe(200);
    const caller = await callerIn(res, appClientId('notes'));
    expect(caller).toMatchObject({ id: 'u-1', name: 'Alex Rivera', app: 'notes', scopes: ['notifications:send'], workspace: w1 });
    expect(caller.exp! - Math.floor(Date.now() / 1000)).toBeGreaterThan(100);
    // The person's token and the host's header stop at the gateway.
    expect(res.json().headers.authorization).toBeUndefined();
    expect(res.json().headers[APP_HEADER]).toBeUndefined();
  });

  it('lets a person’s call for an app reach an AUGUR API only within the app’s grant, naming the app to the service (8.5)', async () => {
    const app = await gateway();
    const headers = async () => ({ authorization: `Bearer ${await signPerson()}`, [APP_HEADER]: 'notes' });
    const ok = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: await headers(), payload: {} });
    expect(ok.statusCode).toBe(200);
    expect(await callerIn(ok, 'events')).toMatchObject({ id: 'u-1', app: 'notes', scopes: ['notifications:send'] });
    const outside = await app.inject({ method: 'POST', url: '/api/events/v1/audit', headers: await headers(), payload: {} });
    expect(outside.statusCode).toBe(403);
    expect(outside.json().message).toBe('Notes isn’t allowed to write to the audit log (audit:write).');
    const notForApps = await app.inject({ method: 'GET', url: '/api/events/v1/notifications', headers: await headers() });
    expect(notForApps.statusCode).toBe(403);
    expect(notForApps.json().message).toMatch(/isn’t allowed to call/);
  });

  it('lets AUGUR’s own frontend reach an admin API with the platform scope its release gives it, and no app without one (ADR 0083)', async () => {
    const grants: AppGrants = async (app) =>
      app === 'upgrades' ? { name: 'Upgrade Centre', on: true, scopes: [], platformScopes: ['deployment:upgrade'] } : app === 'notes' ? { name: 'Notes', on: true, scopes: ['notifications:send'] } : undefined;
    const app = await buildApp({ upstreams: { events: url, registry: url, notes: url }, auth, signer, appGrants: grants, floors, access: async () => new Map([['notes', { name: 'Notes', maxUpload: 10 }], ['upgrades', { name: 'Upgrade Centre', maxUpload: 1 }]]), monitor: new HealthMonitor({ probes: [] }) });
    const asFor = async (id: string) => ({ authorization: `Bearer ${await signPerson()}`, [APP_HEADER]: id });
    const goBack = await app.inject({ method: 'PUT', url: '/api/registry/v1/platform/go-back', headers: await asFor('upgrades'), payload: { version: '0.24.1' } });
    expect(goBack.statusCode).toBe(200);
    expect(await callerIn(goBack, 'registry')).toMatchObject({ id: 'u-1', app: 'upgrades', scopes: ['deployment:upgrade'], roles: ['editor'] });
    const notItsOwn = await app.inject({ method: 'GET', url: '/api/events/v1/audit', headers: await asFor('upgrades') });
    expect(notItsOwn.statusCode).toBe(403);
    expect(notItsOwn.json().message).toBe('Upgrade Centre isn’t allowed to read the audit log (audit:read).');
    const fromAFeed = await app.inject({ method: 'PUT', url: '/api/registry/v1/platform/go-back', headers: await asFor('notes'), payload: { version: '0.24.1' } });
    expect(fromAFeed.statusCode).toBe(403);
    expect(fromAFeed.json().message).toBe('Notes isn’t allowed to upgrade AUGUR or take it back (deployment:upgrade).');
  });

  it('never lets an app’s own token use a platform scope, even one a registry wrongly listed', async () => {
    const grants: AppGrants = async (app) => (app === 'notes' ? { name: 'Notes', on: true, scopes: [], platformScopes: ['audit:read'] } : undefined);
    const app = await buildApp({ upstreams: { events: url, notes: url }, auth, signer, appGrants: grants, floors, access, monitor: new HealthMonitor({ probes: [] }) });
    const res = await app.inject({ method: 'GET', url: '/api/events/v1/audit', headers: { authorization: `Bearer ${await signApp('notes')}` } });
    expect(res.statusCode).toBe(403);
  });

  it('answers 400 when the path and the header name different apps, and refuses an app that is off here', async () => {
    const app = await gateway();
    const crossed = await app.inject({ method: 'GET', url: '/api/notes/v1/items', headers: { authorization: `Bearer ${await signPerson()}`, [APP_HEADER]: 'other' } });
    expect(crossed.statusCode).toBe(400);
    const off = await app.inject({ method: 'GET', url: '/api/notes/v1/items', headers: { authorization: `Bearer ${await signPerson()}`, [APP_HEADER]: 'notes', 'x-workspace-id': 'off-floor' } });
    expect(off.statusCode).toBe(403);
    expect(off.json().message).toBe('Notes is turned off on this floor.');
    const malformed = await app.inject({ method: 'GET', url: '/api/notes/v1/items', headers: { authorization: `Bearer ${await signPerson()}`, [APP_HEADER]: 'Not an id' } });
    expect(malformed.statusCode).toBe(400);
  });

  it('drops every x-augur-*, x-user-* and x-workspace-* header a call brings, and without x-augur-app reaches the part as before', async () => {
    const app = await gateway();
    const res = await app.inject({ method: 'GET', url: '/api/notes/v1/items', headers: { authorization: `Bearer ${await signPerson()}`, 'x-augur-acting-app': 'forged', 'x-augur-acting-scopes': 'audit:write', 'x-augur-anything': 'x', 'x-user-roles': 'admin', 'x-workspace-kind': 'org' } });
    expect(res.statusCode).toBe(200);
    const caller = await callerIn(res, 'notes');
    expect(caller.app).toBeUndefined();
    const sent = res.json().headers;
    expect(Object.keys(sent).filter((k) => /^x-(augur|user|workspace)-/.test(k)).sort()).toEqual(['x-augur-caller', 'x-user-departments', 'x-user-id', 'x-user-name', 'x-user-roles']);
    expect(sent['x-user-roles']).toBe('editor');
  });

  it('signs a plain call to an app on the app contract for its client, app-<id>, which its part checks for', async () => {
    const app = await gateway(appGrants3);
    const res = await app.inject({ method: 'GET', url: '/api/notes/v1/items', headers: { authorization: `Bearer ${await signPerson()}`, 'x-workspace-id': 'w1' } });
    expect(res.statusCode).toBe(200);
    const caller = await callerIn(res, appClientId('notes'));
    expect(caller).toMatchObject({ id: 'u-1', name: 'Alex Rivera', workspace: w1 });
    // Not a delegation: no host acts for the app, so the caller names no app and carries no scopes.
    expect(caller.app).toBeUndefined();
    expect(caller.scopes).toBeUndefined();
    await expect(callerIn(res, 'notes')).rejects.toThrow();
  });

  it('refuses a plain call to an app while the registry can’t say which contract it is on, rather than signing it wrong', async () => {
    const app = await gateway(async () => { throw new AppGrantsUnavailable('down'); });
    const res = await app.inject({ method: 'GET', url: '/api/notes/v1/items', headers: { authorization: `Bearer ${await signPerson()}`, 'x-workspace-id': 'w1' } });
    expect(res.statusCode).toBe(503);
    expect(res.json().message).toBe('Whether this app can be reached can’t be checked right now: AUGUR’s registry isn’t answering. Try again in a moment.');
  });

  it('signs a plain call for the bare id for an app on contract 2, one the registry doesn’t know, or with no registry to ask', async () => {
    const plain = { authorization: `Bearer ${await signPerson()}`, 'x-workspace-id': 'w1' };
    const two = await (await gateway()).inject({ method: 'GET', url: '/api/notes/v1/items', headers: plain });
    expect(two.statusCode).toBe(200);
    expect((await callerIn(two, 'notes')).id).toBe('u-1');
    await expect(callerIn(two, appClientId('notes'))).rejects.toThrow();
    const unknown = await (await gateway(async () => undefined)).inject({ method: 'GET', url: '/api/notes/v1/items', headers: plain });
    expect(unknown.statusCode).toBe(200);
    expect((await callerIn(unknown, 'notes')).id).toBe('u-1');
    const noRegistry = await buildApp({ upstreams: { notes: url }, auth, signer, floors, access, monitor: new HealthMonitor({ probes: [] }) });
    const alone = await noRegistry.inject({ method: 'GET', url: '/api/notes/v1/items', headers: plain });
    expect(alone.statusCode).toBe(200);
    expect((await callerIn(alone, 'notes')).id).toBe('u-1');
  });

  it('refuses a plain call to an app turned off on the floor, naming the app, rather than signing it on', async () => {
    const app = await gateway(appGrants3);
    const res = await app.inject({ method: 'GET', url: '/api/notes/v1/items', headers: { authorization: `Bearer ${await signPerson()}`, 'x-workspace-id': 'off-floor' } });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe('Notes is turned off on this floor.');
  });

  it('turns a part’s onward call with a valid delegation into a fresh one-minute caller for the target (8.5)', async () => {
    const app = await gateway();
    const person: Caller = { id: 'u-1', name: 'Alex Rivera', roles: ['editor'], departments: ['Finance'], workspace: w1 };
    const delegation = await signDelegation(signer, person, { app: 'notes', scopes: ['notifications:send'], lifetimeSeconds: 120 });
    const res = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('notes')}`, [DELEGATION_HEADER]: delegation }, payload: {} });
    expect(res.statusCode).toBe(200);
    const caller = await callerIn(res, 'events');
    expect(caller).toMatchObject({ id: 'u-1', name: 'Alex Rivera', app: 'notes', scopes: ['notifications:send'], workspace: w1 });
    expect(caller.exp! - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(60);
    // The delegation itself goes no further; the app's own token does, for the service's second line.
    expect(res.json().headers[DELEGATION_HEADER]).toBeUndefined();
    expect(res.json().headers.authorization).toMatch(/^Bearer /);
  });

  it('refuses an expired delegation, and one signed for another app (8.5)', async () => {
    const app = await gateway();
    const person: Caller = { id: 'u-1', name: 'Alex Rivera', roles: [], departments: [] };
    const expired = await signDelegation(signer, person, { app: 'notes', scopes: [], lifetimeSeconds: -120 });
    const a = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('notes')}`, [DELEGATION_HEADER]: expired }, payload: {} });
    expect(a.statusCode).toBe(401);
    expect(a.json().message).toBe('The delegation has expired.');
    const others = await signDelegation(signer, person, { app: 'other', scopes: ['notifications:send'], lifetimeSeconds: 120 });
    const b = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('notes')}`, [DELEGATION_HEADER]: others }, payload: {} });
    expect(b.statusCode).toBe(401);
  });

  it('holds a delegated call to the scopes the delegation carried, not only the grant (8.5)', async () => {
    const app = await gateway();
    const person: Caller = { id: 'u-1', name: 'Alex Rivera', roles: [], departments: [] };
    const narrow = await signDelegation(signer, person, { app: 'notes', scopes: [], lifetimeSeconds: 120 });
    const res = await app.inject({ method: 'POST', url: '/api/events/v1/notifications', headers: { authorization: `Bearer ${await signApp('notes')}`, [DELEGATION_HEADER]: narrow }, payload: {} });
    expect(res.statusCode).toBe(403);
  });
});
