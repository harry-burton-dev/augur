import { describe, expect, it, vi } from 'vitest';
import { GrantsUnavailable, registryBindingApps, registryGrantedApps, registryGrants, registryInboxKinds, registryNotificationKinds, registryRequiredRole } from './grants.js';

describe('registry grants', () => {
  it('asks once per app and floor while the answer is fresh, as a platform service', async () => {
    let t = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer events-token');
      return Response.json({ scopes: String(url).includes('workspace=w-1') ? ['notifications:send'] : [] });
    });
    const grants = registryGrants({ registryUrl: 'http://registry', credentials: { name: 'events', getToken: async () => 'events-token' }, fetchImpl: fetchImpl as typeof fetch, now: () => t });
    expect(await grants('library', 'w-1')).toEqual(['notifications:send']);
    expect(await grants('library', 'w-1')).toEqual(['notifications:send']);
    expect(await grants('library')).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('http://registry/v1/apps/library/grants?workspace=w-1');
    t = 30_001;
    await grants('library', 'w-1');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('lists the apps granted a scope as the registry answers them (a list, with whether each is on), kept 30 s', async () => {
    let t = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer events-token');
      expect(String(url)).toBe('http://registry/v1/scopes/events%3Asubscribe/apps');
      return Response.json([{ app: 'library', name: 'Library', enabled: true }, { app: 'atlas', name: 'Atlas', enabled: false }]);
    });
    const granted = registryGrantedApps({ registryUrl: 'http://registry', credentials: { name: 'events', getToken: async () => 'events-token' }, fetchImpl: fetchImpl as typeof fetch, now: () => t });
    expect(await granted('events:subscribe')).toEqual([{ app: 'library', name: 'Library', enabled: true }, { app: 'atlas', name: 'Atlas', enabled: false }]);
    await granted('events:subscribe');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = 30_001;
    await granted('events:subscribe');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const wrong = registryGrantedApps({ registryUrl: 'http://registry', credentials: { name: 'events', getToken: async () => 'events-token' }, fetchImpl: (async () => Response.json({ apps: [] })) as typeof fetch });
    await expect(wrong('events:subscribe')).rejects.toBeInstanceOf(GrantsUnavailable);
    const down = registryGrantedApps({ registryUrl: 'http://registry', credentials: { name: 'events', getToken: async () => 'events-token' }, fetchImpl: (async () => new Response(null, { status: 503 })) as typeof fetch });
    await expect(down('events:subscribe')).rejects.toBeInstanceOf(GrantsUnavailable);
  });

  it('grants nothing to an app it doesn’t know, and fails when it can’t say', async () => {
    const unknown = registryGrants({ registryUrl: 'http://registry', credentials: { name: 'events', getToken: async () => 'events-token' }, fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch });
    expect(await unknown('nope')).toEqual([]);
    const down = registryGrants({ registryUrl: 'http://registry', credentials: { name: 'events', getToken: async () => 'events-token' }, fetchImpl: (async () => new Response(null, { status: 502 })) as typeof fetch });
    await expect(down('library')).rejects.toBeInstanceOf(GrantsUnavailable);
  });

  it('names the inbox kinds an app declares; none for an app it doesn’t know; undefined from an older registry', async () => {
    const credentials = { name: 'events', getToken: async () => 'events-token' };
    const answer = (body: object | null, status = 200) => (async () => (body ? Response.json(body, { status }) : new Response(null, { status }))) as typeof fetch;
    expect(await registryInboxKinds({ registryUrl: 'http://registry', credentials, fetchImpl: answer({ scopes: [], inboxKinds: ['review'] }) })('library')).toEqual(['review']);
    expect(await registryInboxKinds({ registryUrl: 'http://registry', credentials, fetchImpl: answer(null, 404) })('nope')).toEqual([]);
    expect(await registryInboxKinds({ registryUrl: 'http://registry', credentials, fetchImpl: answer({ scopes: [] }) })('library')).toBeUndefined();
    await expect(registryInboxKinds({ registryUrl: 'http://registry', credentials, fetchImpl: answer(null, 502) })('library')).rejects.toBeInstanceOf(GrantsUnavailable);
    expect(await registryNotificationKinds({ registryUrl: 'http://registry', credentials, fetchImpl: answer({ scopes: [], inboxKinds: ['review'], notificationKinds: ['comment'] }) })('library')).toEqual(['comment']);
    expect(await registryNotificationKinds({ registryUrl: 'http://registry', credentials, fetchImpl: answer({ scopes: [], inboxKinds: [] }) })('library')).toBeUndefined();
  });

  it('names the role an app needs; none for an app it doesn’t know; undefined from an older registry', async () => {
    const credentials = { name: 'models', getToken: async () => 'models-token' };
    const answer = (body: object | null, status = 200) => (async () => (body ? Response.json(body, { status }) : new Response(null, { status }))) as typeof fetch;
    const role = (fetchImpl: typeof fetch) => registryRequiredRole({ registryUrl: 'http://registry', credentials, fetchImpl })('helper');
    expect(await role(answer({ scopes: [], requiredRole: 'analyst' }))).toBe('analyst');
    expect(await role(answer({ scopes: [], requiredRole: null }))).toBeNull();
    expect(await role(answer(null, 404))).toBeNull();
    expect(await role(answer({ scopes: [], inboxKinds: [] }))).toBeUndefined();
    await expect(role(answer(null, 502))).rejects.toBeInstanceOf(GrantsUnavailable);
  });

  it('lists the apps that bind to entities, asks again only when stale, and keeps the last answer when the registry is down', async () => {
    const credentials = { name: 'atlas', getToken: async () => 'atlas-token' };
    let t = 0;
    let status = 200;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe('http://registry/v1/entity-links');
      return status === 200 ? Response.json([{ app: 'mandate', types: ['intent'] }]) : new Response(null, { status });
    });
    const apps = registryBindingApps({ registryUrl: 'http://registry/', credentials, fetchImpl: fetchImpl as typeof fetch, now: () => t });
    expect(await apps()).toEqual([{ app: 'mandate', types: ['intent'] }]);
    await apps();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t = 300_001;
    status = 502;
    expect(await apps()).toEqual([{ app: 'mandate', types: ['intent'] }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const old = registryBindingApps({ registryUrl: 'http://registry', credentials, fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch });
    expect(await old()).toEqual([]);
    const down = registryBindingApps({ registryUrl: 'http://registry', credentials, fetchImpl: (async () => new Response(null, { status: 503 })) as typeof fetch });
    await expect(down()).rejects.toBeInstanceOf(GrantsUnavailable);
  });
});
