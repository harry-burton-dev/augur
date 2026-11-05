import { describe, expect, it } from 'vitest';
import type { NewAuditEntry } from '@augur/service-kit';
import { MemoryDirectory } from './directory.ts';
import { DATABASE_URL, identityDb } from './db.testing.ts';
import { addDays, leaveDueLeavers, todayIn } from './leavers.ts';
import { idleOf, lockedOf } from './lifecycle.ts';

describe('dates for a last day', () => {
  it('reads today where the organisation is, and counts days on', () => {
    const at = new Date('2026-11-05T23:30:00Z');
    expect(todayIn('UTC', at)).toBe('2026-11-05');
    expect(todayIn('Asia/Tokyo', at)).toBe('2026-11-06');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('idle and locked', () => {
  const policy = { on: true, warningDays: 60, turnOffDays: 90, canEmail: true };
  it('counts from the last sign-in, and leaves out deployment admins', () => {
    const l = { lastSignInAt: '2026-01-01T00:00:00.000Z' };
    expect(idleOf({ roles: [] }, l, policy, new Date('2026-03-15T00:00:00Z'))).toEqual({ warnsAt: '2026-03-02T00:00:00.000Z', turnsOffAt: '2026-04-01T00:00:00.000Z', warned: true });
    expect(idleOf({ roles: ['deployment-admin'] }, l, policy)).toEqual({ exempt: 'deployment-admin' });
    expect(idleOf({ roles: [] }, l, { ...policy, on: false })).toEqual({ exempt: 'off' });
    expect(idleOf({ roles: [] }, {}, policy)).toEqual({ exempt: 'not-tracked' });
  });
  it('takes a lockout as over after a sign-in or the longest wait', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(lockedOf({ lockedAt: '2026-11-05T11:55:00Z' }, now)).toBe(true);
    expect(lockedOf({ lockedAt: '2026-11-05T11:55:00Z', lastSignInAt: '2026-11-05T11:58:00Z' }, now)).toBe(false);
    expect(lockedOf({ lockedAt: '2026-11-05T11:00:00Z' }, now)).toBe(false);
  });
});

describe.runIf(DATABASE_URL)('leaver flows set for after a last day', () => {
  const db = identityDb();

  it('runs once the last day is over, as the admin who set it, and only once', async () => {
    const directory = new MemoryDirectory();
    const kim = await directory.createPerson({ username: 'kim', firstName: 'Kim', lastName: 'Lee', email: 'kim@example.org', roles: [], departments: [] });
    const sam = await directory.createPerson({ username: 'sam', firstName: 'Sam', lastName: 'Ode', email: 'sam@example.org', roles: [], departments: [] });
    await db.lifecycle.scheduleLeave(kim.id, { on: '2026-11-05', by: 'admin-1', handOverTo: sam.id, note: 'Agreed' });
    await db.lifecycle.scheduleLeave(sam.id, { on: '2026-11-06', by: 'admin-1' });
    const entries: NewAuditEntry[] = [];
    const deps = { directory, lifecycle: db.lifecycle, store: db.store, audit: async (e: NewAuditEntry) => void entries.push(e) };

    expect(await leaveDueLeavers(deps, 'UTC', new Date('2026-11-05T23:00:00Z'))).toEqual([]);
    expect(await leaveDueLeavers(deps, 'UTC', new Date('2026-11-06T00:10:00Z'))).toEqual([kim.id]);
    expect(await leaveDueLeavers(deps, 'UTC', new Date('2026-11-06T00:15:00Z'))).toEqual([]);

    expect((await directory.person(kim.id)).enabled).toBe(false);
    expect(directory.signedOut).toEqual([kim.id]);
    expect(entries.map((e) => [e.action, e.actor.id])).toEqual([
      ['person.disabled', 'admin-1'],
      ['person.left', 'admin-1'],
    ]);
    expect(entries[1]!.detail).toMatchObject({ handOverTo: sam.id, note: 'Agreed', lastDay: '2026-11-05' });
    const kept = (await db.lifecycle.get([kim.id])).get(kim.id)!;
    expect(kept.left).toMatchObject({ by: 'admin-1', handOverTo: sam.id });
    expect(kept.leaving).toBeUndefined();
    expect((await db.lifecycle.get([sam.id])).get(sam.id)!.leaving).toEqual({ on: '2026-11-06', by: 'admin-1' });
  });
});
