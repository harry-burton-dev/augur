import { describe, expect, it } from 'vitest';
import type { CheckKey } from './openfga.ts';
import { isCopied, keepProjecting, project, relationshipsFrom, type IdentityRelationships } from './projection.ts';

const identity: IdentityRelationships = {
  org: 'o',
  teams: [
    { id: 'ops', parent: 'o' },
    { id: 'port', parent: 'ops' },
  ],
  personal: [{ id: 'me-amara', owner: 'amara' }],
  positions: [
    { id: 'ops-head', team: 'ops', role: 'lead', holder: 'amara' },
    { id: 'harbour-master', team: 'port', role: 'member' },
  ],
  people: ['amara', 'tomas'],
  roles: { admin: ['amara'], 'deployment-admin': ['amara'], publisher: ['tomas'] },
};

/** A store as OpenFGA keeps it, for runs to read and write. */
const fakeEngine = (start: CheckKey[] = []) => {
  const held = new Map(start.map((k) => [JSON.stringify(k), k]));
  return {
    held: () => [...held.values()],
    readAll: async () => [...held.values()],
    write: async (_s: string, _m: string, writes: readonly CheckKey[], deletes: readonly CheckKey[]) => {
      for (const k of writes) held.set(JSON.stringify(k), k);
      for (const k of deletes) held.delete(JSON.stringify(k));
    },
  };
};

describe('the copy of identity', () => {
  it('makes floors, where they sit, positions on them and who holds them, and the org’s people', () => {
    expect(relationshipsFrom(identity)).toEqual([
      { user: 'org:o', relation: 'parent', object: 'floor:ops' },
      { user: 'floor:ops', relation: 'child', object: 'org:o' },
      { user: 'floor:ops', relation: 'parent', object: 'floor:port' },
      { user: 'floor:port', relation: 'child', object: 'floor:ops' },
      { user: 'person:amara', relation: 'owner', object: 'floor:me-amara' },
      { user: 'persona:ops-head#holder', relation: 'lead', object: 'floor:ops' },
      { user: 'person:amara', relation: 'holder', object: 'persona:ops-head' },
      // A vacant position is still on its floor, so whoever holds it next stands there at once.
      { user: 'persona:harbour-master#holder', relation: 'member', object: 'floor:port' },
      { user: 'person:amara', relation: 'member', object: 'org:o' },
      { user: 'person:tomas', relation: 'member', object: 'org:o' },
      { user: 'org:o', relation: 'org', object: 'deployment:this' },
      // Today's Keycloak admins: one admin persona each, which only they hold (ADR 0086).
      { user: 'person:amara', relation: 'holder', object: 'persona:admin.amara' },
      { user: 'persona:admin.amara', relation: 'admin', object: 'org:o' },
      { user: 'persona:admin.amara', relation: 'admin', object: 'deployment:this' },
      { user: 'person:tomas', relation: 'publisher', object: 'org:o' },
    ]);
  });

  it('leaves alone what others write: roles, grants, settlers, a role’s place on a floor', () => {
    expect(isCopied({ user: 'role:clerks#assignee', relation: 'member', object: 'floor:port' }, true)).toBe(false);
    expect(isCopied({ user: 'persona:x#holder', relation: 'settler', object: 'floor:port' }, true)).toBe(false);
    expect(isCopied({ user: 'person:p', relation: 'assignee', object: 'role:clerks' }, true)).toBe(false);
    expect(isCopied({ user: 'persona:x', relation: 'admin', object: 'org:o' }, true)).toBe(false);
    expect(isCopied({ user: 'person:p', relation: 'member', object: 'org:o' }, false)).toBe(false);
    expect(isCopied({ user: 'person:p', relation: 'member', object: 'org:o' }, true)).toBe(true);
    expect(isCopied({ user: 'persona:x#holder', relation: 'lead', object: 'floor:port' }, true)).toBe(true);
    // Admins copied from Keycloak's roles are this copy's; an admin persona given some other way isn't.
    expect(isCopied({ user: 'persona:admin.amara', relation: 'admin', object: 'org:o' }, true)).toBe(true);
    expect(isCopied({ user: 'persona:admin.amara', relation: 'admin', object: 'deployment:this' }, true)).toBe(true);
    expect(isCopied({ user: 'persona:it-head', relation: 'admin', object: 'deployment:this' }, true)).toBe(false);
    // Without people, nothing that comes from Keycloak is touched.
    expect(isCopied({ user: 'person:amara', relation: 'holder', object: 'persona:admin.amara' }, false)).toBe(false);
    expect(isCopied({ user: 'persona:admin.amara', relation: 'admin', object: 'org:o' }, false)).toBe(false);
    expect(isCopied({ user: 'person:tomas', relation: 'publisher', object: 'org:o' }, false)).toBe(false);
    expect(isCopied({ user: 'org:o', relation: 'org', object: 'deployment:this' }, false)).toBe(true);
  });

  it('writes only what changed, and puts right what was changed by hand', async () => {
    const engine = fakeEngine([
      { user: 'role:clerks#assignee', relation: 'member', object: 'floor:port' },
      { user: 'person:ghost', relation: 'holder', object: 'persona:ops-head' },
    ]);
    const first = await project({ engine, store: 's', modelId: 'm', relationships: async () => identity, now: () => new Date('2026-11-10T00:00:00Z') });
    expect(first).toEqual({ at: '2026-11-10T00:00:00.000Z', added: 15, removed: 1 });
    expect(engine.held()).toContainEqual({ user: 'role:clerks#assignee', relation: 'member', object: 'floor:port' });
    expect(engine.held()).not.toContainEqual({ user: 'person:ghost', relation: 'holder', object: 'persona:ops-head' });
    expect(await project({ engine, store: 's', modelId: 'm', relationships: async () => identity })).toMatchObject({ added: 0, removed: 0 });

    // A handover: the position stays on its floor; only who holds it changes.
    const handedOver = { ...identity, positions: [{ ...identity.positions[0], holder: 'tomas' }, identity.positions[1]] };
    expect(await project({ engine, store: 's', modelId: 'm', relationships: async () => handedOver })).toMatchObject({ added: 1, removed: 1 });
    expect(engine.held()).toContainEqual({ user: 'person:tomas', relation: 'holder', object: 'persona:ops-head' });
  });

  it('leaves the org’s people alone when identity can’t say who they are', async () => {
    const engine = fakeEngine();
    await project({ engine, store: 's', modelId: 'm', relationships: async () => identity });
    const { people: _, roles: __, ...noPeople } = identity;
    expect(await project({ engine, store: 's', modelId: 'm', relationships: async () => noPeople })).toMatchObject({ removed: 0 });
  });

  it('holds back a run that would take away most of the copy at once', async () => {
    const many = { ...identity, people: Array.from({ length: 40 }, (_, i) => `p${i}`) };
    const engine = fakeEngine();
    await project({ engine, store: 's', modelId: 'm', relationships: async () => many });
    const run = await project({ engine, store: 's', modelId: 'm', relationships: async () => ({ org: 'o', teams: [], personal: [], positions: [], people: [] }) });
    expect(run).toMatchObject({ removed: 0, heldBack: 52 });
    expect(engine.held()).toHaveLength(53);
  });

  it('keeps going after a run fails, and says why', async () => {
    let calls = 0;
    const runs: unknown[] = [];
    const copy = keepProjecting(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error('Identity answered 503 when asked for its relationships.');
        return { at: 'now', added: 0, removed: 0 };
      },
      1,
      (r) => runs.push(r),
    );
    await new Promise((r) => setTimeout(r, 30));
    copy.stop();
    expect(runs[0]).toMatchObject({ error: 'Identity answered 503 when asked for its relationships.' });
    expect(copy.last()).toEqual({ at: 'now', added: 0, removed: 0 });
  });

  it('copies again soon after identity announces changes, once for several close together', async () => {
    let runs = 0;
    let release: () => void = () => {};
    const copy = keepProjecting(
      async () => {
        runs += 1;
        if (runs === 2) await new Promise<void>((r) => (release = r));
        return { at: 'now', added: 0, removed: 0 };
      },
      60_000,
      () => {},
      5,
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(runs).toBe(1);
    copy.request();
    copy.request();
    copy.request();
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toBe(2);
    // A change heard during a run makes one more run after it, never two at once.
    copy.request();
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toBe(2);
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(runs).toBe(3);
    copy.stop();
  });
});
