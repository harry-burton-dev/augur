import { describe, expect, it } from 'vitest';
import { leaveNoticeKey, type NewAuditEntry, type NewNotification } from '@augur/service-kit';
import { DirectoryError, MemoryDirectory } from './directory.ts';
import { DATABASE_URL, identityDb } from './db.testing.ts';
import { addDays, leaveDueLeavers, todayIn } from './leavers.ts';
import { federatedFirstSignIn, idleOf, lockedOf, withLifecycle, type DisabledCause, type Leaving, type Lifecycle } from './lifecycle.ts';

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

describe('a leaver flow whose audit entry fails', () => {
  const setUp = async () => {
    const directory = new MemoryDirectory();
    const kim = await directory.createPerson({ username: 'kim', firstName: 'Kim', lastName: 'Lee', email: 'kim@example.org', roles: [], departments: [] });
    const sam = await directory.createPerson({ username: 'sam', firstName: 'Sam', lastName: 'Ode', email: 'sam@example.org', roles: [], departments: [] });
    const kept = new Map<string, Lifecycle>();
    const leaving: Leaving = { on: '2026-11-05', by: 'admin-1', handOverTo: sam.id };
    const lifecycle = {
      get: async () => kept,
      disabled: async (person: string, cause: DisabledCause | undefined, at: string) => void kept.set(person, { ...kept.get(person), disabledAt: at, disabledCause: cause }),
      left: async (person: string, left: NonNullable<Lifecycle['left']>) => void kept.set(person, { ...kept.get(person), left }),
      dueLeavers: async () => (kept.get(kim.id)?.left ? [] : [{ person: kim.id, ...leaving }]),
    };
    const entries: NewAuditEntry[] = [];
    let failing: string | undefined;
    const audit = async (e: NewAuditEntry) => {
      if (e.action === failing) throw new Error('events unreachable');
      entries.push(e);
    };
    const told: NewNotification[] = [];
    const tell = async (n: NewNotification) => void told.push(n);
    const run = (warn?: (m: string) => void) => leaveDueLeavers({ directory, lifecycle, audit, tell }, 'UTC', new Date('2026-11-06T00:10:00Z'), warn);
    return { kim, sam, kept, entries, told, run, directory, failOn: (action?: string) => (failing = action) };
  };

  it('tries `person.left` again, keeping who the work goes to', async () => {
    const { kim, sam, kept, entries, run, failOn } = await setUp();
    failOn('person.left');
    const warnings: string[] = [];
    expect(await run((m) => warnings.push(m))).toEqual([]);
    expect(warnings[0]).toContain('events unreachable');
    expect(kept.get(kim.id)?.left).toBeUndefined();

    failOn(undefined);
    expect(await run()).toEqual([kim.id]);
    expect(entries.map((e) => e.action)).toEqual(['person.disabled', 'person.left']);
    expect(entries[1]!.detail).toMatchObject({ handOverTo: sam.id, lastDay: '2026-11-05' });
    expect(entries[1]!.key).toBe(`leaver:person.left:${kim.id}`);
    expect(await run()).toEqual([]);
  });

  it('hands to nobody, and tells admins, when the person named can’t sign in any more', async () => {
    const { kim, sam, kept, entries, told, run, directory } = await setUp();
    await directory.updatePerson(sam.id, { enabled: false });
    expect(await run()).toEqual([kim.id]);
    expect(entries.find((e) => e.action === 'person.left')!.detail).toMatchObject({ handOverLost: sam.id });
    expect(entries.find((e) => e.action === 'person.left')!.detail).not.toHaveProperty('handOverTo');
    expect(kept.get(kim.id)?.left).not.toHaveProperty('handOverTo');
    expect(told).toEqual([expect.objectContaining({ app: 'admin', audience: ['role:admin'], level: 'needs', key: leaveNoticeKey(kim.id, 'nobody-to-hand-over-to') })]);
  });

  it('does the same when they’re gone from the directory, and goes again when admins can’t be told', async () => {
    const { kim, kept, directory } = await setUp();
    const gone: Leaving = { on: '2026-11-05', by: 'admin-1', handOverTo: 'nobody' };
    const lifecycle = {
      get: async () => kept,
      disabled: async () => undefined,
      left: async (person: string, left: NonNullable<Lifecycle['left']>) => void kept.set(person, { left }),
      dueLeavers: async () => [{ person: kim.id, ...gone }],
    };
    let reachable = false;
    const tell = async () => {
      if (!reachable) throw new Error('events unreachable');
    };
    const run = () => leaveDueLeavers({ directory, lifecycle, tell }, 'UTC', new Date('2026-11-06T00:10:00Z'));
    expect(await run()).toEqual([]);
    expect(kept.get(kim.id)?.left).toBeUndefined();
    reachable = true;
    expect(await run()).toEqual([kim.id]);
    expect(kept.get(kim.id)?.left).not.toHaveProperty('handOverTo');
  });

  it('names no last day for a flow that stopped part way, and turning off again is a new entry', async () => {
    const { kim, entries, directory } = await setUp();
    const lifecycle = {
      get: async () => new Map<string, Lifecycle>(),
      disabled: async () => undefined,
      left: async () => undefined,
      dueLeavers: async () => [{ person: kim.id, on: '2026-11-05', by: 'admin-1', stopped: true }],
    };
    const audit = async (e: NewAuditEntry) => void entries.push(e);
    await leaveDueLeavers({ directory, lifecycle, audit }, 'UTC', new Date('2026-11-06T00:10:00Z'));
    expect(entries.find((e) => e.action === 'person.left')!.detail).not.toHaveProperty('lastDay');
    expect(entries.find((e) => e.action === 'person.disabled')).not.toHaveProperty('key');
  });

  it('waits and tries again when it can’t tell whether the person named can take it on', async () => {
    const { kim, kept, entries, run, directory } = await setUp();
    const person = directory.person.bind(directory);
    directory.person = async (id: string) => {
      if (id !== kim.id) throw new DirectoryError('The sign-in service can’t be reached.', 503);
      return person(id);
    };
    expect(await run()).toEqual([]);
    expect(entries).toEqual([]);
    expect(kept.get(kim.id)).toBeUndefined();
  });

  it('still says `person.disabled` on the next try, though their sign-in is already off', async () => {
    const { kim, kept, entries, run, directory, failOn } = await setUp();
    failOn('person.disabled');
    expect(await run()).toEqual([]);
    expect((await directory.person(kim.id)).enabled).toBe(false);

    failOn(undefined);
    expect(await run()).toEqual([kim.id]);
    expect(entries.map((e) => e.action)).toEqual(['person.disabled', 'person.left']);
    expect(kept.get(kim.id)?.disabledCause).toBe('leaver');
  });

  it('doesn’t say `person.disabled` for someone already kept as off', async () => {
    const { kim, kept, entries, run, directory } = await setUp();
    await directory.updatePerson(kim.id, { enabled: false });
    kept.set(kim.id, { disabledAt: '2026-11-01T00:00:00.000Z', disabledCause: 'admin' });
    expect(await run()).toEqual([kim.id]);
    expect(entries.map((e) => e.action)).toEqual(['person.left']);
  });
});

describe('a first sign-in whose entry can’t be made yet', () => {
  const setUp = async () => {
    const directory = new MemoryDirectory();
    const made = await directory.createPerson({ username: 'new', firstName: 'New', lastName: 'Person', email: 'new@example.org', roles: [], departments: [] });
    const kept = new Map<string, Lifecycle>();
    const lifecycle = {
      get: async () => kept,
      federated: async (person: string, at: string) => (kept.set(person, { federatedAt: at }), true),
    };
    return { directory, made, kept, lifecycle };
  };

  it('records the account as added when the sign-in is tried again', async () => {
    const { directory, made, kept, lifecycle } = await setUp();
    const entries: NewAuditEntry[] = [];
    let works = false;
    const deps = { lifecycle, directory, audit: async (e: NewAuditEntry) => {
      if (!works) throw new Error('events unreachable');
      entries.push(e);
    } };
    const now = new Date().toISOString();
    await expect(federatedFirstSignIn(deps, made.id, now)).rejects.toThrow('events unreachable');
    expect(kept.has(made.id)).toBe(false);
    works = true;
    await federatedFirstSignIn(deps, made.id, now);
    await federatedFirstSignIn(deps, made.id, now);
    expect(entries.map((e) => e.action)).toEqual(['person.added']);
  });

  it('gets past an account deleted since, so the sign-ins after it are still copied', async () => {
    const { directory, kept, lifecycle } = await setUp();
    await federatedFirstSignIn({ lifecycle, directory }, 'gone', new Date().toISOString());
    expect(kept.has('gone')).toBe(true);
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

describe.runIf(DATABASE_URL)('a first sign-in through the organisation’s sign-in', () => {
  const db = identityDb();

  it('marks them as signing in with it, and records an account it made as added, once', async () => {
    const directory = new MemoryDirectory();
    const made = await directory.createPerson({ username: 'new', firstName: 'New', lastName: 'Person', email: 'new@example.org', roles: [], departments: [] });
    const linked = await directory.createPerson({ username: 'old', firstName: 'Old', lastName: 'Hand', email: 'old@example.org', roles: [], departments: [] });
    await db.lifecycle.invited(linked.id, 'temporary-password');
    const entries: NewAuditEntry[] = [];
    const deps = { lifecycle: db.lifecycle, directory, audit: async (e: NewAuditEntry) => void entries.push(e) };
    const now = new Date().toISOString();
    await federatedFirstSignIn(deps, made.id, now);
    await federatedFirstSignIn(deps, made.id, now);
    await federatedFirstSignIn(deps, linked.id, now);
    expect(entries.map((e) => [e.action, e.target, e.detail?.method])).toEqual([['person.added', made.id, 'federated']]);
    const kept = await db.lifecycle.get([made.id, linked.id]);
    expect(withLifecycle(made, kept.get(made.id)).source).toBe('federated');
    expect(withLifecycle(linked, kept.get(linked.id)).source).toBe('federated');
  });
});
