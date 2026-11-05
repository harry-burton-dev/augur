import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { InboxSignal } from './inbox.ts';
import { MemoryEventStore, PgEventStore, type AuditFilter, type DomainEvent, type EventStore, type Notification } from './store.ts';

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

  it('adds a keyed notification once per person and app, read or not', async () => {
    const news = { ...review, key: 'available:augur:0.15.0' };
    expect(await store.addNotifications({ ...news, recipients: ['u-1'] })).toHaveLength(1);
    const [first] = await store.unread('u-1', 50);
    expect(first.key).toBe('available:augur:0.15.0');
    await store.setRead('u-1', first.id, true);
    expect((await store.addNotifications(news)).map((n) => n.recipient)).toEqual(['u-2']);
    // Another app may use the same key; no key means no limit.
    expect(await store.addNotifications({ ...news, app: 'other' })).toHaveLength(2);
    expect(await store.addNotifications(review)).toHaveLength(2);
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

  it('finds entries by target, by person and by kind', async () => {
    await store.appendAudit({ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.disabled', target: 'u-2' });
    await store.appendAudit({ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'team.member-added', target: 't-1', detail: { person: 'u-2' } });
    await store.appendAudit({ actor: { id: 'u-2', kind: 'user' }, app: 'identity', action: 'sign-in.succeeded', detail: { kind: 'sign-in', ip: '10.0.0.2' } });
    await store.appendAudit({ actor: { id: 'u-3', kind: 'user' }, app: 'library', action: 'document.published', target: 'doc-1' });
    const actions = async (f: Omit<AuditFilter, 'limit'>) => (await store.audit({ ...f, limit: 10 })).map((e) => e.action);
    expect(await actions({ target: 't-1' })).toEqual(['team.member-added']);
    expect(await actions({ person: 'u-2' })).toEqual(['sign-in.succeeded', 'team.member-added', 'person.disabled']);
    expect(await actions({ kind: 'sign-in' })).toEqual(['sign-in.succeeded']);
    expect(await actions({ kind: 'change', person: 'u-2' })).toEqual(['team.member-added', 'person.disabled']);
  });

  it('removes a deleted person’s personal values, keeping their id, and their notifications', async () => {
    await store.appendAudit({ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.updated', target: 'u-2', detail: { email: { from: 'a@x.org', to: 'b@x.org' }, roles: ['editor'], nested: { name: 'Sam' } } });
    await store.appendAudit({ actor: { id: 'u-3', kind: 'user' }, app: 'identity', action: 'person.updated', target: 'u-3', detail: { email: 'kim@x.org' } });
    await store.addNotifications({ ...review, recipients: ['u-2', 'u-3'] });
    expect(await store.redactPerson('u-2')).toEqual({ entries: 1, notifications: 1 });
    const [kim, sam] = await store.audit({ limit: 10 });
    expect(sam).toMatchObject({ target: 'u-2', detail: { email: { from: '[removed]', to: '[removed]' }, roles: ['editor'], nested: { name: '[removed]' } } });
    expect(kim!.detail).toEqual({ email: 'kim@x.org' });
    expect(await store.unread('u-2', 10)).toEqual([]);
    expect(await store.unread('u-3', 10)).toHaveLength(1);
    // Again: nothing more to remove.
    expect(await store.redactPerson('u-2')).toEqual({ entries: 0, notifications: 0 });
  });

  it('keeps which service wrote each audit entry', async () => {
    await store.appendAudit({ actor: { id: 'u-2', kind: 'user' }, app: 'library', action: 'document.deleted' }, undefined, 'library');
    await store.appendAudit({ actor: { id: 'u-2', kind: 'user' }, app: 'library', action: 'document.moved' });
    const [unknown, recorded] = await store.audit({ limit: 10 });
    expect(recorded.recordedBy).toBe('library');
    expect(unknown).not.toHaveProperty('recordedBy');
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

  it('tells listeners of each event it adds, and not of one sent again', async () => {
    const heard: DomainEvent[] = [];
    const stop = store.onEvent((e) => heard.push(e));
    await store.publish('folio', [{ topic: 'folio.document.published', id: 'h1', payload: { document: 'd1' } }]);
    await store.publish('folio', [{ topic: 'folio.document.published', id: 'h1', payload: { document: 'd1' } }]);
    await expect.poll(() => heard.map((e) => [e.id, e.publisher])).toEqual([['h1', 'folio']]);
    stop();
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

const assignment = { kind: 'assignment', owner: { kind: 'person' as const, id: 'u-1' }, title: 'Plan the move', subject: { kind: 'ref', app: 'mandate', id: 'i-1' } };
const forTeam = { ...assignment, owner: { kind: 'team' as const, id: 't-1' }, title: 'Someone on Finance: review it' };
const place = { id: 't-1', path: ['o', 't-1'] };

/** The same Inbox from every store. */
const behavesLikeAnInbox = (make: () => EventStore, reset: () => Promise<void> = async () => {}) => {
  let store: EventStore;
  beforeEach(async () => {
    await reset();
    store = make();
  });

  it('keeps one item per app and key, changed in place, and reopens a closed one only when asked', async () => {
    const first = await store.inbox.put('mandate', 'k1', assignment, place);
    expect(first).toMatchObject({ created: true, item: { state: 'open', title: 'Plan the move', allow: { decline: true, handOn: true, selfComplete: false }, workspace: place } });
    const again = await store.inbox.put('mandate', 'k1', { ...assignment, title: 'Plan the office move' });
    expect(again).toMatchObject({ created: false, item: { title: 'Plan the office move' } });
    if (!('item' in again) || !('item' in first)) throw new Error('expected items');
    expect(again.item.id).toBe(first.item.id);
    // Another app may use the same key.
    expect(await store.inbox.put('folio', 'k1', assignment)).toMatchObject({ created: true });
    expect(await store.inbox.patch('mandate', 'k1', { state: 'withdrawn', note: 'Superseded' })).toMatchObject({ item: { state: 'withdrawn', closeNote: 'Superseded' } });
    expect(await store.inbox.put('mandate', 'k1', assignment)).toMatchObject({ closed: { state: 'withdrawn' } });
    expect(await store.inbox.patch('mandate', 'k1', { title: 'Late' })).toMatchObject({ closed: { state: 'withdrawn' } });
    expect(await store.inbox.patch('mandate', 'nope', {})).toEqual({ missing: true });
    expect(await store.inbox.put('mandate', 'k1', { ...assignment, reopen: true })).toMatchObject({ created: false, item: { state: 'open' } });
    expect((await store.inbox.history(first.item.id)).map((h) => h.action)).toEqual(['created', 'updated', 'withdrawn', 'reopened']);
  });

  it('lets one member take a team item; a second taker hears who has it', async () => {
    const put = await store.inbox.put('mandate', 'team', forTeam, place);
    if (!('item' in put)) throw new Error('expected an item');
    const [a, b] = await Promise.all([store.inbox.act(put.item.id, { action: 'taken', by: 'u-2' }), store.inbox.act(put.item.id, { action: 'taken', by: 'u-3' })]);
    const won = [a, b].filter((r) => 'item' in r);
    const lost = [a, b].filter((r) => 'takenBy' in r);
    expect([won.length, lost.length]).toEqual([1, 1]);
    const taker = 'item' in won[0] ? won[0].item.takenBy : undefined;
    expect(lost[0]).toEqual({ takenBy: taker });
    // Taken: in the taker's For you, out of the team's list.
    expect((await store.inbox.list({ person: taker!, teams: ['t-1'], tab: 'you', limit: 10 })).map((i) => i.key)).toEqual(['team']);
    expect(await store.inbox.list({ person: 'u-4', teams: ['t-1'], tab: 'teams', limit: 10 })).toEqual([]);
    expect(await store.inbox.act(put.item.id, { action: 'released', by: taker! })).toMatchObject({ item: { owner: { kind: 'team', id: 't-1' } } });
    expect((await store.inbox.list({ person: 'u-4', teams: ['t-1'], tab: 'teams', limit: 10 })).map((i) => i.key)).toEqual(['team']);
  });

  it('hands on, declines and lists each tab, newest first, with counts', async () => {
    const a = await store.inbox.put('mandate', 'a', assignment);
    await store.inbox.put('mandate', 'b', { ...assignment, due: '2000-01-01T00:00:00.000Z' });
    await store.inbox.put('mandate', 'c', forTeam);
    await store.inbox.put('mandate', 'd', { ...forTeam, owner: { kind: 'team', id: 't-1', role: 'lead' } });
    await store.inbox.put('mandate', 'e', { ...forTeam, owner: { kind: 'team', id: 't-2' } });
    if (!('item' in a)) throw new Error('expected an item');
    expect((await store.inbox.list({ person: 'u-1', teams: [], tab: 'you', limit: 10 })).map((i) => i.key)).toEqual(['b', 'a']);
    expect((await store.inbox.list({ person: 'u-1', teams: [], tab: 'you', before: 'nonsense', limit: 10 })).map((i) => i.key)).toEqual([]);
    const page = await store.inbox.list({ person: 'u-1', teams: [], tab: 'you', limit: 1 });
    expect((await store.inbox.list({ person: 'u-1', teams: [], tab: 'you', before: page[0].id, limit: 10 })).map((i) => i.key)).toEqual(['a']);
    expect((await store.inbox.list({ person: 'u-1', teams: ['t-1'], tab: 'teams', limit: 10 })).map((i) => i.key)).toEqual(['d', 'c']);
    expect(await store.inbox.counts('u-1', ['t-1'], [])).toEqual({ you: 2, teams: 1, overdue: 1 });
    expect(await store.inbox.counts('u-1', ['t-1'], ['t-1'])).toEqual({ you: 2, teams: 2, overdue: 1 });

    const handed = await store.inbox.act(a.item.id, { action: 'handed-on', by: 'u-1', to: { kind: 'person', id: 'u-5' }, note: 'Yours now' });
    expect(handed).toMatchObject({ item: { state: 'open', owner: { kind: 'person', id: 'u-5' } } });
    expect((await store.inbox.list({ person: 'u-5', teams: [], tab: 'you', limit: 10 })).map((i) => i.key)).toEqual(['a']);
    expect(await store.inbox.act(a.item.id, { action: 'declined', by: 'u-5', note: 'Not mine either' })).toMatchObject({ item: { state: 'declined', closedBy: 'u-5', closeNote: 'Not mine either' } });
    expect(await store.inbox.act(a.item.id, { action: 'done', by: 'u-5' })).toMatchObject({ closed: { state: 'declined' } });
    // Done shows it to whoever closed it and to whoever acted on it on the way.
    expect((await store.inbox.list({ person: 'u-5', teams: [], tab: 'done', limit: 10 })).map((i) => i.key)).toEqual(['a']);
    expect((await store.inbox.list({ person: 'u-1', teams: [], tab: 'done', limit: 10 })).map((i) => i.key)).toEqual(['a']);
    expect(await store.inbox.list({ person: 'u-9', teams: [], tab: 'done', limit: 10 })).toEqual([]);
    expect((await store.inbox.history(a.item.id)).map((h) => [h.action, h.by, h.from, h.to, h.note])).toEqual([
      ['created', undefined, undefined, 'person:u-1', undefined],
      ['handed-on', 'u-1', 'person:u-1', 'person:u-5', 'Yours now'],
      ['declined', 'u-5', undefined, undefined, 'Not mine either'],
    ]);
  });

  it('tells listeners who may hear of each change, before and after it', async () => {
    const heard: InboxSignal[] = [];
    const stop = store.inbox.onChange((s) => heard.push(s));
    const put = await store.inbox.put('mandate', 'sig', forTeam);
    if (!('item' in put)) throw new Error('expected an item');
    await store.inbox.act(put.item.id, { action: 'taken', by: 'u-2' });
    await store.inbox.act(put.item.id, { action: 'handed-on', by: 'u-2', to: { kind: 'person', id: 'u-3' } });
    await expect.poll(() => heard.map((s) => [s.change, [...s.principals].sort()])).toEqual([
      ['added', ['team:t-1']],
      ['changed', ['person:u-2', 'team:t-1']],
      ['changed', ['person:u-2', 'person:u-3', 'team:t-1']],
    ]);
    stop();
  });

  it('forgets items closed longer ago than it keeps them, with their history', async () => {
    const put = await store.inbox.put('mandate', 'old', assignment);
    await store.inbox.put('mandate', 'live', assignment);
    if (!('item' in put)) throw new Error('expected an item');
    await store.inbox.act(put.item.id, { action: 'done', by: 'u-1' });
    expect(await store.inbox.prune(90)).toBe(0);
    expect(await store.inbox.prune(-1)).toBe(1);
    expect(await store.inbox.get(put.item.id)).toBeUndefined();
    expect(await store.inbox.byKey('mandate', 'live')).toMatchObject({ state: 'open' });
  });
};

describe('MemoryEventStore', () => behavesLikeAStore(() => new MemoryEventStore()));
describe('MemoryEventStore inbox', () => behavesLikeAnInbox(() => new MemoryEventStore()));

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
      await admin.query('truncate events.notifications, events.audit, events.team_notices, events.domain_events, events.inbox_items, events.inbox_history');
    },
  );

  describe('inbox', () =>
    behavesLikeAnInbox(
      () => store,
      async () => {
        await admin.query('truncate events.inbox_items, events.inbox_history');
      },
    ));

  it('removes Activity entries older than the retention period', async () => {
    await admin.query('truncate events.audit');
    const old = await store.appendAudit({ actor: { id: 'u-1', kind: 'user' }, app: 'library', action: 'document.published' });
    await store.appendAudit({ actor: { id: 'u-1', kind: 'user' }, app: 'library', action: 'document.updated' });
    await admin.query("update events.audit set at = now() - interval '10 days' where id = $1", [old.id]);
    expect(await store.pruneAudit(7)).toBe(1);
    expect((await store.audit({ limit: 10 })).map((e) => e.action)).toEqual(['document.updated']);
  });

  it('tells another instance of each inbox change', async () => {
    const heard: InboxSignal[] = [];
    const stop = other.inbox.onChange((s) => heard.push(s));
    await store.inbox.put('mandate', 'across', assignment);
    await expect.poll(() => heard.map((s) => s.change)).toEqual(['added']);
    stop();
  });

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

  it('listens again when Postgres drops its connection, so open streams don’t go quiet', async () => {
    // As a Postgres restart would: end every connection that's listening.
    await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where query like 'listen %' and pid <> pg_backend_pid()`);
    const heard: Notification[] = [];
    const stop = other.subscribe((n) => heard.push(n));
    await expect
      .poll(
        async () => {
          await store.addNotifications({ ...review, recipients: ['u-10'] });
          return heard.length > 0;
        },
        { timeout: 10_000, interval: 500 },
      )
      .toBe(true);
    stop();
  });

  it('tells another instance of each event published, even one too big to send whole', async () => {
    const heard: DomainEvent[] = [];
    const stop = other.onEvent((e) => heard.push(e));
    await store.publish('folio', [{ topic: 'folio.document.published', id: 'live', payload: { document: 'd1' }, floor: { id: 'w1', path: ['w0', 'w1'] } }]);
    await store.publish('folio', [{ topic: 'folio.document.published', id: 'live', payload: { document: 'd1' } }]);
    await store.publish('folio', [{ topic: 'folio.document.published', id: 'big', payload: { note: 'é'.repeat(5000) } }]);
    await expect.poll(() => heard.map((e) => e.id)).toEqual(['live', 'big']);
    expect(heard[0]).toMatchObject({ topic: 'folio.document.published', publisher: 'folio', workspace: { id: 'w1', path: ['w0', 'w1'] }, payload: { document: 'd1' } });
    expect(heard[0].at).toMatch(/Z$/);
    expect((heard[1].payload as { note: string }).note).toHaveLength(5000);
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
