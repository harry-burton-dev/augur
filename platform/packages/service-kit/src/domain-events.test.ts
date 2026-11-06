import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addToOutbox, followEvents, OUTBOX_TABLE_SQL, outboxRelay, type DomainEvent } from './domain-events.js';

const credentials = { name: 'folio', getToken: async () => 'app-folio' };

/** An events service that keeps what it's sent and hands it back in order. */
const fakeEvents = () => {
  const kept: DomainEvent[] = [];
  const refusing = new Map<string, number>();
  let failing = 0;
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer app-folio');
    if (init?.method === 'POST') {
      if (failing > 0) {
        failing--;
        return new Response(JSON.stringify({ message: 'down' }), { status: 503 });
      }
      const sent: DomainEvent[] = JSON.parse(String(init.body)).events;
      const status = sent.map((e) => refusing.get(e.id)).find(Boolean);
      if (status) return new Response(JSON.stringify({ message: 'not that' }), { status });
      for (const e of sent) {
        if (!kept.some((k) => k.id === e.id)) kept.push({ ...e, seq: String(kept.length + 1), publisher: 'folio', at: new Date().toISOString() });
      }
      return new Response(JSON.stringify({ added: 1, repeated: 0 }), { status: 202 });
    }
    const after = Number(url.searchParams.get('after') ?? 0);
    const limit = Number(url.searchParams.get('limit'));
    const events = kept.filter((e) => Number(e.seq) > after).slice(0, limit);
    return new Response(JSON.stringify({ events, next: events.at(-1)?.seq ?? String(after) }), { status: 200 });
  }) as typeof fetch;
  // Three answers: publishEvents tries that many times.
  return { kept, fetchImpl, refusing, failOnce: () => (failing = 3) };
};

/** An outbox with these event ids waiting, whose marks last only when committed. */
const fakeOutbox = (ids: string[]) => {
  const rows = ids.map((id, i) => ({ id: i + 1, event_id: id, topic: 'folio.document.published', workspace_id: null, payload: { id }, sent: false }));
  let marking: number[] = [];
  const query = async (text: string, values?: unknown[]) => {
    if (text.startsWith('select')) return { rows: rows.filter((r) => !r.sent) };
    if (text.startsWith('update')) marking = values?.[0] as number[];
    if (text === 'commit') for (const r of rows) r.sent ||= marking.includes(r.id);
    if (text === 'begin' || text === 'commit' || text === 'rollback') marking = [];
    return { rows: [] };
  };
  return { pool: { connect: async () => ({ query, release() {} }) }, waiting: () => rows.filter((r) => !r.sent).map((r) => r.event_id) };
};

describe('outboxRelay', () => {
  const relayOf = (outbox: ReturnType<typeof fakeOutbox>, events: ReturnType<typeof fakeEvents>, onError?: (err: unknown) => void) =>
    outboxRelay({ pool: outbox.pool, eventsUrl: 'http://events:8084', credentials, fetchImpl: events.fetchImpl, onError });

  it('sends the rest of a refused batch, and sets aside only the row refused alone, saying so', async () => {
    const events = fakeEvents();
    const outbox = fakeOutbox(['a', 'b', 'c']);
    const errors: Error[] = [];
    events.refusing.set('b', 400);
    expect(await relayOf(outbox, events, (err) => errors.push(err as Error)).flush()).toBe(3);
    expect(events.kept.map((e) => e.id)).toEqual(['a', 'c']);
    expect(outbox.waiting()).toEqual([]);
    expect(errors.map((e) => e.message)).toEqual([expect.stringMatching(/^Set aside outbox event b \(folio\.document\.published\): .*answered 400: not that/)]);
  });

  it('keeps every row when the events service is down, even partway through going one at a time', async () => {
    const events = fakeEvents();
    const outbox = fakeOutbox(['a', 'b', 'c']);
    const errors: unknown[] = [];
    const relay = relayOf(outbox, events, (err) => errors.push(err));
    events.refusing.set('a', 503);
    await expect(relay.flush()).rejects.toThrow(/answered 503/);
    expect(outbox.waiting()).toEqual(['a', 'b', 'c']);

    events.refusing.clear();
    events.refusing.set('b', 400);
    events.refusing.set('c', 503);
    await expect(relay.flush()).rejects.toThrow(/answered 503/);
    expect(outbox.waiting()).toEqual(['a', 'b', 'c']);
    expect(errors).toEqual([]);

    // The row already sent goes again and is kept once, as any repeated event is.
    events.refusing.delete('c');
    expect(await relay.flush()).toBe(3);
    expect(events.kept.map((e) => e.id)).toEqual(['a', 'c']);
    expect(outbox.waiting()).toEqual([]);
  });

  it('keeps every row on a 403, which is about the publisher and not the row', async () => {
    const events = fakeEvents();
    const outbox = fakeOutbox(['a', 'b']);
    events.refusing.set('a', 403);
    await expect(relayOf(outbox, events).flush()).rejects.toThrow(/answered 403/);
    expect(outbox.waiting()).toEqual(['a', 'b']);
  });
});

describe('followEvents', () => {
  it('hands over each event once, in order, keeping its place after each', async () => {
    const events = fakeEvents();
    events.kept.push(...['a', 'b', 'c'].map((id, i) => ({ seq: String(i + 1), id, topic: 'folio.document.published', publisher: 'folio', at: '', payload: { id } })));
    let place: string | undefined;
    const seen: string[] = [];
    const follower = followEvents({
      eventsUrl: 'http://events:8084/',
      credentials,
      fetchImpl: events.fetchImpl,
      topics: ['folio.*'],
      batch: 2,
      cursor: { load: async () => place, save: async (seq) => void (place = seq) },
      handle: async (e) => {
        if (e.id === 'c' && !seen.includes('c-failed')) {
          seen.push('c-failed');
          throw new Error('not yet');
        }
        seen.push(e.id);
      },
    });
    expect(await follower.poll()).toBe(2);
    await expect(follower.poll()).rejects.toThrow('not yet');
    expect(place).toBe('2');
    expect(await follower.poll()).toBe(1);
    expect(seen).toEqual(['a', 'b', 'c-failed', 'c']);
    expect(await follower.poll()).toBe(0);
  });
});

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('the outbox', () => {
  const schema = `outbox_test_${process.pid}`;
  let pool: pg.Pool;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
    await pool.query(`create schema ${schema}`);
    await pool.query(OUTBOX_TABLE_SQL);
  });
  afterAll(async () => {
    await pool.query(`drop schema ${schema} cascade`);
    await pool.end();
  });

  it('sends what was committed with its change, oldest first, and keeps what wasn’t taken', async () => {
    const events = fakeEvents();
    const client = await pool.connect();
    await client.query('begin');
    await addToOutbox(client, { topic: 'folio.document.published', payload: { document: 'd1' }, workspace: 'w-finance' });
    await client.query('rollback');
    await client.query('begin');
    await addToOutbox(client, { topic: 'folio.document.published', payload: { document: 'd2' }, workspace: 'w-finance' });
    await addToOutbox(client, { topic: 'folio.document.withdrawn', payload: { document: 'd2' }, id: 'mine-1' });
    await client.query('commit');
    client.release();

    const relay = outboxRelay({ pool, eventsUrl: 'http://events:8084', credentials, fetchImpl: events.fetchImpl });
    events.failOnce();
    await expect(relay.flush()).rejects.toThrow(/down/);
    expect(events.kept).toEqual([]);
    expect(await relay.flush()).toBe(2);
    expect(events.kept).toMatchObject([
      { topic: 'folio.document.published', payload: { document: 'd2' }, workspace: 'w-finance', id: expect.stringMatching(/^[0-9a-f-]{36}$/) },
      { topic: 'folio.document.withdrawn', id: 'mine-1' },
    ]);
    expect(await relay.flush()).toBe(0);
  });
});
