import { describe, expect, it } from 'vitest';
import { garageAdmin, keyIdFor } from './garage.ts';

/** A Garage that remembers what it was asked, with one node and whatever buckets and keys it's given. */
const fakeGarage = (state: { roles: unknown[]; buckets: Record<string, string>; keys: { id: string; name: string }[] }) => {
  const calls: string[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const path = url.pathname.replace('/v2/', '') + url.search;
    calls.push(path);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer tok');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status });
    if (path === 'GetClusterLayout') return json(200, { version: state.roles.length ? 1 : 0, roles: state.roles });
    if (path === 'GetClusterStatus') return json(200, { nodes: [{ id: 'node-1' }] });
    if (path === 'UpdateClusterLayout') return json(200, (state.roles = body.roles));
    if (path === 'ApplyClusterLayout') return json(200, {});
    if (path.startsWith('GetBucketInfo')) {
      const id = state.buckets[url.searchParams.get('globalAlias')!];
      return id ? json(200, { id }) : json(404, { code: 'NoSuchBucket', message: 'no' });
    }
    if (path === 'CreateBucket') return json(200, { id: (state.buckets[body.globalAlias] = `b-${body.globalAlias}`) });
    if (path === 'ListKeys') return json(200, state.keys);
    if (path === 'ImportKey') return json(200, state.keys.push({ id: body.accessKeyId, name: body.name }));
    if (path === 'AllowBucketKey') return json(200, {});
    if (path.startsWith('DeleteKey')) return json(200, (state.keys = state.keys.filter((k) => k.id !== url.searchParams.get('id'))));
    return json(500, { message: `unexpected ${path}` });
  }) as typeof fetch;
  return { calls, garage: garageAdmin({ url: 'http://garage:3903/', token: 'tok', fetchImpl }), state };
};

describe('garageAdmin', () => {
  it('gives a new Garage its layout once', async () => {
    const { garage, calls } = fakeGarage({ roles: [], buckets: {}, keys: [] });
    expect(await garage.ensureLayout()).toBe('applied');
    expect(calls).toEqual(['GetClusterLayout', 'GetClusterStatus', 'UpdateClusterLayout', 'ApplyClusterLayout']);
    expect(await garage.ensureLayout()).toBe('already');
  });

  it('makes a missing bucket and finds an existing one', async () => {
    const { garage, calls } = fakeGarage({ roles: [], buckets: { old: 'b-old' }, keys: [] });
    expect(await garage.ensureBucket('folio')).toBe('b-folio');
    expect(await garage.ensureBucket('old')).toBe('b-old');
    expect(calls.filter((c) => c === 'CreateBucket')).toHaveLength(1);
  });

  it('imports the key for a new secret and removes the app’s old one', async () => {
    const secret = '1'.repeat(64);
    const { garage, state, calls } = fakeGarage({ roles: [], buckets: {}, keys: [{ id: 'GKold', name: 'app-folio' }, { id: 'GKother', name: 'app-other' }] });
    const id = await garage.ensureKey('folio', secret, 'b-folio');
    expect(id).toBe(keyIdFor(secret));
    expect(id).toMatch(/^GK[0-9a-f]{24}$/);
    expect(state.keys).toEqual([{ id: 'GKother', name: 'app-other' }, { id, name: 'app-folio' }]);
    calls.length = 0;
    await garage.ensureKey('folio', secret, 'b-folio');
    expect(calls).toEqual(['ListKeys', 'AllowBucketKey']);
  });
});
