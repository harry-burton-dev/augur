import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryEventStore, PgEventStore, type EventStore, type Notification } from './store.ts';

const review = { app: 'library', recipients: ['u-1', 'u-2'], level: 'needs' as const, title: 'Review the budget paper', link: '/doc/7' };

/** The same behaviour from every store. */
const behavesLikeAStore = (make: () => EventStore, reset: () => Promise<void> = async () => {}) => {
  let store: EventStore;
  beforeEach(async () => {
    await reset();
    store = make();
  });

  it('keeps one notification per recipient, newest first', async () => {
    await store.addNotifications(review);
    await store.addNotifications({ ...review, recipients: ['u-2'], title: 'Second' });
    expect((await store.unread('u-2', 50)).map((n) => n.title)).toEqual(['Second', 'Review the budget paper']);
    expect(await store.unread('u-1', 50)).toMatchObject([{ recipient: 'u-1', link: '/doc/7' }]);
  });

  it('keeps the floor and its path, and finds audit entries under a floor', async () => {
    const [n] = await store.addNotifications({ ...review, recipients: ['u-1'] }, { id: 'p', path: ['o', 'f', 'p'] });
    expect(n.workspace).toEqual({ id: 'p', path: ['o', 'f', 'p'] });
    expect((await store.unread('u-1', 50))[0].workspace).toEqual({ id: 'p', path: ['o', 'f', 'p'] });
    const entry = (action: string) => ({ actor: { id: 'u-1', kind: 'user' as const }, app: 'library', action });
    await store.appendAudit(entry('a.payroll'), { id: 'p', path: ['o', 'f', 'p'] });
    await store.appendAudit(entry('a.legal'), { id: 'l', path: ['o', 'l'] });
    await store.appendAudit(entry('a.nowhere'));
    expect((await store.audit({ workspace: 'f', limit: 10 })).map((e) => e.action)).toEqual(['a.payroll']);
    expect((await store.audit({ workspace: 'o', limit: 10 })).map((e) => e.action)).toEqual(['a.legal', 'a.payroll']);
    expect((await store.audit({ limit: 10 })).map((e) => e.action)).toEqual(['a.nowhere', 'a.legal', 'a.payroll']);
  });

  it('keeps which teams turned team notices on', async () => {
    expect(await store.teamNotices('f')).toBe(false);
    await store.setTeamNotices('f', true, 'u-1');
    await store.setTeamNotices('f', true, 'u-1');
    expect(await store.teamNotices('f')).toBe(true);
    await store.setTeamNotices('f', false, 'u-1');
    expect(await store.teamNotices('f')).toBe(false);
  });

  it('keeps a notification’s actions', async () => {
    const actions = [{ label: 'Approve', intent: { type: 'claim.approve', payload: { id: 'c-1' } } }, { label: 'Open', intent: { type: 'claim.open' } }];
    await store.addNotifications({ ...review, recipients: ['u-1'], actions });
    await store.addNotifications({ ...review, recipients: ['u-1'], title: 'No actions' });
    const [plain, acting] = await store.unread('u-1', 10);
    expect(acting.actions).toEqual(actions);
    expect(plain.actions).toBeUndefined();
  });

  it('marks read and unread, only for the recipient', async () => {
    const [forAlex] = await store.addNotifications({ ...review, recipients: ['u-1'] });
    expect(await store.setRead('u-2', forAlex.id, true)).toBe(false);
    expect(await store.setRead('u-1', forAlex.id, true)).toBe(true);
    expect(await store.unread('u-1', 50)).toEqual([]);
    expect(await store.setRead('u-1', forAlex.id, false)).toBe(true);
    expect(await store.unread('u-1', 50)).toHaveLength(1);
    expect(await store.setRead('u-1', 'no-such-id', true)).toBe(false);
  });

  it('tells listeners about new notifications', async () => {
    const heard: Notification[] = [];
    const stop = store.subscribe((n) => heard.push(n));
    await store.addNotifications(review);
    await expect.poll(() => heard.length).toBe(2);
    stop();
    await store.addNotifications(review);
    await new Promise((r) => setTimeout(r, 50));
    expect(heard).toHaveLength(2);
  });

  it('appends to the audit log and filters it, newest first', async () => {
    await store.appendAudit({ actor: { id: 'library', kind: 'service' }, app: 'registry', action: 'app.registered', target: 'library' });
    await store.appendAudit({ actor: { id: 'u-2', kind: 'user' }, app: 'library', action: 'document.published', detail: { title: 'Budget' } });
    expect((await store.audit({ limit: 10 })).map((e) => e.action)).toEqual(['document.published', 'app.registered']);
    expect(await store.audit({ app: 'library', limit: 10 })).toMatchObject([{ actor: { id: 'u-2', kind: 'user' }, detail: { title: 'Budget' } }]);
    expect(await store.audit({ actor: 'library', limit: 10 })).toMatchObject([{ action: 'app.registered' }]);
  });

  it('pages through the audit log from the oldest entry shown, and keeps to a date range', async () => {
    for (const n of [1, 2, 3, 4, 5]) await store.appendAudit({ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.updated', target: `u-${n}` });
    const first = await store.audit({ limit: 2 });
    expect(first.map((e) => e.target)).toEqual(['u-5', 'u-4']);
    const second = await store.audit({ limit: 2, before: first.at(-1)!.id });
    expect(second.map((e) => e.target)).toEqual(['u-3', 'u-2']);
    expect((await store.audit({ limit: 10, before: second.at(-1)!.id })).map((e) => e.target)).toEqual(['u-1']);
    expect(await store.audit({ limit: 10, before: '999999' })).toEqual([]);
    expect(await store.audit({ limit: 10, since: '2999-01-01T00:00:00.000Z' })).toEqual([]);
    expect(await store.audit({ limit: 10, until: '2000-01-01T00:00:00.000Z' })).toEqual([]);
    expect(await store.audit({ limit: 10, since: '2000-01-01T00:00:00.000Z', until: '2999-01-01T00:00:00.000Z' })).toHaveLength(5);
  });

  it('keeps domain events once per publisher id, and hands them out in order by topic', async () => {
    const finance = { id: 'w-finance', path: ['w-org', 'w-finance'] };
    expect(await store.publish('folio', [
      { topic: 'folio.document.published', id: 'e1', payload: { document: 'd1' }, floor: finance },
      { topic: 'folio.document.withdrawn', id: 'e2', payload: { document: 'd1' } },
    ])).toEqual({ added: 2, repeated: 0 });
    expect(await store.publish('folio', [{ topic: 'folio.document.published', id: 'e1', payload: {} }])).toEqual({ added: 0, repeated: 1 });
    await store.publish('notes', [{ topic: 'notes.note.added', id: 'e1', payload: null }]);
    // In Postgres an event shows once every transaction older than it has finished, which other tests' may not have yet.
    await expect.poll(async () => (await store.readEvents({ topics: ['folio.*', 'notes.note.added'], limit: 10 })).length).toBe(3);
    const all = await store.readEvents({ topics: ['folio.*', 'notes.note.added'], limit: 10 });
    expect(all.map((e) => [e.publisher, e.id])).toEqual([['folio', 'e1'], ['folio', 'e2'], ['notes', 'e1']]);
    expect(all[0]).toMatchObject({ topic: 'folio.document.published', payload: { document: 'd1' }, workspace: finance, at: expect.any(String) });
    expect((await store.readEvents({ topics: ['folio.document.published'], limit: 10 })).map((e) => e.id)).toEqual(['e1']);
    expect((await store.readEvents({ topics: ['folio.*'], after: all[0].seq, limit: 10 })).map((e) => e.id)).toEqual(['e2']);
    expect(await store.readEvents({ topics: ['folio.*'], after: all[2].seq, limit: 10 })).toEqual([]);
    expect(await store.pruneEvents(30)).toBe(0);
    expect(await store.pruneEvents(-1)).toBe(3);
  });
};

describe('MemoryEventStore', () => behavesLikeAStore(() => new MemoryEventStore()));

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('PgEventStore', () => {
  let store: PgEventStore;
  let other: PgEventStore;
  let admin: pg.Pool;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query('drop schema if exists events cascade');
    store = await PgEventStore.connect(process.env.DATABASE_URL!);
    other = await PgEventStore.connect(process.env.DATABASE_URL!);
  });
  afterAll(async () => {
    await store.close();
    await other.close();
    await admin.end();
  });

  behavesLikeAStore(
    () => store,
    async () => {
      await admin.query('truncate events.notifications, events.audit, events.team_notices, events.domain_events');
    },
  );

  it('tells another instance about a notification too big to send whole', async () => {
    const heard: Notification[] = [];
    const stop = other.subscribe((n) => heard.push(n));
    await store.addNotifications({ ...review, recipients: ['u-8'], detail: 'é'.repeat(2000), actions: [{ label: 'Open', intent: { type: 'document.open', payload: { id: 'x'.repeat(900) } } }] });
    await expect.poll(() => heard.map((n) => [n.recipient, n.detail?.length, n.actions?.[0].label])).toEqual([['u-8', 2000, 'Open']]);
    stop();
  });

  it('tells listeners on another instance', async () => {
    const heard: Notification[] = [];
    const stop = other.subscribe((n) => heard.push(n));
    await store.addNotifications({ ...review, recipients: ['u-9'] });
    await expect.poll(() => heard.map((n) => n.recipient)).toEqual(['u-9']);
    stop();
  });

  it('never hands out an event while an earlier one could still commit below it', async () => {
    const slow = await admin.connect();
    try {
      // A publisher's transaction takes a seq and stays open, as a slow outbox relay's might.
      await slow.query('begin');
      await slow.query(`insert into events.domain_events (topic, id, publisher, payload) values ('folio.document.published', 'slow', 'folio', '{}')`);
      await store.publish('folio', [{ topic: 'folio.document.published', id: 'fast', payload: {} }]);
      expect(await store.readEvents({ topics: ['folio.*'], limit: 10 })).toEqual([]);
      await slow.query('commit');
      await expect.poll(async () => (await store.readEvents({ topics: ['folio.*'], limit: 10 })).map((e) => e.id)).toEqual(['slow', 'fast']);
    } finally {
      slow.release();
    }
  });
});
