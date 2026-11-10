import { describe, expect, it } from 'vitest';
import { garageAdmin, keyIdFor } from './garage.ts';

/** A Garage that remembers what it was asked, with one node and whatever buckets and keys it's given. */
const fakeGarage = (state: { roles: unknown[]; buckets: Record<string, string>; keys: { id: string; name: string }[]; deleted?: string[] }) => {
  const calls: string[] = [];
  const deleted = (state.deleted ??= []);
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
    // As Garage does: a deleted key's id is never taken again.
    if (path === 'ImportKey') {
      if (deleted.includes(body.accessKeyId)) return json(409, { code: 'KeyAlreadyExists', message: `Key ${body.accessKeyId} already exists in data store. Even if it is deleted, we can't let you create a new key with the same ID. Sorry.` });
      return json(200, state.keys.push({ id: body.accessKeyId, name: body.name }));
    }
    if (path === 'AllowBucketKey') return json(200, {});
    if (path.startsWith('UpdateBucket')) return json(200, { id: url.searchParams.get('id'), websiteAccess: body.websiteAccess.enabled });
    if (path.startsWith('DeleteBucket')) {
      const alias = Object.keys(state.buckets).find((k) => state.buckets[k] === url.searchParams.get('id'));
      if (alias) delete state.buckets[alias];
      return json(200, {});
    }
    if (path.startsWith('DeleteKey')) {
      deleted.push(url.searchParams.get('id')!);
      return json(200, (state.keys = state.keys.filter((k) => k.id !== url.searchParams.get('id'))));
    }
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

  it('names the platform’s own key as asked', async () => {
    const { garage, state } = fakeGarage({ roles: [], buckets: {}, keys: [] });
    const id = await garage.ensureKey('platform-frontends', '2'.repeat(64), 'b-augur-frontends', 'platform-frontends');
    expect(state.keys).toEqual([{ id, name: 'platform-frontends' }]);
  });

  it('takes a preview’s bucket away once it’s empty, and leaves every key alone', async () => {
    const { garage, state, calls } = fakeGarage({ roles: [], buckets: { 'notes-pr12': 'b-1', notes: 'b-2' }, keys: [{ id: 'GK1', name: 'app-notes-pr12' }, { id: 'GK2', name: 'app-notes' }] });
    const emptied: string[] = [];
    expect(await garage.removeBucket('notes-pr12', async () => void emptied.push(calls.at(-1)!))).toBe(true);
    // Emptied after it was found, before it was deleted.
    expect(emptied).toEqual(['GetBucketInfo?globalAlias=notes-pr12']);
    expect(state.buckets).toEqual({ notes: 'b-2' });
    expect(state.keys).toEqual([{ id: 'GK1', name: 'app-notes-pr12' }, { id: 'GK2', name: 'app-notes' }]);
    expect(await garage.removeBucket('notes-pr12', async () => void emptied.push('again'))).toBe(false);
    expect(emptied).toHaveLength(1);
  });

  it('gives a bucket a key of its own for a while, which deleteKey takes away for good', async () => {
    const { garage, state } = fakeGarage({ roles: [], buckets: { notes: 'b-notes' }, keys: [] });
    let key = { id: '', secret: '' };
    expect(await garage.removeBucket('notes', async (id) => void (key = await garage.temporaryKey(id, 'app-notes-retire')))).toBe(true);
    expect(key.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(key.id).toBe(keyIdFor(key.secret));
    expect(state.keys).toEqual([{ id: key.id, name: 'app-notes-retire' }]);
    await garage.deleteKey(key.id);
    expect(state.keys).toEqual([]);
    expect(state.buckets).toEqual({});
  });

  it('sets an app’s storage up again with the same secret after its bucket was taken away', async () => {
    // Going back to the release before, or installing the app again: the key's id comes from the secret, and Garage
    // never takes a deleted id back, so the key has to have been kept.
    const secret = 'c'.repeat(64);
    const { garage, state } = fakeGarage({ roles: [], buckets: {}, keys: [] });
    await garage.ensureKey('notes', secret, await garage.ensureBucket('notes'));
    await garage.removeBucket('notes', async () => {});
    expect(state.buckets).toEqual({});
    await expect(garage.ensureKey('notes', secret, await garage.ensureBucket('notes'))).resolves.toBe(keyIdFor(secret));
    expect(state.keys).toEqual([{ id: keyIdFor(secret), name: 'app-notes' }]);
  });

  it('says in words when a deleted key’s secret is used again', async () => {
    // A server that ran a release which deleted the key (0.24.0's retire) and goes back, or an admin putting an old secret back.
    const secret = 'd'.repeat(64);
    const { garage } = fakeGarage({ roles: [], buckets: { notes: 'b-notes' }, keys: [], deleted: [keyIdFor(secret)] });
    await expect(garage.ensureKey('notes', secret, 'b-notes')).rejects.toMatchObject({
      code: 'KeyAlreadyExists',
      message: `key ${keyIdFor(secret)} was deleted from the object store before, and a deleted key's id can't be used again: a new secret makes a new key.`,
    });
  });

  it('serves a bucket on the web endpoint', async () => {
    const { garage, calls } = fakeGarage({ roles: [], buckets: {}, keys: [] });
    await garage.ensureWebsite('b-augur-frontends');
    expect(calls).toEqual(['UpdateBucket?id=b-augur-frontends']);
  });
});
