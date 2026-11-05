import { describe, expect, it } from 'vitest';
import { KeycloakDirectory } from './directory.ts';
import { IDENTITY_RIGHTS } from './realm.ts';

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

  it('reads from its own token whether it holds every right it needs', async () => {
    const tokenWith = (roles: string[]) => `h.${Buffer.from(JSON.stringify({ resource_access: { 'realm-management': { roles } } })).toString('base64url')}.s`;
    const signIn = { client: { id: 'platform-identity', secret: 's' } };
    const answering = (res: () => Response) => (async () => res()) as typeof fetch;
    const full = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, fetchImpl: answering(() => Response.json({ access_token: tokenWith([...IDENTITY_RIGHTS]), expires_in: 300 })) });
    expect(await full.hasRights(IDENTITY_RIGHTS)).toBe(true);
    const partial = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, fetchImpl: answering(() => Response.json({ access_token: tokenWith(['view-users']), expires_in: 300 })) });
    expect(await partial.hasRights(IDENTITY_RIGHTS)).toBe(false);
    const refused = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, fetchImpl: answering(() => new Response('{"error":"unauthorized_client"}', { status: 401 })) });
    expect(await refused.hasRights(IDENTITY_RIGHTS)).toBe(false);
    const down = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch });
    await expect(down.hasRights(IDENTITY_RIGHTS)).rejects.toThrow('can’t be reached');
  });

  it('gives a role to the first admin only while nobody holds it', async () => {
    let holders: unknown[] = [];
    const { calls, fetchImpl } = keycloak((method, path) => {
      if (path.startsWith('/roles/deployment-admin/users')) return holders;
      if (path === '/users?username=harry&exact=true') return [{ id: 'u-1', username: 'harry' }];
      if (path === '/roles/deployment-admin') return { id: 'r-1', name: 'deployment-admin' };
      return undefined;
    });
    const directory = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { client: { id: 'platform-identity', secret: 's' } }, fetchImpl });
    expect(await directory.ensureRoleHolder('deployment-admin', 'harry')).toBe(true);
    expect(JSON.parse(calls.find((c) => c.method === 'POST' && c.url.endsWith('/users/u-1/role-mappings/realm'))!.body!)).toEqual([{ id: 'r-1', name: 'deployment-admin' }]);
    holders = [{ id: 'u-1' }];
    expect(await directory.ensureRoleHolder('deployment-admin', 'harry')).toBe(false);
  });

  it('reads past one page of a list, so a big realm loses nobody', async () => {
    const everyone = Array.from({ length: 1201 }, (_, i) => ({ id: `u-${i}`, username: `p${i}`, enabled: true }));
    const { calls, fetchImpl } = keycloak((_method, path) => {
      const page = /^\/users\?briefRepresentation=false&first=(\d+)&max=(\d+)$/.exec(path);
      if (page) return everyone.slice(Number(page[1]), Number(page[1]) + Number(page[2]));
      return [];
    });
    const directory = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { client: { id: 'platform-identity', secret: 's' } }, fetchImpl });
    expect((await directory.people()).length).toBe(1201);
    expect(calls.filter((c) => c.url.includes('/users?')).length).toBe(3);
  });

  it('signs someone out everywhere: their sessions, then each app’s offline tokens', async () => {
    const { calls, fetchImpl } = keycloak((method, path) => (method === 'GET' && path === '/users/u-1/consents' ? [{ clientId: 'platform-shell' }, { clientId: 'folio' }] : undefined));
    const directory = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn: { client: { id: 'platform-identity', secret: 's' } }, fetchImpl });
    await directory.endSessions('u-1');
    const admin = calls.filter((c) => !c.url.endsWith('/token')).map((c) => `${c.method} ${c.url.replace('http://kc/admin/realms/platform', '')}`);
    expect(admin).toEqual(['POST /users/u-1/logout', 'GET /users/u-1/consents', 'DELETE /users/u-1/consents/platform-shell', 'DELETE /users/u-1/consents/folio']);
  });
});
