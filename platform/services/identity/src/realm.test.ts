import { describe, expect, it } from 'vitest';
import { KeycloakDirectory } from './directory.ts';
import { applyRealmSettings, applyServiceAccountRights, applySignInFlow, IDENTITY_RIGHTS, passwordPolicy, REALM_FLOORS, realmSettingsFromEnv, TWO_STEP_STEP } from './realm.ts';

type Call = { method: string; path: string; body?: unknown };

/** A Keycloak admin API answered by `answer`, recording every call. */
const keycloak = (answer: (method: string, path: string, body?: unknown) => unknown) => {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/protocol/openid-connect/token')) return Response.json({ access_token: 't', expires_in: 300 });
    const method = init?.method ?? 'GET';
    const path = url.replace('http://kc/admin/realms/platform', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const data = answer(method, path, body);
    return data === undefined ? new Response(null, { status: 204 }) : Response.json(data);
  }) as typeof fetch;
  return { calls, kc: new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { admin: { user: 'a', password: 'p' } }, fetchImpl }) };
};

describe('the realm’s settings', () => {
  it('start at the floors from ADR 0038', () => {
    expect(realmSettingsFromEnv({})).toEqual(REALM_FLOORS);
    expect(passwordPolicy(REALM_FLOORS)).toBe('length(15) and maxLength(256) and notUsername(undefined) and notEmail(undefined) and passwordBlacklist(ncsc-top100k.txt)');
  });

  it('take a stricter value from a deployment, and keep the floor for a looser one', () => {
    const warnings: string[] = [];
    const s = realmSettingsFromEnv(
      { REALM_PASSWORD_MIN_LENGTH: '20', REALM_SESSION_IDLE_HOURS: '12', REALM_SESSION_MAX_HOURS: '4', REALM_SIGN_IN_EVENT_DAYS: '30', REALM_ADMIN_EVENT_DAYS: 'lots' },
      (m) => warnings.push(m),
    );
    expect(s).toMatchObject({ passwordMinLength: 20, sessionIdleHours: 4, sessionMaxHours: 4, signInEventDays: 90, adminEventDays: 365 });
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain('REALM_SESSION_IDLE_HOURS=12 is looser');
  });

  it('can drop the breached-password list only by saying so, with a warning', () => {
    const warnings: string[] = [];
    expect(passwordPolicy(realmSettingsFromEnv({ REALM_PASSWORD_DENYLIST: 'none' }, (m) => warnings.push(m)))).not.toContain('passwordBlacklist');
    expect(warnings[0]).toContain('not checked');
    expect(realmSettingsFromEnv({ REALM_PASSWORD_DENYLIST: '../../etc/passwd' }).passwordDenylist).toBe(REALM_FLOORS.passwordDenylist);
  });

  it('are written only when they differ, keeping the realm’s other attributes', async () => {
    let realm: Record<string, unknown> = { displayName: 'AUGUR', attributes: { other: 'kept' } };
    const { calls, kc } = keycloak((method, path, body) => {
      if (path !== '') return undefined;
      if (method === 'PUT') realm = { ...realm, ...(body as object) };
      return method === 'GET' ? realm : undefined;
    });
    const changes: string[] = [];
    await applyRealmSettings(kc, REALM_FLOORS, changes);
    const put = calls.find((c) => c.method === 'PUT')!.body as Record<string, unknown>;
    expect(put).toMatchObject({ ssoSessionIdleTimeout: 8 * 3600, ssoSessionMaxLifespan: 10 * 3600, eventsEnabled: true, adminEventsEnabled: true, webAuthnPolicyPasswordlessPasskeysEnabled: true, webAuthnPolicyRpEntityName: 'AUGUR' });
    expect(put.attributes).toEqual({ other: 'kept', adminEventsExpiration: String(365 * 86400) });
    expect(changes).toHaveLength(1);
    await applyRealmSettings(kc, REALM_FLOORS, changes);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });
});

describe('identity’s rights', () => {
  it('leave out manage-realm, so identity can’t change how people sign in', () => {
    expect(IDENTITY_RIGHTS).not.toContain('manage-realm');
    expect(IDENTITY_RIGHTS).not.toContain('realm-admin');
  });

  it('are set to exactly the list: missing ones given, extra ones taken away', async () => {
    const { calls, kc } = keycloak((method, path) => {
      if (path === '/clients?clientId=platform-identity') return [{ id: 'c-1' }];
      if (path === '/clients/c-1/service-account-user') return { id: 'sa-1' };
      if (path === '/clients?clientId=realm-management') return [{ id: 'rm-1' }];
      if (path === '/users/sa-1/role-mappings/clients/rm-1' && method === 'GET') return ['view-users', 'manage-realm'].map((name) => ({ id: `r-${name}`, name }));
      if (path === '/clients/rm-1/roles') return [...IDENTITY_RIGHTS, 'manage-realm', 'realm-admin'].map((name) => ({ id: `r-${name}`, name }));
      return undefined;
    });
    const changes: string[] = [];
    await applyServiceAccountRights(kc, 'platform-identity', IDENTITY_RIGHTS, changes);
    const given = calls.find((c) => c.method === 'POST')!.body as { name: string }[];
    const taken = calls.find((c) => c.method === 'DELETE')!.body as { name: string }[];
    expect(given.map((r) => r.name).sort()).toEqual(IDENTITY_RIGHTS.filter((r) => r !== 'view-users').sort());
    expect(taken.map((r) => r.name)).toEqual(['manage-realm']);
    expect(changes[0]).toContain('taken away manage-realm');
  });
});

describe('the sign-in flow', () => {
  it('is left alone when it already has the admin roles’ step and is in use', async () => {
    const { calls, kc } = keycloak((method, path) => {
      if (path === '/authentication/flows') return [{ id: 'f-1', alias: 'augur browser' }];
      if (path === '/authentication/flows/augur%20browser/executions') return [{ id: 'e-1', level: 1, index: 2, requirement: 'CONDITIONAL', displayName: TWO_STEP_STEP, authenticationFlow: true }];
      if (path === '' && method === 'GET') return { browserFlow: 'augur browser' };
      return undefined;
    });
    const changes: string[] = [];
    await applySignInFlow(kc, changes);
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
    expect(changes).toEqual([]);
  });

  it('replaces an older release’s flow, handing sign-in back to Keycloak’s own flow first', async () => {
    const { calls, kc } = keycloak((method, path) => {
      if (path === '/authentication/flows') return [{ id: 'f-old', alias: 'augur browser' }];
      if (path === '/authentication/flows/augur%20browser/executions') return [{ id: 'e-1', level: 1, index: 2, requirement: 'CONDITIONAL', displayName: 'deployment-admin code', authenticationFlow: true }];
      return undefined;
    });
    // The rebuilt copy is shaped unlike Keycloak's, so the build stops; the old flow is already out of use by then.
    await expect(applySignInFlow(kc, [])).rejects.toThrow('shaped as expected');
    const writes = calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);
    expect(writes.slice(0, 3)).toEqual(['PUT ', 'DELETE /authentication/flows/f-old', 'POST /authentication/flows/browser/copy']);
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ browserFlow: 'browser' });
  });
});
