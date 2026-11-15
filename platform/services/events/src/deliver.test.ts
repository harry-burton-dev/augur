// Events pushed to an app's inbound part (contract 3, spec 8.6): in order, retried with backoff, idempotent, and an
// app that has taken nothing for an hour is shown stalled.
import { afterEach, describe, expect, it } from 'vitest';
import { callerHeaders, eventDeliveryKey, IDEMPOTENCY_KEY_HEADER, PART_EVENTS_PATH, type NewAuditEntry, type Scope } from '@augur/service-kit';
import { backoffMs, deliveryStatus, eventDeliverer, GIVE_UP_AFTER_MS, sendThroughGateway, STALLED_AFTER_MS, type SendEvent, type SendResult } from './deliver.ts';
import { GrantsUnavailable } from '@augur/service-kit';
import { DATABASE_URL, eventsDb } from './db.testing.ts';
import type { DomainEvent } from './store.ts';

const db = eventsDb();
const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });

/** A part that remembers what it was sent and answers as told. */
const part = () => {
  const got: { app: string; event: DomainEvent }[] = [];
  let answer: SendResult = { ok: true };
  /** Which events the answer is for; every one when unset. */
  let only: ((event: DomainEvent) => boolean) | undefined;
  const send: SendEvent = async (app, event) => {
    got.push({ app, event });
    return !only || only(event) ? answer : { ok: true };
  };
  return {
    got,
    send,
    /** The part can't take these events (every one without `which`): it answered `status`. */
    fail: (reason: string, which?: (event: DomainEvent) => boolean, status = 422) => ((answer = { ok: false, reason, status }), (only = which)),
    /** The part is down: it couldn't be reached, or said it is unavailable. */
    down: (reason: string) => ((answer = { ok: false, reason, down: true }), (only = undefined)),
    recover: () => ((answer = { ok: true }), (only = undefined)),
  };
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
    const row = { app: 'notes', cursor: '4', failures: 0, nextAt: null, lastError: null, failingSince: null, deliveredAt: null, dropped: 0, droppedAt: null, retrying: 0, setAside: 0 };
    expect(deliveryStatus(row, t0)).toEqual({ state: 'ok', words: 'Nothing to deliver yet.' });
    expect(deliveryStatus({ ...row, deliveredAt: '2026-03-01T09:59:00.000Z' }, t0).state).toBe('ok');
    expect(deliveryStatus({ ...row, deliveredAt: '2026-03-01T09:59:00.000Z', dropped: 1, droppedAt: '2026-03-01T09:00:00.000Z' }, t0).words).toBe('Taking events. 1 event was passed over after a day of failures.');
    expect(deliveryStatus({ ...row, deliveredAt: '2026-03-01T09:59:00.000Z', retrying: 1, setAside: 2 }, t0)).toEqual({ state: 'retrying', words: 'Taking events. 1 event is being tried again. 2 events were set aside: the part couldn’t take them.' });
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
    expect(await send('notes', event)).toEqual({ ok: false, reason: 'notes’s part answered 503: Not now', down: true });
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
    expect(report).toEqual({ delivered: 2, skipped: 2, failed: [], setAside: 0, behind: [] });
    expect(theirs.got.map((g) => [g.app, g.event.id])).toEqual([['notes', 'd1'], ['notes', 'd3']]);
    expect(theirs.got[0]!.event).toMatchObject({ topic: 'folio.document.published', publisher: 'folio', payload: { document: 'd1' } });
    // Nothing is sent twice.
    expect(await d.tick()).toEqual({ delivered: 0, skipped: 0, failed: [], setAside: 0, behind: [] });
    expect(theirs.got).toHaveLength(2);
  });

  it('holds every event for a part that is down, retrying with backoff, and goes on in order once it answers', async () => {
    let clock = Date.parse('2026-03-01T10:00:00Z');
    const now = () => clock;
    const theirs = part();
    const d = deliverer(theirs.send, now);
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }, { topic: 'folio.document.published', id: 'd2', payload: {} }]);
    theirs.down('notes’s part answered 503');
    expect(await d.tick()).toMatchObject({ delivered: 0, failed: ['notes'] });
    const [row] = await db.store.deliveries.list();
    expect(row).toMatchObject({ app: 'notes', failures: 1, lastError: 'notes’s part answered 503', failingSince: '2026-03-01T10:00:00.000Z', nextAt: '2026-03-01T10:00:01.000Z' });
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
    expect(await d.tick()).toEqual({ delivered: 2, skipped: 0, failed: [], setAside: 0, behind: [] });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['d1', 'd1', 'd1', 'd2']);
    expect((await db.store.deliveries.list())[0]).toMatchObject({ failures: 0, failingSince: null, lastError: null, nextAt: null });
  });

  it('sets an event aside after a day of its part being down, records that, and shows the app stalled after an hour', async () => {
    let clock = Date.parse('2026-03-01T10:00:00Z');
    const theirs = part();
    const d = deliverer(theirs.send, () => clock);
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }, { topic: 'folio.document.published', id: 'd2', payload: {} }]);
    theirs.down('notes’s part couldn’t be reached: connect ECONNREFUSED');
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
    // d1 is set aside, kept and recorded; d2 fails afresh, starting a new run.
    expect(await d.tick()).toMatchObject({ setAside: 1, failed: ['notes'] });
    expect(audited).toEqual([expect.objectContaining({ action: 'delivery.set-aside', target: 'notes', key: expect.stringMatching(/^delivery\.set-aside:notes:\d+$/), detail: expect.objectContaining({ topic: 'folio.document.published', id: 'd1' }) })]);
    expect((await db.store.deliveries.list())[0]).toMatchObject({ failures: 1, setAside: 1 });
    expect((await db.store.deliveries.setAside()).map((h) => [h.id, h.lastError])).toEqual([['d1', 'notes’s part couldn’t be reached: connect ECONNREFUSED']]);
    theirs.recover();
    clock += 1000;
    expect(await d.tick()).toMatchObject({ delivered: 1 });
    expect(theirs.got.at(-1)!.event.id).toBe('d2');
  });

  it('doesn’t hold events on other topics behind one its part can’t take (PER-462)', async () => {
    const clock = Date.parse('2026-03-01T10:00:00Z');
    const theirs = part();
    const d = deliverer(theirs.send, () => clock);
    await d.tick();
    await db.store.publish('folio', [
      { topic: 'folio.document.published', id: 'a1', payload: {} },
      { topic: 'folio.document.withdrawn', id: 'b1', payload: {} },
    ]);
    theirs.fail('notes’s part answered 500', (e) => e.topic === 'folio.document.published', 500);
    expect(await d.tick()).toMatchObject({ delivered: 1, failed: ['notes'], setAside: 0 });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['a1', 'b1']);
    // The app's own line is healthy: only a1 waits, to be tried again.
    expect((await db.store.deliveries.list())[0]).toMatchObject({ failures: 0, failingSince: null, retrying: 1, setAside: 0 });
    await db.store.publish('folio', [{ topic: 'folio.document.withdrawn', id: 'b2', payload: {} }]);
    expect(await d.tick()).toMatchObject({ delivered: 1 });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['a1', 'b1', 'b2']);
  });

  it('tries an event a few times, keeping its topic’s order meanwhile, then sets it aside, lists it, and lets its topic go on (PER-462)', async () => {
    let clock = Date.parse('2026-03-01T10:00:00Z');
    const theirs = part();
    const d = eventDeliverer({ store: db.store, subscribers, grants, send: theirs.send, now: () => clock, attempts: 3, retryMs: 1000, audit: async (e, key) => void audited.push({ ...e, key } as NewAuditEntry) });
    await d.tick();
    await db.store.publish('folio', [
      { topic: 'folio.document.published', id: 'a1', payload: {} },
      { topic: 'folio.document.published', id: 'a2', payload: {} },
    ]);
    theirs.fail('notes’s part answered 422: no such folder', (e) => e.id === 'a1');
    // a2 waits behind a1 while a1 is being tried again.
    expect(await d.tick()).toMatchObject({ delivered: 0, failed: ['notes'] });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['a1']);
    // Too soon for the second try.
    expect(await d.tick()).toMatchObject({ delivered: 0, failed: [] });
    clock += 1000;
    expect(await d.tick()).toMatchObject({ delivered: 0, failed: ['notes'] });
    clock += 2000;
    // The third try is the last: a1 is set aside and a2 goes, in the same pass.
    expect(await d.tick()).toMatchObject({ delivered: 1, setAside: 1 });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['a1', 'a1', 'a1', 'a2']);
    const [kept] = await db.store.deliveries.setAside();
    expect(kept).toMatchObject({ app: 'notes', id: 'a1', topic: 'folio.document.published', attempts: 3, lastError: 'notes’s part answered 422: no such folder', firstFailedAt: '2026-03-01T10:00:00.000Z', setAsideAt: expect.any(String) });
    expect(audited.at(-1)).toMatchObject({ action: 'delivery.set-aside', target: 'notes', key: `delivery.set-aside:notes:${kept!.seq}`, detail: expect.objectContaining({ id: 'a1', attempts: 3 }) });
    // Later events on its topic flow.
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'a3', payload: {} }]);
    expect(await d.tick()).toMatchObject({ delivered: 1 });
    expect(theirs.got.at(-1)!.event.id).toBe('a3');
    // An admin sees what was set aside.
    const app = (open = await db.app());
    const listed = await app.inject({ method: 'GET', url: '/v1/deliveries/set-aside?app=notes', headers: admin });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().events).toEqual([expect.objectContaining({ app: 'notes', id: 'a1', seq: kept!.seq, attempts: 3, lastError: 'notes’s part answered 422: no such folder' })]);
    expect((await app.inject({ method: 'GET', url: '/v1/deliveries/set-aside', headers: editor })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/v1/deliveries', headers: admin })).json().deliveries[0]).toMatchObject({ setAside: 1, retrying: 0 });
  });

  it('delivers an event that gets through on a later try, then the ones that waited behind it, in order (PER-462)', async () => {
    let clock = Date.parse('2026-03-01T10:00:00Z');
    const theirs = part();
    const d = deliverer(theirs.send, () => clock);
    await d.tick();
    await db.store.publish('folio', [
      { topic: 'folio.document.published', id: 'a1', payload: {} },
      { topic: 'folio.document.published', id: 'a2', payload: {} },
    ]);
    theirs.fail('notes’s part answered 500', (e) => e.id === 'a1', 500);
    await d.tick();
    theirs.recover();
    clock += 60_000;
    expect(await d.tick()).toMatchObject({ delivered: 2, setAside: 0 });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['a1', 'a1', 'a2']);
    expect((await db.store.deliveries.list())[0]).toMatchObject({ retrying: 0, setAside: 0 });
  });

  it('takes a part that fails a second event with a server error as down, holding everything and setting nothing aside (PER-462)', async () => {
    let clock = Date.parse('2026-03-01T10:00:00Z');
    const theirs = part();
    const d = eventDeliverer({ store: db.store, subscribers, grants, send: theirs.send, now: () => clock, attempts: 2, retryMs: 1000 });
    await d.tick();
    await db.store.publish('folio', [
      { topic: 'folio.document.published', id: 'a1', payload: {} },
      { topic: 'folio.document.withdrawn', id: 'b1', payload: {} },
      { topic: 'folio.document.archived', id: 'c1', payload: {} },
    ]);
    theirs.fail('notes’s part answered 500', undefined, 500);
    expect(await d.tick()).toMatchObject({ delivered: 0, failed: ['notes'] });
    // a1 was held before the part was known to be broken; b1 stopped the line, and c1 was never tried.
    expect(theirs.got.map((g) => g.event.id)).toEqual(['a1', 'b1']);
    for (let i = 0; i < 6; i++) {
      clock += 600_000;
      await d.tick();
    }
    expect(await db.store.deliveries.setAside()).toEqual([]);
    expect((await db.store.deliveries.list())[0]).toMatchObject({ failingSince: '2026-03-01T10:00:00.000Z', retrying: 1 });
    theirs.recover();
    clock += 600_000;
    expect(await d.tick()).toMatchObject({ delivered: 3, setAside: 0 });
    expect(theirs.got.slice(-3).map((g) => g.event.id).sort()).toEqual(['a1', 'b1', 'c1']);
  });

  it('after a day of its part being down sets aside only the event in front, and the next gets a day of its own (PER-462)', async () => {
    let clock = Date.parse('2026-03-01T10:00:00Z');
    const theirs = part();
    const d = eventDeliverer({ store: db.store, subscribers, grants, send: theirs.send, now: () => clock, attempts: 5, retryMs: 1000 });
    await d.tick();
    await db.store.publish('folio', [
      { topic: 'folio.document.published', id: 'a1', payload: {} },
      { topic: 'folio.document.withdrawn', id: 'b1', payload: {} },
    ]);
    theirs.fail('notes’s part answered 422', (e) => e.id === 'a1' || e.id === 'b1');
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.archived', id: 'e1', payload: {} }]);
    theirs.down('notes’s part couldn’t be reached: connect ECONNREFUSED');
    clock += 1000;
    await d.tick();
    clock += GIVE_UP_AFTER_MS + 3_600_000;
    expect(await d.tick()).toMatchObject({ setAside: 1, delivered: 0 });
    expect((await db.store.deliveries.setAside()).map((h) => h.id)).toEqual(['a1']);
    // b1 still has tries left and waits; e1 was never passed over; the part's new run of failures starts now.
    expect((await db.store.deliveries.list())[0]).toMatchObject({ retrying: 1, setAside: 1, failingSince: new Date(clock).toISOString() });
    expect(theirs.got.map((g) => g.event.id)).not.toContain('e1');
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

  it('pushes an app that says what it reads only that (ADR 0104)', async () => {
    const theirs = part();
    const d = eventDeliverer({ store: db.store, subscribers, grants, send: theirs.send, declaredEvents: async (app) => (app === 'notes' ? { reads: ['folio.document.published'], publishes: [] } : undefined) });
    await d.tick();
    await db.store.publish('folio', [
      { topic: 'folio.document.published', id: 'd1', payload: {} },
      { topic: 'folio.document.withdrawn', id: 'w1', payload: {} },
    ]);
    expect(await d.tick()).toMatchObject({ delivered: 1, skipped: 1 });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['d1']);
  });

  it('says once when an app missed events that were pruned while it was off, then goes on from what is left', async () => {
    const theirs = part();
    let list = [{ app: 'notes', name: 'Notes', enabled: false }];
    const d = eventDeliverer({ store: db.store, subscribers: async () => list, grants, send: theirs.send, audit: async (e, key) => void audited.push({ ...e, key } as NewAuditEntry) });
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }]);
    await db.store.pruneEvents(0);
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd2', payload: {} }]);
    list = [{ app: 'notes', name: 'Notes', enabled: true }];
    expect(await d.tick()).toMatchObject({ delivered: 1, behind: ['notes'] });
    expect(theirs.got.map((g) => g.event.id)).toEqual(['d2']);
    expect(audited.at(-1)).toMatchObject({ action: 'delivery.gap', target: 'notes', key: expect.stringMatching(/^delivery\.gap:notes:/) });
    expect(await d.tick()).toMatchObject({ behind: [] });
  });

  it('says so once even when nothing is left after what was pruned', async () => {
    let list = [{ app: 'notes', name: 'Notes', enabled: false }];
    const d = eventDeliverer({ store: db.store, subscribers: async () => list, grants, send: part().send });
    await d.tick();
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }]);
    await db.store.pruneEvents(0);
    list = [{ app: 'notes', name: 'Notes', enabled: true }];
    expect(await d.tick()).toMatchObject({ delivered: 0, behind: ['notes'] });
    expect(await d.tick()).toMatchObject({ behind: [] });
  });

  it('starts a new subscriber after what was pruned, not behind it', async () => {
    await db.store.publish('folio', [{ topic: 'folio.document.published', id: 'd1', payload: {} }]);
    await db.store.pruneEvents(0);
    const d = eventDeliverer({ store: db.store, subscribers, grants, send: part().send });
    expect(await d.tick()).toMatchObject({ behind: [] });
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
    expect(await d.tick()).toEqual({ delivered: 0, skipped: 0, failed: [], setAside: 0, behind: [] });
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
