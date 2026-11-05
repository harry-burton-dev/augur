import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { DirectoryError, TWO_STEP_ROLE } from './directory.ts';
import { KeycloakAccounts, MemoryAccounts, securityOf } from './me.ts';

const alex = { id: 'u-1', name: 'Alex Rivera', departments: [], roles: [] };
const admin = { ...alex, roles: ['admin', TWO_STEP_ROLE.name] };

const accountsWithAlex = () => {
  const accounts = new MemoryAccounts();
  accounts.add('u-1', { username: 'alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', emailVerified: true }, {
    credentials: [{ id: 'c-pw', type: 'password' }, { id: 'c-otp', type: 'otp', label: 'Phone' }],
    sessions: [
      { id: 's-here', startedAt: '2026-11-05T08:00:00.000Z', lastSeenAt: '2026-11-05T09:00:00.000Z', clients: ['platform-shell'] },
      { id: 's-laptop', startedAt: '2026-11-04T08:00:00.000Z', lastSeenAt: '2026-11-04T18:00:00.000Z', clients: ['platform-shell'] },
    ],
    signIns: [
      { time: '2026-11-05T08:00:00.000Z', kind: 'signed-in', event: 'LOGIN' },
      { time: '2026-11-05T07:59:00.000Z', kind: 'failed', event: 'LOGIN_ERROR', error: 'invalid_user_credentials' },
    ],
  });
  accounts.add('u-2', { username: 'sam' }, { sessions: [{ id: 's-sam', startedAt: '2026-11-05T08:00:00.000Z', lastSeenAt: '2026-11-05T08:00:00.000Z', clients: [] }] });
  return accounts;
};

describe('the caller’s account', () => {
  it('shows and changes their own profile, never someone else’s', async () => {
    const accounts = accountsWithAlex();
    const app = await buildApp({ accounts });
    const me = callerHeaders(alex);
    expect((await app.inject({ method: 'GET', url: '/v1/me/profile', headers: me })).json()).toMatchObject({ username: 'alex', email: 'alex@example.org', managed: [] });
    const changed = await app.inject({ method: 'PATCH', url: '/v1/me/profile', headers: me, payload: { jobTitle: 'Analyst', pronouns: 'they/them' } });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ jobTitle: 'Analyst', pronouns: 'they/them', firstName: 'Alex' });
    // an empty string takes a fact away
    expect((await app.inject({ method: 'PATCH', url: '/v1/me/profile', headers: me, payload: { jobTitle: '' } })).json().jobTitle).toBeUndefined();
    // the email address changes on Keycloak's screen, which checks it; unknown fields are refused
    expect((await app.inject({ method: 'PATCH', url: '/v1/me/profile', headers: me, payload: { email: 'x@example.org' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: '/v1/me/profile', headers: me, payload: { phone: 'call me' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: '/v1/me/profile', headers: me, payload: {} })).statusCode).toBe(400);
    expect((await accounts.profile('u-2')).jobTitle).toBeUndefined();
  });

  it('refuses a change to what the organisation’s sign-in sets, and says where to change it', async () => {
    const accounts = new MemoryAccounts();
    accounts.add('u-1', { username: 'alex', firstName: 'Alex', managed: ['firstName', 'lastName', 'email'], managedBy: 'Contoso' });
    const app = await buildApp({ accounts });
    const res = await app.inject({ method: 'PATCH', url: '/v1/me/profile', headers: callerHeaders(alex), payload: { firstName: 'Al' } });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain('Contoso sets your first name');
    // the same value, sent back with a form, isn't a change
    expect((await app.inject({ method: 'PATCH', url: '/v1/me/profile', headers: callerHeaders(alex), payload: { firstName: 'Alex', pronouns: 'he/him' } })).statusCode).toBe(200);
  });

  it('lists where they’re signed in, and ends only their own sessions', async () => {
    const accounts = accountsWithAlex();
    const app = await buildApp({ accounts });
    const me = callerHeaders(alex);
    expect((await app.inject({ method: 'GET', url: '/v1/me/sessions', headers: me })).json().sessions.map((s: { id: string }) => s.id)).toEqual(['s-here', 's-laptop']);
    expect((await app.inject({ method: 'DELETE', url: '/v1/me/sessions/s-sam', headers: me })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/v1/me/sessions/s-laptop', headers: me })).statusCode).toBe(204);
    expect((await accounts.sessions('u-1')).map((s) => s.id)).toEqual(['s-here']);
    expect((await accounts.sessions('u-2')).length).toBe(1);
    // everywhere else, keeping this one; then everywhere
    accounts.people.get('u-1')!.sessions.push({ id: 's-phone', startedAt: '2026-11-05T08:00:00.000Z', lastSeenAt: '2026-11-05T08:00:00.000Z', clients: [] });
    expect((await app.inject({ method: 'DELETE', url: '/v1/me/sessions?keep=s-here', headers: me })).json()).toEqual({ ended: 1 });
    expect((await app.inject({ method: 'DELETE', url: '/v1/me/sessions', headers: me })).json()).toEqual({ ended: 1 });
  });

  it('lists recent sign-ins, failed ones too', async () => {
    const app = await buildApp({ accounts: accountsWithAlex() });
    const res = await app.inject({ method: 'GET', url: '/v1/me/sign-ins?max=1', headers: callerHeaders(alex) });
    expect(res.json()).toEqual({ signIns: [{ time: '2026-11-05T08:00:00.000Z', kind: 'signed-in', event: 'LOGIN' }] });
    expect((await app.inject({ method: 'GET', url: '/v1/me/sign-ins?max=500', headers: callerHeaders(alex) })).statusCode).toBe(400);
  });

  it('says how they sign in and which of Keycloak’s screens changes each', async () => {
    const app = await buildApp({ accounts: accountsWithAlex() });
    const security = (await app.inject({ method: 'GET', url: '/v1/me/security', headers: callerHeaders(admin) })).json();
    expect(security.password).toEqual({ set: true });
    expect(security.twoStep).toMatchObject({ required: true, set: true });
    // their only code app stays while their role needs one
    expect(security.codeApps).toEqual([expect.objectContaining({ id: 'c-otp', removeAction: 'delete_credential:c-otp', removable: false, reason: expect.stringContaining('Add another') })]);
    expect(security.actions.find((a: { id: string }) => a.id === 'password')).toEqual({ id: 'password', action: 'UPDATE_PASSWORD', available: true });
    // someone whose role doesn't need it may remove it
    const plain = (await app.inject({ method: 'GET', url: '/v1/me/security', headers: callerHeaders(alex) })).json();
    expect(plain.codeApps[0]).toMatchObject({ removable: true });
    expect(plain.twoStep.required).toBe(false);
  });

  it('says an organisation sign-in holds the password and sets the email', () => {
    const s = securityOf({ roles: [] }, [], [{ provider: 'entra', name: 'Contoso' }], [{ alias: 'entra', name: 'Contoso', setsProfile: true }, { alias: 'other', name: 'Other', setsProfile: false }], {
      managed: ['firstName', 'lastName', 'email'],
      managedBy: 'Contoso',
    });
    expect(s.password).toEqual({ set: false, managedBy: 'Contoso' });
    expect(s.actions.find((a) => a.id === 'password')).toMatchObject({ available: false, reason: expect.stringContaining('through Contoso') });
    expect(s.actions.find((a) => a.id === 'email')).toMatchObject({ available: false, reason: expect.stringContaining('Contoso sets your email') });
    expect(s.canLink).toEqual([{ alias: 'other', name: 'Other', action: 'idp_link:other' }]);
  });

  it('answers 503, saying why, without the sign-in service; preferences still work', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me/profile', headers: callerHeaders(alex) });
    expect(res.statusCode).toBe(503);
    expect(res.json().message).toContain('deployment admin can connect it');
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences', headers: callerHeaders(alex) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/me/profile' })).statusCode).toBe(401);
  });

  it('keeps a time zone, away message and notification choices, refusing ones that make no sense', async () => {
    const app = await buildApp();
    const me = callerHeaders(alex);
    const prefs = { quietKinds: ['folio:comment'], pinned: ['folio', 'atlas'], startFloor: 'ws-finance', timeZone: 'Europe/London', awayMessage: 'Back Monday', awayUntil: '2026-11-09T09:00:00.000Z', notifications: { email: false, digest: 'weekly', quietHours: { from: '22:00', to: '07:00' } } };
    expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: me, payload: prefs })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences', headers: me })).json()).toEqual(prefs);
    for (const bad of [{ timeZone: 'Mars/Olympus' }, { notifications: { quietHours: { from: '22:00', to: '22:00' } } }, { notifications: { quietHours: { from: '25:00', to: '07:00' } } }, { notifications: { digest: 'hourly' } }, { pinned: ['folio', 'folio'] }, { quietKinds: ['folio'] }]) {
      expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: me, payload: bad })).statusCode).toBe(400);
    }
  });
});

describe('accounts in Keycloak', () => {
  /** A Keycloak admin API that answers from a table of paths, recording what was sent. */
  const keycloak = (routes: Record<string, unknown>) => {
    const sent: { method: string; path: string; body?: unknown }[] = [];
    return {
      sent,
      call: async <T,>(method: string, path: string, body?: unknown) => {
        sent.push({ method, path, body });
        const key = `${method} ${path.split('?')[0]}`;
        if (!(key in routes)) {
          if (method === 'GET') throw new DirectoryError('not found', 404);
          return { data: undefined as T };
        }
        return { data: routes[key] as T };
      },
    };
  };

  it('reads the profile’s attributes and marks what a forcing organisation sign-in sets', async () => {
    const kc = keycloak({
      'GET /users/u-1': { id: 'u-1', username: 'alex', firstName: 'Alex', email: 'a@example.org', emailVerified: true, attributes: { jobTitle: ['Analyst'], phone: [''] } },
      'GET /users/u-1/federated-identity': [{ identityProvider: 'entra', userName: 'alex@contoso' }],
      'GET /identity-provider/instances': [{ alias: 'entra', displayName: 'Contoso', enabled: true, config: { syncMode: 'FORCE' } }],
    });
    const profile = await new KeycloakAccounts(kc).profile('u-1');
    expect(profile).toEqual({ username: 'alex', firstName: 'Alex', lastName: '', email: 'a@example.org', emailVerified: true, jobTitle: 'Analyst', managed: ['firstName', 'lastName', 'email'], managedBy: 'Contoso' });
  });

  it('writes attributes back with the rest of the user, dropping emptied ones', async () => {
    const user = { id: 'u-1', username: 'alex', firstName: 'Alex', attributes: { jobTitle: ['Analyst'], locale: ['en'] } };
    const kc = keycloak({ 'GET /users/u-1': user, 'GET /users/u-1/federated-identity': [], 'GET /identity-provider/instances': [] });
    await new KeycloakAccounts(kc).updateProfile('u-1', { jobTitle: '', pronouns: 'they/them', lastName: ' Rivera ' });
    expect(kc.sent.find((s) => s.method === 'PUT')).toEqual({ method: 'PUT', path: '/users/u-1', body: { ...user, lastName: 'Rivera', attributes: { locale: ['en'], pronouns: ['they/them'] } } });
  });

  it('ends only a session that is the person’s own', async () => {
    const kc = keycloak({ 'GET /users/u-1/sessions': [{ id: 's-1', start: 0, lastAccess: 1, clients: { a: 'platform-shell' } }] });
    const accounts = new KeycloakAccounts(kc);
    await expect(accounts.endSession('u-1', 's-other')).rejects.toThrow('not signed in there');
    await accounts.endSession('u-1', 's-1');
    expect(kc.sent.at(-1)).toEqual({ method: 'DELETE', path: '/sessions/s-1', body: undefined });
  });

  it('asks Keycloak for sign-in events of the person alone', async () => {
    const kc = keycloak({ 'GET /events': [{ time: Date.UTC(2026, 10, 5), type: 'LOGIN_ERROR', ipAddress: '10.0.0.1', clientId: 'platform-shell', error: 'invalid_user_credentials' }] });
    const list = await new KeycloakAccounts(kc).signIns('u-1', 5);
    expect(list).toEqual([{ time: '2026-11-05T00:00:00.000Z', kind: 'failed', event: 'LOGIN_ERROR', ipAddress: '10.0.0.1', client: 'platform-shell', error: 'invalid_user_credentials' }]);
    const q = new URLSearchParams(kc.sent[0]!.path.split('?')[1]);
    expect(q.get('user')).toBe('u-1');
    expect(q.getAll('type')).toContain('LOGIN');
  });
});
