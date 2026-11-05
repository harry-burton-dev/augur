import { describe, expect, it } from 'vitest';
import type { NewAuditEntry } from '@augur/service-kit';
import { DATABASE_URL, identityDb } from './db.testing.ts';
import { MemoryDirectory } from './directory.ts';
import type { Lifecycle } from './lifecycle.ts';
import { causeOf, PgReconcileStore, reconcile } from './reconcile.ts';

const person = (dir: MemoryDirectory, username: string) =>
  dir.createPerson({ username, email: `${username}@example.org`, firstName: username, lastName: 'Test', roles: [], departments: [] });

describe('a change that couldn’t be finished', () => {
  const setUp = async () => {
    const directory = new MemoryDirectory();
    const p = await person(directory, 'turned-off');
    const kept = new Map<string, Lifecycle>();
    const lifecycle = {
      get: async () => kept,
      disabled: async (id: string, _cause: unknown, at: string) => void kept.set(id, { disabledAt: at }),
      enabled: async (id: string) => void kept.delete(id),
    };
    let since: string | undefined;
    const store = { since: async () => since, started: async (at: string) => void (since = at), alone: async (fn: () => Promise<void>) => (await fn(), true) };
    const entries: NewAuditEntry[] = [];
    const fail = { sessions: false, audit: false };
    const endSessions = directory.endSessions.bind(directory);
    directory.endSessions = async (id) => {
      if (fail.sessions) throw new Error('keycloak unreachable');
      await endSessions(id);
    };
    const audit = async (e: NewAuditEntry) => {
      if (fail.audit) throw new Error('events unreachable');
      entries.push(e);
    };
    const run = () => reconcile({ directory, lifecycle, store, audit, now: () => '2026-11-05T06:00:00.000Z' });
    await run();
    return { directory, p, kept, entries, fail, run };
  };

  it.each(['sessions', 'audit'] as const)('is tried again on the next run when %s failed', async (failed) => {
    const { directory, p, kept, entries, fail, run } = await setUp();
    await directory.updatePerson(p.id, { enabled: false });
    fail[failed] = true;
    await expect(run()).rejects.toThrow('unreachable');
    expect(kept.has(p.id)).toBe(false);

    fail[failed] = false;
    expect(await run()).toEqual({ disabled: [p.id], enabled: [], noted: [] });
    expect(directory.signedOut.at(-1)).toBe(p.id);
    expect(entries.map((e) => e.action)).toEqual(['person.disabled']);
    expect(kept.get(p.id)?.disabledAt).toBeDefined();
    expect(await run()).toEqual({ disabled: [], enabled: [], noted: [] });
  });

  it('tries a turn-on again too', async () => {
    const { directory, p, kept, entries, fail, run } = await setUp();
    await directory.updatePerson(p.id, { enabled: false });
    await run();
    await directory.updatePerson(p.id, { enabled: true });
    fail.audit = true;
    await expect(run()).rejects.toThrow('unreachable');
    expect(kept.has(p.id)).toBe(true);
    fail.audit = false;
    expect(await run()).toEqual({ disabled: [], enabled: [p.id], noted: [] });
    expect(entries.map((e) => e.action)).toEqual(['person.disabled', 'person.enabled']);
  });
});

describe.runIf(DATABASE_URL)('noticing sign-ins turned off or on in Keycloak', () => {
  const db = identityDb();
  const setUp = () => {
    const directory = new MemoryDirectory();
    const entries: NewAuditEntry[] = [];
    const run = () => reconcile({ directory, lifecycle: db.lifecycle, store: new PgReconcileStore(db.pool), audit: async (e) => entries.push(e), now: () => '2026-11-05T06:00:00.000Z' });
    return { directory, entries, run };
  };

  it('first takes note of who is already off, quietly', async () => {
    const { directory, entries, run } = setUp();
    const off = await person(directory, 'already-off');
    await person(directory, 'on');
    await directory.updatePerson(off.id, { enabled: false });

    expect(await run()).toEqual({ disabled: [], enabled: [], noted: [off.id] });
    expect(entries).toEqual([]);
    expect(directory.signedOut).toEqual([]);
    expect((await db.lifecycle.get([off.id])).get(off.id)).toMatchObject({ disabledAt: '2026-11-05T06:00:00.000Z' });
    expect(await new PgReconcileStore(db.pool).since()).toBe('2026-11-05T06:00:00.000Z');
  });

  it('then ends the sessions of someone turned off in Keycloak and records it as Keycloak’s doing', async () => {
    const { directory, entries, run } = setUp();
    const p = await person(directory, 'turned-off');
    await run();
    await directory.updatePerson(p.id, { enabled: false });

    expect(await run()).toEqual({ disabled: [p.id], enabled: [], noted: [] });
    expect(directory.signedOut).toEqual([p.id]);
    expect(entries).toEqual([
      { actor: { id: 'keycloak', kind: 'service' }, app: 'identity', action: 'person.disabled', target: p.id, detail: { username: 'turned-off', outside: true } },
    ]);
    const kept = (await db.lifecycle.get([p.id])).get(p.id);
    expect(kept?.disabledAt).toBeDefined();
    expect(kept?.disabledCause).toBeUndefined();

    // Nothing changed since: nothing more to say.
    expect(await run()).toEqual({ disabled: [], enabled: [], noted: [] });
    expect(entries).toHaveLength(1);
  });

  it('puts a turn-off down to being idle when their last sign-in is as old as the turn-off days', async () => {
    const directory = new MemoryDirectory();
    const entries: NewAuditEntry[] = [];
    const store = new PgReconcileStore(db.pool);
    const run = () =>
      reconcile({ directory, lifecycle: db.lifecycle, store, audit: async (e) => entries.push(e), idle: async () => ({ on: true, turnOffDays: 90 }), now: () => '2026-11-05T06:00:00.000Z' });
    const p = await person(directory, 'away');
    await db.lifecycle.signedIn(p.id, '2026-08-01T00:00:00.000Z');
    await run();
    await directory.updatePerson(p.id, { enabled: false });
    await run();
    expect(entries[0].detail).toEqual({ username: 'away', outside: true, cause: 'idle', days: 90 });
    expect((await db.lifecycle.get([p.id])).get(p.id)?.disabledCause).toBe('idle');
  });

  it('only calls it idle when idle accounts are on and the last sign-in is old enough', () => {
    const at = '2026-11-05T00:00:00.000Z';
    expect(causeOf('2026-08-07T00:00:00.000Z', at, { on: true, turnOffDays: 90 })).toBe('idle');
    expect(causeOf('2026-10-01T00:00:00.000Z', at, { on: true, turnOffDays: 90 })).toBeUndefined();
    expect(causeOf('2026-01-01T00:00:00.000Z', at, { on: false, turnOffDays: 90 })).toBeUndefined();
    expect(causeOf(undefined, at, { on: true, turnOffDays: 90 })).toBeUndefined();
  });

  it('hears someone turned back on in Keycloak', async () => {
    const { directory, entries, run } = setUp();
    const p = await person(directory, 'back-on');
    await db.lifecycle.disabled(p.id, 'admin', '2026-11-01T00:00:00.000Z');
    await directory.updatePerson(p.id, { enabled: false });
    await run();
    await directory.updatePerson(p.id, { enabled: true });

    expect(await run()).toEqual({ disabled: [], enabled: [p.id], noted: [] });
    expect(entries.map((e) => e.action)).toEqual(['person.enabled']);
    expect((await db.lifecycle.get([p.id])).get(p.id)?.disabledAt).toBeUndefined();
  });

  it('leaves a leaver alone, and agrees with an admin’s change made in AUGUR', async () => {
    const { directory, entries, run } = setUp();
    const leaver = await person(directory, 'leaver');
    const admins = await person(directory, 'by-admin');
    await run();
    await db.lifecycle.left(leaver.id, { at: '2026-11-04T00:00:00.000Z', by: 'u-admin' });
    await directory.updatePerson(admins.id, { enabled: false });
    await db.lifecycle.disabled(admins.id, 'admin', '2026-11-05T05:00:00.000Z');

    expect(await run()).toEqual({ disabled: [], enabled: [], noted: [] });
    expect(entries).toEqual([]);
    expect((await db.lifecycle.get([admins.id])).get(admins.id)?.disabledCause).toBe('admin');
  });

  it('runs one comparison at a time', async () => {
    const { directory } = setUp();
    const store = new PgReconcileStore(db.pool);
    let inner: unknown = 'not run';
    const outer = await store.alone(async () => {
      inner = await reconcile({ directory, lifecycle: db.lifecycle, store });
    });
    expect(outer).toBe(true);
    expect(inner).toBeUndefined();
  });
});
