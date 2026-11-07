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

describe('invites through Keycloak', () => {
  const signIn = { client: { id: 'platform-identity', secret: 's' } };

  it('adds someone with no password who must confirm their email and choose one, then emails the link', async () => {
    const { calls, fetchImpl } = keycloak((method, path) => {
      if (method === 'GET' && path === '') return { smtpServer: { host: 'smtp.example.org' } };
      if (method === 'GET' && path === '/users/u-9') return { id: 'u-9', username: 'jo', firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', enabled: true, requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] };
      if (method === 'GET') return [];
      return undefined;
    });
    const located = (async (input: string | URL, init?: RequestInit) => {
      const res = await fetchImpl(input, init);
      return init?.method === 'POST' && String(input).endsWith('/users') ? new Response(null, { status: 201, headers: { location: 'http://kc/admin/realms/platform/users/u-9' } }) : res;
    }) as typeof fetch;
    const directory = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, invite: { clientId: 'shell', redirectUri: 'https://augur.example.org/' }, fetchImpl: located });
    expect(await directory.canEmail()).toBe(true);
    const made = await directory.createPerson({ username: 'jo', firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', roles: [], departments: [] });
    expect(made.invited).toBe(true);
    const created = JSON.parse(calls.find((c) => c.method === 'POST' && c.url.endsWith('/users'))!.body!);
    expect(created).toMatchObject({ emailVerified: false, requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] });
    expect(created.credentials).toBeUndefined();

    await directory.sendInvite('u-9', 72 * 3600);
    const sent = calls.find((c) => c.url.includes('/execute-actions-email'))!;
    expect(sent.method).toBe('PUT');
    expect(Object.fromEntries(new URL(sent.url).searchParams)).toEqual({ lifespan: '259200', client_id: 'shell', redirect_uri: 'https://augur.example.org/' });
    expect(JSON.parse(sent.body!)).toEqual(['VERIFY_EMAIL', 'UPDATE_PASSWORD']);
  });

  it('says email can’t be sent when the realm has no relay', async () => {
    const { fetchImpl } = keycloak(() => ({}));
    expect(await new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, fetchImpl }).canEmail()).toBe(false);
  });
});

describe('refusing a bad role or department', () => {
  const signIn = { client: { id: 'platform-identity', secret: 's' } };
  const person = { username: 'jo', firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', roles: [] as string[], departments: [] as string[] };
  const directory = () => {
    const { calls, fetchImpl } = keycloak((method, path) => {
      if (method !== 'GET') return undefined;
      if (path.startsWith('/roles')) return [{ id: 'r-1', name: 'editor' }];
      if (path === '/users/u-1') return { id: 'u-1', username: 'jo', enabled: true };
      return [];
    });
    return { calls, kc: new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, fetchImpl }) };
  };
  const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET' && !c.url.endsWith('/token'));

  it('adds nobody, so asking again with the right role isn’t refused as a clash', async () => {
    const { calls, kc } = directory();
    await expect(kc.createPerson({ ...person, roles: ['nope'] })).rejects.toMatchObject({ status: 400, message: 'There is no role called “nope”.' });
    await expect(kc.createPerson({ ...person, departments: ['gone'] })).rejects.toMatchObject({ status: 400 });
    expect(writes(calls)).toEqual([]);
  });

  it('changes nothing about someone when one of the changes is refused', async () => {
    const { calls, kc } = directory();
    await expect(kc.updatePerson('u-1', { enabled: false, roles: ['nope'] })).rejects.toMatchObject({ status: 400 });
    await expect(kc.updatePerson('u-1', { enabled: false, departments: ['gone'] })).rejects.toMatchObject({ status: 400 });
    expect(writes(calls)).toEqual([]);
  });
});

describe('asking everyone to take an action', () => {
  const signIn = { client: { id: 'platform-identity', secret: 's' } };
  const listed = [
    { id: 'u-1', username: 'turned-off-meanwhile', enabled: true },
    { id: 'u-2', username: 'still-on', enabled: true, requiredActions: [] },
    { id: 'u-3', username: 'already-asked', enabled: true, requiredActions: ['TERMS_AND_CONDITIONS'] },
    { id: 'u-4', username: 'off', enabled: false },
  ];

  it('leaves out whether someone is on when renaming them or resetting their password, unless that’s the change', async () => {
    const { calls, fetchImpl } = keycloak((method, path) => {
      if (method !== 'GET') return undefined;
      if (path === '/users/u-1') return { id: 'u-1', username: 'jo', enabled: true };
      if (path.startsWith('/users/u-1/')) return [];
      return undefined;
    });
    const directory = new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, fetchImpl });
    const sent = () => calls.filter((c) => c.method === 'PUT' && c.url.endsWith('/users/u-1')).map((c) => JSON.parse(c.body!));
    await directory.updatePerson('u-1', { firstName: 'Joanne' });
    await directory.resetPassword('u-1', 'one-time');
    await directory.updatePerson('u-1', { enabled: false });
    const [renamed, reset, off] = sent();
    expect(renamed).toMatchObject({ firstName: 'Joanne' });
    expect(renamed).not.toHaveProperty('enabled');
    expect(reset).toMatchObject({ requiredActions: ['UPDATE_PASSWORD'] });
    expect(reset).not.toHaveProperty('enabled');
    expect(off).toMatchObject({ enabled: false });
  });

  it('reads each person again, leaves out whether they’re on, and skips anyone turned off since the list', async () => {
    const { calls, fetchImpl } = keycloak((method, path) => {
      if (method !== 'GET') return undefined;
      if (path.startsWith('/users?')) return listed;
      if (path === '/users/u-1') return { ...listed[0], enabled: false };
      if (path === '/users/u-2') return { ...listed[1], requiredActions: ['UPDATE_PASSWORD'] };
      return undefined;
    });
    const asked = await new KeycloakDirectory({ url: 'http://kc', realm: 'platform', signIn, fetchImpl }).askEveryone('TERMS_AND_CONDITIONS');
    expect(asked).toBe(2);
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts.map((c) => c.url)).toEqual(['http://kc/admin/realms/platform/users/u-2']);
    expect(JSON.parse(puts[0]!.body!)).toEqual({ id: 'u-2', username: 'still-on', requiredActions: ['UPDATE_PASSWORD', 'TERMS_AND_CONDITIONS'] });
  });
});
