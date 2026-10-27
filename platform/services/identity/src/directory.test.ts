import { describe, expect, it } from 'vitest';
import { BRUTE_FORCE_POLICY, KeycloakDirectory, REALM_ADMIN_ROLES } from './directory.ts';

type Call = { method: string; url: string; body?: string };

/** A Keycloak that answers token requests and the admin API from `answer`. */
const keycloak = (answer: (method: string, path: string) => unknown) => {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? String(init.body) : undefined });
    if (url.endsWith('/protocol/openid-connect/token')) return Response.json({ access_token: 't', expires_in: 300 });
    const path = url.replace('http://kc/admin/realms/platform', '');
    const data = answer(method, path);
    return data === undefined ? new Response(null, { status: 204 }) : Response.json(data);
  }) as typeof fetch;
  return { calls, fetchImpl };
};

describe('identity’s sign-in to Keycloak', () => {
  it('signs in as its own client in the realm, never to the master realm', async () => {
    const { calls, fetchImpl } = keycloak(() => []);
    const directory = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { client: { id: 'platform-identity', secret: 's3cret' } }, fetchImpl });
    await directory.call('GET', '/roles');
    expect(calls[0]!.url).toBe('http://kc/realms/platform/protocol/openid-connect/token');
    expect(Object.fromEntries(new URLSearchParams(calls[0]!.body))).toEqual({ grant_type: 'client_credentials', client_id: 'platform-identity', client_secret: 's3cret' });
  });

  it('gives its own client only the realm-management roles it lacks', async () => {
    const { calls, fetchImpl } = keycloak((method, path) => {
      if (path === '/clients?clientId=platform-identity') return [{ id: 'c-1', clientId: 'platform-identity' }];
      if (path === '/clients/c-1/service-account-user') return { id: 'sa-1' };
      if (path === '/clients?clientId=realm-management') return [{ id: 'rm-1', clientId: 'realm-management' }];
      if (path === '/users/sa-1/role-mappings/clients/rm-1' && method === 'GET') return [{ id: 'r-view', name: 'view-users' }];
      if (path === '/clients/rm-1/roles') return ['view-users', 'manage-users', 'realm-admin', 'manage-realm'].map((name) => ({ id: `r-${name}`, name }));
      return undefined;
    });
    const directory = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { admin: { user: 'kc-admin', password: 'pw' } }, fetchImpl });
    expect(await directory.grantRealmAdmin('platform-identity')).toEqual(['manage-users', 'manage-realm']);
    expect(calls[0]!.url).toBe('http://kc/realms/master/protocol/openid-connect/token');
    const grant = calls.find((c) => c.method === 'POST' && c.url.endsWith('/role-mappings/clients/rm-1'))!;
    expect(JSON.parse(grant.body!).map((r: { name: string }) => r.name)).toEqual(['manage-users', 'manage-realm']);
    expect(REALM_ADMIN_ROLES).not.toContain('realm-admin');
  });

  it('turns on the brute-force policy once, and leaves a realm that has it alone', async () => {
    let protectedNow = false;
    const { calls, fetchImpl } = keycloak((method, path) => (method === 'GET' && path === '' ? { realm: 'platform', bruteForceProtected: protectedNow } : undefined));
    const directory = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { client: { id: 'platform-identity', secret: 's' } }, fetchImpl });
    expect(await directory.ensureSignInPolicy()).toBe(true);
    expect(JSON.parse(calls.find((c) => c.method === 'PUT')!.body!)).toEqual(BRUTE_FORCE_POLICY);
    protectedNow = true;
    expect(await directory.ensureSignInPolicy()).toBe(false);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });
});
