import { describe, expect, it } from 'vitest';
import type { NewAuditEntry } from '@augur/service-kit';
import { DATABASE_URL, identityDb } from './db.testing.ts';
import { MemoryDirectory } from './directory.ts';
import { PgReconcileStore, reconcile } from './reconcile.ts';

const person = (dir: MemoryDirectory, username: string) =>
  dir.createPerson({ username, email: `${username}@example.org`, firstName: username, lastName: 'Test', roles: [], departments: [] });

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
