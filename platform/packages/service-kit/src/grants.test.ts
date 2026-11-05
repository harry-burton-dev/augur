import { describe, expect, it, vi } from 'vitest';
import { GrantsUnavailable, registryGrants, registryInboxKinds } from './grants.js';

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
  });
});
