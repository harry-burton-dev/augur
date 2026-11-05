import { describe, expect, it } from 'vitest';
import type { NewAuditEntry } from '@augur/service-kit';
import { MemoryDirectory } from './directory.ts';
import { DATABASE_URL, identityDb } from './db.testing.ts';
import { DELETED_NAME, deleteDueLeavers } from './deletion.ts';

describe.runIf(DATABASE_URL)('deleting leavers after the retention period (ADR 0072)', () => {
  const db = identityDb();

  const setup = async () => {
    const directory = new MemoryDirectory();
    const kim = await directory.createPerson({ username: 'kim', firstName: 'Kim', lastName: 'Lee', email: 'kim@example.org', roles: [], departments: [] });
    const sam = await directory.createPerson({ username: 'sam', firstName: 'Sam', lastName: 'Ode', email: 'sam@example.org', roles: [], departments: [] });
    await db.workspaces.personal(kim.id, 'Kim Lee');
    await db.store.put(kim.id, { pinned: ['x'] } as never);
    await db.lifecycle.signedIn(kim.id, '2026-06-01T00:00:00.000Z');
    await db.lifecycle.left(kim.id, { at: '2026-07-01T00:00:00.000Z', by: 'admin-1', handOverTo: sam.id });
    await db.lifecycle.left(sam.id, { at: '2026-11-01T00:00:00.000Z', by: 'admin-1' });
    const order: string[] = [];
    const entries: NewAuditEntry[] = [];
    let redactWorks = true;
    const deps = {
      directory: { deletePerson: async (id: string) => void order.push(`keycloak ${id}`) },
      lifecycle: db.lifecycle,
      store: db.store,
      workspaces: db.workspaces,
      redact: async (id: string) => {
        if (!redactWorks) throw new Error('events unreachable');
        order.push(`redact ${id}`);
      },
      audit: async (e: NewAuditEntry) => {
        order.push(`audit ${e.action}`);
        entries.push(e);
      },
    };
    return { kim, sam, deps, order, entries, failRedact: (v: boolean) => (redactWorks = !v) };
  };

  it('deletes only leavers past the period, in order, keeping only the id and dates', async () => {
    const { kim, deps, order, entries } = await setup();
    expect(await deleteDueLeavers(deps, 90, new Date('2026-11-05T00:00:00Z'))).toEqual([kim.id]);
    expect(order).toEqual([`redact ${kim.id}`, `keycloak ${kim.id}`, 'audit person.deleted']);
    expect(entries[0]).toMatchObject({ actor: { id: 'identity', kind: 'service' }, target: kim.id, detail: {} });
    const kept = (await db.lifecycle.get([kim.id])).get(kim.id)!;
    expect(kept).toEqual({ left: { at: '2026-07-01T00:00:00.000Z', by: '' }, deletedAt: expect.any(String) });
    expect(await db.store.get(kim.id)).toEqual({});
    expect((await db.workspaces.personal(kim.id, 'x')).name).toBe(DELETED_NAME);
    // Once deleted, never again.
    expect(await deleteDueLeavers(deps, 90, new Date('2026-11-05T00:00:00Z'))).toEqual([]);
  });

  it('deletes nothing in Keycloak while Activity can’t be cleaned, and resumes later', async () => {
    const { kim, deps, order, failRedact } = await setup();
    failRedact(true);
    const warnings: string[] = [];
    expect(await deleteDueLeavers(deps, 90, new Date('2026-11-05T00:00:00Z'), (m) => warnings.push(m))).toEqual([]);
    expect(order).toEqual([]);
    expect(warnings[0]).toContain('events unreachable');
    failRedact(false);
    expect(await deleteDueLeavers(deps, 90, new Date('2026-11-05T00:00:00Z'))).toEqual([kim.id]);
    expect(order).toEqual([`redact ${kim.id}`, `keycloak ${kim.id}`, 'audit person.deleted']);
  });
});
