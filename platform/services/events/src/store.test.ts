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
      await admin.query('truncate events.notifications, events.audit');
    },
  );

  it('tells listeners on another instance', async () => {
    const heard: Notification[] = [];
    const stop = other.subscribe((n) => heard.push(n));
    await store.addNotifications({ ...review, recipients: ['u-9'] });
    await expect.poll(() => heard.map((n) => n.recipient)).toEqual(['u-9']);
    stop();
  });
});
