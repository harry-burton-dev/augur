// Events pushed to an app's inbound part (contract 3, spec 8.6): in order, retried with backoff, idempotent, and an
// app that has taken nothing for an hour is shown stalled.
import { afterEach, describe, expect, it } from 'vitest';
import { callerHeaders, eventDeliveryKey, IDEMPOTENCY_KEY_HEADER, PART_EVENTS_PATH, type NewAuditEntry, type Scope } from '@augur/service-kit';
import { backoffMs, deliveryStatus, eventDeliverer, GIVE_UP_AFTER_MS, sendThroughGateway, STALLED_AFTER_MS, type SendEvent } from './deliver.ts';
import { GrantsUnavailable } from '@augur/service-kit';
import { DATABASE_URL, eventsDb } from './db.testing.ts';
import type { DomainEvent } from './store.ts';

const db = eventsDb();
const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });

/** A part that remembers what it was sent and answers as told. */
const part = () => {
  const got: { app: string; event: DomainEvent }[] = [];
  let answer: { ok: true } | { ok: false; reason: string } = { ok: true };
  const send: SendEvent = async (app, event) => {
    got.push({ app, event });
    return answer;
  };
  return { got, send, fail: (reason: string) => (answer = { ok: false, reason }), recover: () => (answer = { ok: true }) };
};

let open: Awaited<ReturnType<typeof db.app>> | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

describe('backoff and status', () => {
  it('waits a second, doubling, up to ten minutes', () => {
    expect([1, 2, 3, 11].map(backoffMs)).toEqual([1000, 2000, 4000, 600_000]);
  });

  it('says in words how an app is taking events', () => {
    const t0 = Date.parse('2026-03-01T10:00:00Z');
    const row = { app: 'notes', cursor: '4', failures: 0, nextAt: null, lastError: null, failingSince: null, deliveredAt: null, dropped: 0, droppedAt: null };
    expect(deliveryStatus(row, t0)).toEqual({ state: 'ok', words: 'Nothing to deliver yet.' });
    expect(deliveryStatus({ ...row, deliveredAt: '2026-03-01T09:59:00.000Z' }, t0).state).toBe('ok');
    expect(deliveryStatus({ ...row, deliveredAt: '2026-03-01T09:59:00.000Z', dropped: 1, droppedAt: '2026-03-01T09:00:00.000Z' }, t0).words).toBe('Taking events. 1 event was passed over after a day of failures.');
    const failing = { ...row, failures: 3, lastError: 'notes’s part answered 500', failingSince: '2026-03-01T09:30:00.000Z' };
    expect(deliveryStatus(failing, t0)).toEqual({ state: 'retrying', words: 'Retrying: notes’s part answered 500.' });
    expect(deliveryStatus(failing, t0 + STALLED_AFTER_MS)).toMatchObject({ state: 'stalled', words: expect.stringMatching(/^Not taking events: /) });
  });

  it('sends through the gateway as the events service, with the same key for one event each time', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(calls.length === 1 ? '' : JSON.stringify({ message: 'Not now' }), { status: calls.length === 1 ? 202 : 503 });
    }) as typeof fetch;
    const send = sendThroughGateway({ gatewayUrl: 'http://gateway:8080/', credentials: { name: 'events', getToken: async () => 'tok' }, fetchImpl });
    const event: DomainEvent = { seq: '7', topic: 'folio.document.published', id: 'd1', publisher: 'folio', at: '2026-03-01T10:00:00Z', payload: { document: 'd1' } };
    expect(await send('notes', event)).toEqual({ ok: true });
    expect(await send('notes', event)).toEqual({ ok: false, reason: 'notes’s part answered 503: Not now' });
    expect(calls.map((c) => c.url)).toEqual([`http://gateway:8080/api/notes${PART_EVENTS_PATH}`, `http://gateway:8080/api/notes${PART_EVENTS_PATH}`]);
    const headers = calls.map((c) => c.init.headers as Record<string, string>);
    expect(headers[0]!.authorization).toBe('Bearer tok');
    expect(headers.map((h) => h[IDEMPOTENCY_KEY_HEADER])).toEqual([eventDeliveryKey(event), eventDeliveryKey(event)]);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(event);
  });
});

describe.runIf(DATABASE_URL)('delivering events to parts', () => {
  const subscribers = async () => [{ app: 'notes', name: 'Notes', enabled: true }];
  // Notes holds events:subscribe everywhere but Legal.
  const grants = async (app: string, workspace?: string): Promise<Scope[]> => (app === 'notes' && workspace !== 'w-legal' ? ['events:subscribe'] : []);
  const floor = (id: string) => ({ id, path: ['w-org', id] });
  const audited: NewAuditEntry[] = [];
  const deliverer = (send: SendEvent, now: () => number) => eventDeliverer({ store: db.store, subscribers, grants, send, now, audit: async (e, key) => void audited.push({ ...e, key } as NewAuditEntry) });

  it('pushes each event once, in order, skipping the app’s own and those on floors where it is off', async () => {
    const theirs = part();
    const d = deliverer(theirs.send, Date.now);
    // A new subscriber starts from now: what happened before it subscribed isn't replayed.
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'old', payload: {} }]);
    await d.tick();
    await db.store.publish('folio', [
      { topic: 'folio.document.published', id: 'd1', payload: { document: 'd1' } },
      { topic: 'folio.document.published', id: 'd2', payload: { document: 'd2' }, floor: floor('w-legal') },
    ]);
    await db.store.publish('notes', [{ topic: 'notes.note.made', id: 'n1', payload: {} }]);
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd3', payload: { document: 'd3' }, floor: floor('w-finance') }]);
    const report = await d.tick();
    expect(report).toEqual({ delivered: 2, skipped: 2, failed: [], dropped: 0 });
    expect(theirs.got.map((g) => [g.app, g.event.id])).toEqual([['notes', 'd1'], ['notes', 'd3']]);
    expect(theirs.got[0]!.event).toMatchObject({ topic: 'folio.document.published', publisher: 'folio', payload: { document: 'd1' } });
    // Nothing is sent twice.
    expect(await d.tick()).toEqual({ delivered: 0, skipped: 0, failed: [], dropped: 0 });
    expect(theirs.got).toHaveLength(2);
  });

  it('retries a failing part with backoff, holding the cursor and the order, and goes on once it answers', async () => {
    let clock = Date.parse('2026-03-01T10:00:00Z');
    const now = () => clock;
    const theirs = part();
    const d = deliverer(theirs.send, now);
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }, { topic: 'folio.document.published', id: 'd2', payload: {} }]);
    theirs.fail('notes’s part answered 500');
    expect(await d.tick()).toMatchObject({ delivered: 0, failed: ['notes'] });
    const [row] = await db.store.deliveries.list();
    expect(row).toMatchObject({ app: 'notes', failures: 1, lastError: 'notes’s part answered 500', failingSince: '2026-03-01T10:00:00.000Z', nextAt: '2026-03-01T10:00:01.000Z' });
    // Too soon: nothing is tried.
    expect((await d.tick()).failed).toEqual([]);
    expect(theirs.got).toHaveLength(1);
    clock += 1000;
    expect((await d.tick()).failed).toEqual(['notes']);
    expect((await db.store.deliveries.list())[0]).toMatchObject({ failures: 2, nextAt: '2026-03-01T10:00:03.000Z' });
    // The same event each time, with the same key, and nothing behind it moves.
    expect(theirs.got.map((g) => g.event.id)).toEqual(['d1', 'd1']);
    expect(new Set(theirs.got.map((g) => eventDeliveryKey(g.event))).size).toBe(1);
    theirs.recover();
    clock += 2000;
    expect(await d.tick()).toEqual({ delivered: 2, skipped: 0, failed: [], dropped: 0 });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['d1', 'd1', 'd1', 'd2']);
    expect((await db.store.deliveries.list())[0]).toMatchObject({ failures: 0, failingSince: null, lastError: null, nextAt: null });
  });

  it('passes an event over after a day of failing, records that, and shows the app stalled after an hour', async () => {
    let clock = Date.parse('2026-03-01T10:00:00Z');
    const theirs = part();
    const d = deliverer(theirs.send, () => clock);
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }, { topic: 'folio.document.published', id: 'd2', payload: {} }]);
    theirs.fail('notes’s part couldn’t be reached: connect ECONNREFUSED');
    await d.tick();
    clock += STALLED_AFTER_MS;
    await d.tick();
    const app = (open = await db.app());
    const shown = await app.inject({ method: 'GET', url: '/v1/deliveries', headers: admin });
    expect(shown.statusCode).toBe(200);
    expect(shown.json().deliveries).toEqual([
      expect.objectContaining({ app: 'notes', state: 'stalled', failingSince: '2026-03-01T10:00:00.000Z', words: 'Not taking events: notes’s part couldn’t be reached: connect ECONNREFUSED.' }),
    ]);
    expect(shown.json().pushing).toEqual({ on: true });
    expect((await app.inject({ method: 'GET', url: '/v1/deliveries', headers: editor })).statusCode).toBe(403);
    clock += GIVE_UP_AFTER_MS;
    // d1 is given up on and recorded; d2 fails afresh, starting a new run.
    expect(await d.tick()).toMatchObject({ dropped: 1, failed: ['notes'] });
    expect(audited).toEqual([expect.objectContaining({ action: 'delivery.dropped', target: 'notes', key: expect.stringMatching(/^delivery\.dropped:notes:\d+$/), detail: expect.objectContaining({ topic: 'folio.document.published' }) })]);
    expect((await db.store.deliveries.list())[0]).toMatchObject({ failures: 1, dropped: 1, droppedAt: expect.any(String) });
    theirs.recover();
    clock += 1000;
    expect(await d.tick()).toMatchObject({ delivered: 1 });
    expect(theirs.got.at(-1)!.event.id).toBe('d2');
  });

  it('keeps the place of an app turned off, and forgets one whose grant is gone, recording that', async () => {
    const theirs = part();
    let list = [{ app: 'notes', name: 'Notes', enabled: false }];
    const d = eventDeliverer({ store: db.store, subscribers: async () => list, grants, send: theirs.send, audit: async (e, key) => void audited.push({ ...e, key } as NewAuditEntry) });
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }]);
    // Turned off: nothing is sent, but the cursor waits where it was.
    expect(await d.tick()).toMatchObject({ delivered: 0 });
    expect(theirs.got).toHaveLength(0);
    list = [{ app: 'notes', name: 'Notes', enabled: true }];
    expect(await d.tick()).toMatchObject({ delivered: 1 });
    list = [];
    await d.tick();
    expect(await db.store.deliveries.list()).toEqual([]);
    expect(audited.at(-1)).toMatchObject({ action: 'delivery.forgotten', target: 'notes', key: expect.stringMatching(/^delivery\.forgotten:notes:/) });
  });

  it('waits out a registry that can’t say who subscribes, saying so, instead of failing', async () => {
    const theirs = part();
    let down = true;
    const d = eventDeliverer({
      store: db.store,
      subscribers: async () => {
        if (down) throw new GrantsUnavailable('The registry answered 503.');
        return [{ app: 'notes', name: 'Notes', enabled: true }];
      },
      grants,
      send: theirs.send,
    });
    expect(await d.tick()).toEqual({ delivered: 0, skipped: 0, failed: [], dropped: 0 });
    expect(d.problem).toBe('The registry can’t be asked which apps subscribe (The registry answered 503.).');
    down = false;
    await d.tick();
    expect(d.problem).toBeUndefined();
  });

  it('lets one instance at a time drive an app, and a late failure can’t mark a row another instance moved on', async () => {
    const theirs = part();
    const d = deliverer(theirs.send, Date.now);
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }]);
    // Another instance holds the lease: this pass leaves the app alone.
    expect(await db.store.deliveries.claim('notes', 60)).toBe(true);
    expect(await d.tick()).toMatchObject({ delivered: 0 });
    await db.store.deliveries.release('notes');
    expect(await d.tick()).toMatchObject({ delivered: 1 });
    const [row] = await db.store.deliveries.list();
    // A failure recorded against the event before the move changes nothing now.
    expect(await db.store.deliveries.failed('notes', '0', 'late', new Date(), new Date())).toBe(false);
    expect((await db.store.deliveries.list())[0]).toMatchObject({ cursor: row!.cursor, failures: 0, lastError: null });
  });
});
