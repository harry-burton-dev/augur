import { describe, expect, it, vi } from 'vitest';
import { fromServer, NotificationFeed, parseEvents, type ServerNotification } from './feed.js';

const n = (id: string, title = `Note ${id}`): ServerNotification => ({ id, app: 'library', level: 'needs', title, link: '/doc/7', createdAt: '2026-10-18T19:00:00.000Z' });
const sse = (x: ServerNotification) => `event: notification\ndata: ${JSON.stringify(x)}\n\n`;

/** A stream response that yields the given chunks, then stays open until aborted. */
const streamOf = (chunks: string[], signal?: AbortSignal) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((s) => c.enqueue(new TextEncoder().encode(s)));
        signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );

describe('parseEvents', () => {
  it('reads notification events and keeps an unfinished one for later', () => {
    const { events, rest } = parseEvents(`: connected\n\n${sse(n('1'))}event: notification\ndata: {"id":`);
    expect(events.map((e) => e.id)).toEqual(['1']);
    expect(rest).toBe('event: notification\ndata: {"id":');
  });
});

describe('parseEvents for the Inbox', () => {
  it('reads inbox events beside notifications on the same stream', () => {
    const text = `${sse(n('1'))}event: inbox\ndata: {"id":"i-1","change":"added"}\n\n`;
    expect(parseEvents(text).events.map((e) => e.id)).toEqual(['1']);
    expect(parseEvents<{ id: string; change: string }>(text, 'inbox').events).toEqual([{ id: 'i-1', change: 'added' }]);
  });
});

describe('fromServer', () => {
  it('becomes a Shell notification', () => {
    expect(fromServer(n('1'))).toEqual({ id: '1', app: 'library', level: 'needs', title: 'Note 1', detail: undefined, time: '2026-10-18T19:00:00.000Z' });
  });

  it('keeps the floor it came from, for the gauge and its tag', () => {
    expect(fromServer({ ...n('2'), workspace: { id: 'fin', path: ['org', 'fin'] } }).floor).toBe('fin');
  });

  it('lands a kind the person made quiet without a pulse', () => {
    expect(fromServer({ ...n('3'), kind: 'comment' }, ['library:comment']).quiet).toBe(true);
    expect(fromServer({ ...n('4'), kind: 'approval' }, ['library:comment']).quiet).toBeUndefined();
    expect(fromServer(n('5'), ['library:comment']).quiet).toBeUndefined();
  });
});

describe('NotificationFeed', () => {
  it('loads the unread list, then passes on each live notification', async () => {
    const listed: string[][] = [];
    const live: string[] = [];
    const states: { loading: boolean; error: string }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) =>
      url.endsWith('/stream') ? streamOf([': connected\n\n', sse(n('2', 'First')), sse(n('3', 'Second'))], init?.signal ?? undefined) : Response.json([n('1')]),
    ) as unknown as typeof fetch;
    const feed = new NotificationFeed({
      getToken: async () => 'tok',
      fetchImpl,
      onList: (l) => listed.push(l.map((x) => x.id)),
      onNotification: (x) => live.push(x.title),
      onState: (s) => states.push(s),
    });
    feed.start();
    await vi.waitFor(() => expect(live).toEqual(['First', 'Second']));
    feed.stop();
    expect(listed).toEqual([['1']]);
    expect(states.at(-1)).toEqual({ loading: false, error: '' });
    expect(vi.mocked(fetchImpl).mock.calls[0][1]).toMatchObject({ headers: { authorization: 'Bearer tok' } });
  });

  it('connects first, and reads the list only once the stream has answered', async () => {
    const asked: string[] = [];
    const states: boolean[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      asked.push(url);
      return url.endsWith('/stream') ? streamOf([': connected\n\n'], init?.signal ?? undefined) : Response.json([]);
    }) as unknown as typeof fetch;
    const feed = new NotificationFeed({ getToken: async () => 't', fetchImpl, onList: () => {}, onNotification: () => {}, onState: (s) => states.push(s.loading) });
    feed.start();
    await vi.waitFor(() => expect(states).toEqual([true, false]));
    feed.stop();
    expect(asked).toEqual(['/api/events/v1/notifications/stream', '/api/events/v1/notifications']);
  });

  it('passes on what came while the list loaded after the list has landed, and only what the list lacks', async () => {
    const order: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) =>
      url.endsWith('/stream') ? streamOf([sse(n('1')), sse(n('2'))], init?.signal ?? undefined) : Response.json([n('1')]),
    ) as unknown as typeof fetch;
    const feed = new NotificationFeed({
      getToken: async () => 't',
      fetchImpl,
      onList: (l) => order.push(`list ${l.map((x) => x.id).join()}`),
      onNotification: (x) => order.push(`live ${x.id}`),
      onState: () => {},
    });
    feed.start();
    await vi.waitFor(() => expect(order).toContain('live 2'));
    feed.stop();
    expect(order).toEqual(['list 1', 'live 2']);
  });

  it('closes the stream, says so and tries again when the list can’t be read', async () => {
    let lists = 0;
    let closed = 0;
    const states: { loading: boolean; error: string }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/stream')) {
        return new Response(new ReadableStream<Uint8Array>({ cancel: () => void closed++ }), { headers: { 'content-type': 'text/event-stream' } });
      }
      return ++lists === 1 ? new Response(null, { status: 503 }) : Response.json([]);
    }) as unknown as typeof fetch;
    const feed = new NotificationFeed({ getToken: async () => 't', fetchImpl, retryMs: 1, onList: () => {}, onNotification: () => {}, onState: (s) => states.push(s) });
    feed.start();
    await vi.waitFor(() => expect(states.at(-1)).toEqual({ loading: false, error: '' }));
    feed.stop();
    expect(closed).toBe(1);
    expect(states).toEqual([
      { loading: true, error: '' },
      { loading: false, error: "Notifications aren't arriving right now. Trying again…" },
      { loading: false, error: '' },
    ]);
  });

  it('says so and tries again when the stream drops', async () => {
    let calls = 0;
    const states: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      if (!url.endsWith('/stream')) return Response.json([]);
      calls++;
      if (calls === 1) throw new TypeError('network down');
      return streamOf([': connected\n\n']);
    }) as unknown as typeof fetch;
    const feed = new NotificationFeed({ getToken: async () => 't', fetchImpl, retryMs: 1, onList: () => {}, onNotification: () => {}, onState: (s) => states.push(s.error) });
    feed.start();
    await vi.waitFor(() => expect(calls).toBe(2));
    await vi.waitFor(() => expect(states.at(-1)).toBe(''));
    feed.stop();
    expect(states).toContain("Notifications aren't arriving right now. Trying again…");
  });

  it('calls fetch unbound, as the browser requires', async () => {
    const calls: string[] = [];
    // Like window.fetch: refuses to run as a method of another object.
    const strictFetch = function (this: unknown, url: string) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      calls.push(url);
      return Promise.resolve(new Response(null, { status: 204 }));
    } as unknown as typeof fetch;
    const feed = new NotificationFeed({ getToken: async () => 't', fetchImpl: strictFetch, onList: () => {}, onNotification: () => {}, onState: () => {} });
    await feed.setRead('abc', true);
    expect(calls).toEqual(['/api/events/v1/notifications/abc/read']);
  });

  it('marks notifications read and unread', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    const feed = new NotificationFeed({ getToken: async () => 't', fetchImpl, onList: () => {}, onNotification: () => {}, onState: () => {} });
    await feed.setRead('abc', true);
    await feed.setRead('abc', false);
    expect(vi.mocked(fetchImpl).mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      'POST /api/events/v1/notifications/abc/read',
      'DELETE /api/events/v1/notifications/abc/read',
    ]);
  });

  it('gets one notification for a notice email’s link, or nothing when it isn’t theirs', async () => {
    let status = 200;
    const fetchImpl = vi.fn(async () => (status === 200 ? new Response(JSON.stringify(n('abc'))) : new Response(null, { status }))) as unknown as typeof fetch;
    const feed = new NotificationFeed({ getToken: async () => 't', fetchImpl, onList: () => {}, onNotification: () => {}, onState: () => {} });
    expect(await feed.get('abc')).toMatchObject({ id: 'abc', link: '/doc/7' });
    expect(vi.mocked(fetchImpl).mock.calls[0][0]).toBe('/api/events/v1/notifications/abc');
    status = 404;
    expect(await feed.get('abc')).toBeUndefined();
    status = 503;
    await expect(feed.get('abc')).rejects.toThrow('answered 503');
  });
});
