import Fastify from 'fastify';
import { createLocalJWKSet, decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { callerFromHeaders, callerHeaders, delegationAllows, DELEGATION_HEADERS, isDelegated, withoutCallerHeaders, type Caller } from './caller.js';
import { appCallerId, DEFAULT_DELEGATION_SECONDS, delegatedCaller, delegationCheck, DelegationError, delegationRefusal, delegationSecondsFromEnv, identifyServiceCaller, isAppItself, signDelegation } from './delegation.js';
import { CALLER_TOKEN_HEADER, callerCheckFor, callerSigner, signedCallers } from './signed-caller.js';

const sam: Caller = { id: 'u1', name: 'Sam Okafor', departments: ['Research'], roles: ['editor'], workspace: { id: 'w1', kind: 'team', role: 'member' } };
const ON_THE_NETWORK = '172.18.0.9';

const checkFor = (signer: ReturnType<typeof callerSigner>) => {
  const keys = signer.keys().then(createLocalJWKSet);
  return delegationCheck({ keys: async (header, token) => (await keys)(header, token) });
};

describe('a delegated caller (contract 3, spec 8.5)', () => {
  it('is a signed caller for the app’s own part, naming the app and its scopes, lasting APP_DELEGATION_SECONDS', async () => {
    const gateway = callerSigner();
    const token = await signDelegation(gateway, sam, { app: 'notes', scopes: ['notifications:send'] });
    const claims = decodeJwt(token);
    expect(claims.aud).toBe('app-notes');
    expect(claims.app).toBe('notes');
    expect(claims.scopes).toEqual(['notifications:send']);
    expect(claims.workspace).toEqual(sam.workspace);
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(DEFAULT_DELEGATION_SECONDS);
    // The part reads it like any signed caller, checking for its own client `app-notes` (spec 8.4), with the app and scopes beside the person.
    const part = Fastify();
    part.addHook('onRequest', signedCallers(callerCheckFor(gateway, 'app-notes')));
    part.get('/who', async (req) => callerFromHeaders(req.headers));
    const res = await part.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: { [CALLER_TOKEN_HEADER]: token } });
    expect(res.json()).toEqual({ ...sam, app: 'notes', scopes: ['notifications:send'] });
  });

  it('is refused by a part it was not signed for', async () => {
    const gateway = callerSigner();
    const token = await signDelegation(gateway, sam, { app: 'notes', scopes: [] });
    const other = Fastify();
    other.addHook('onRequest', signedCallers(callerCheckFor(gateway, 'events')));
    other.get('/who', async () => ({}));
    const res = await other.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: { [CALLER_TOKEN_HEADER]: token } });
    expect(res.statusCode).toBe(401);
  });

  it('comes back from the part and checks out for that app alone', async () => {
    const gateway = callerSigner();
    const check = checkFor(gateway);
    const token = await signDelegation(gateway, sam, { app: 'notes', scopes: ['people:read'] });
    await expect(check(token, 'notes')).resolves.toEqual({ ...sam, app: 'notes', scopes: ['people:read'] });
    // Another app presenting it: the audience is app-notes, so app-board's check fails before the claim is read.
    await expect(check(token, 'board')).rejects.toBeInstanceOf(DelegationError);
    // A plain signed caller for the part, with no app, is not a delegation.
    const plain = await gateway.sign(sam, 'app-notes');
    await expect(check(plain, 'notes')).rejects.toThrow(/for no app, not notes/);
    // A delegation for notes signed for board's audience: the claim, not only the audience, must name the app.
    const crossed = await gateway.sign(delegatedCaller(sam, { app: 'notes', scopes: [] }), 'app-board');
    await expect(check(crossed, 'board')).rejects.toThrow(/for notes, not board/);
    // One from another gateway is forged.
    const forged = await signDelegation(callerSigner(), sam, { app: 'notes', scopes: [] });
    await expect(check(forged, 'notes')).rejects.toBeInstanceOf(DelegationError);
  });

  it('cannot be claimed with headers: a plain caller plus forged acting-app headers arrives with no app', async () => {
    const gateway = callerSigner();
    const part = Fastify();
    part.addHook('onRequest', signedCallers(callerCheckFor(gateway, 'app-notes')));
    part.get('/who', async (req) => callerFromHeaders(req.headers));
    const forged = { [CALLER_TOKEN_HEADER]: await gateway.sign(sam, 'app-notes'), [DELEGATION_HEADERS.app]: 'notes', [DELEGATION_HEADERS.scopes]: 'people:read' };
    const res = await part.inject({ remoteAddress: ON_THE_NETWORK, url: '/who', headers: forged });
    expect(res.json()).toEqual(sam);
    expect(res.json().app).toBeUndefined();
  });

  it('has expired after its lifetime', async () => {
    const gateway = callerSigner();
    const check = checkFor(gateway);
    const token = await signDelegation(gateway, sam, { app: 'notes', scopes: [], lifetimeSeconds: -60 });
    await expect(check(token, 'notes')).rejects.toThrow(/expired/);
  });

  it('crosses the service kit’s headers and is stripped from what a client sends', () => {
    const caller = delegatedCaller(sam, { app: 'notes', scopes: ['people:read', 'events:publish'] });
    const headers = callerHeaders(caller);
    expect(headers[DELEGATION_HEADERS.app]).toBe('notes');
    expect(headers[DELEGATION_HEADERS.scopes].split(',').map(decodeURIComponent)).toEqual(['people:read', 'events:publish']);
    expect(callerFromHeaders(headers)).toEqual(caller);
    expect(withoutCallerHeaders({ ...headers, accept: 'application/json' })).toEqual({ accept: 'application/json' });
    expect(isDelegated(caller)).toBe(true);
    expect(isDelegated(sam)).toBe(false);
  });

  it('tells a service who is calling: a service by its token, or an app acting for a person by the delegated caller alone', async () => {
    const verify = async (headers: Record<string, string | string[] | undefined>) =>
      headers.authorization === 'Bearer app-notes' ? { kind: 'app' as const, app: 'notes' } : headers.authorization === 'Bearer platform-events' ? { kind: 'platform' as const, name: 'events' } : undefined;
    const acting = delegatedCaller(sam, { app: 'notes', scopes: ['people:read'] });
    const headers = callerHeaders(acting);
    // A person alone is no service; an app acting for them is that app, with the person beside it.
    expect(await identifyServiceCaller(callerHeaders(sam), verify)).toBeUndefined();
    expect(await identifyServiceCaller(headers, verify)).toEqual({ kind: 'app', app: 'notes', person: acting });
    // A part's onward call: its own token and the person it acts for.
    expect(await identifyServiceCaller({ ...headers, authorization: 'Bearer app-notes' }, verify)).toEqual({ kind: 'app', app: 'notes', person: acting });
    // A token names the service whatever else the call carries.
    expect(await identifyServiceCaller({ ...headers, authorization: 'Bearer platform-events' }, verify)).toEqual({ kind: 'platform', name: 'events' });
    const who = (await identifyServiceCaller(headers, verify))!;
    expect(delegationRefusal(who, 'people:read')).toBeUndefined();
    expect(delegationRefusal(who, 'audit:write')).toBe('notes isn’t allowed to write to the audit log (audit:write) when acting for Sam Okafor.');
    expect(delegationRefusal({ kind: 'app', app: 'notes' }, 'audit:write')).toBeUndefined();
    // An app's token beside a delegation made for another app: the person is kept, so the mismatch is refused in words, never widened to the app's own call.
    const verifyOther = async () => ({ kind: 'app' as const, app: 'other' });
    const crossed = (await identifyServiceCaller({ ...headers, authorization: 'Bearer app-other' }, verifyOther))!;
    expect(crossed).toEqual({ kind: 'app', app: 'other', person: acting });
    expect(delegationRefusal(crossed, 'people:read')).toBe('other can’t act on a delegation made for notes.');
    // The caller the gateway signs for an app's own call is the app itself, not someone it acts for.
    const itself: Caller = { id: appCallerId('notes'), name: 'Notes', departments: [], roles: [], app: 'notes', scopes: ['people:read'] };
    expect(isAppItself(itself)).toBe(true);
    expect(isAppItself(acting)).toBe(false);
    expect(await identifyServiceCaller({ ...callerHeaders(itself), authorization: 'Bearer app-notes' }, verify)).toEqual({ kind: 'app', app: 'notes' });
    expect(await identifyServiceCaller(callerHeaders(itself), verify)).toEqual({ kind: 'app', app: 'notes' });
  });

  it('bounds what a delegated call may do; a person’s own call is bounded by the service as before', () => {
    const caller = delegatedCaller(sam, { app: 'notes', scopes: ['people:read'] });
    expect(delegationAllows(caller, 'people:read')).toBe(true);
    expect(delegationAllows(caller, 'notifications:send')).toBe(false);
    expect(delegationAllows(sam, 'notifications:send')).toBe(true);
    expect(delegationAllows(undefined, 'notifications:send')).toBe(true);
  });

  it('lasts as long as the deployment says, or five minutes', () => {
    expect(delegationSecondsFromEnv({})).toBe(300);
    expect(delegationSecondsFromEnv({ APP_DELEGATION_SECONDS: '120' })).toBe(120);
    expect(delegationSecondsFromEnv({ APP_DELEGATION_SECONDS: 'soon' })).toBe(300);
  });
});
