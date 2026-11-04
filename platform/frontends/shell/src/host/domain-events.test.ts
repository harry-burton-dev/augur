import { createEventBus } from '@augur/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import { DomainEventStream, topicsFor, type BrowserDomainEvent } from './domain-events.js';

const event = (id: string, topic = 'folio.document.published'): BrowserDomainEvent => ({ seq: id, topic, id, publisher: topic.split('.')[0], at: '2026-11-03T23:00:00.000Z', workspace: { id: 'w-fin', path: ['w-org', 'w-fin'] }, payload: { document: id } });
const sse = (e: BrowserDomainEvent) => `event: domain-event\ndata: ${JSON.stringify(e)}\n\n`;

/** A stream response that yields the given chunks, then stays open until aborted. */
const streamOf = (chunks: string[], signal?: AbortSignal | null) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((s) => c.enqueue(new TextEncoder().encode(s)));
        signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );

describe('topicsFor', () => {
  it("follows each app's own topics and the platform's, once each", () => {
    expect(topicsFor([{ id: 'folio' }, { id: 'mandate' }, { id: 'folio' }])).toEqual(['folio.*', 'mandate.*', 'platform.*']);
  });
});

describe('DomainEventStream', () => {
  it('follows the floor once and puts each event on the bus by its topic', async () => {
    const bus = createEventBus();
    const heard: string[] = [];
    bus.on<BrowserDomainEvent>('folio.document.published', (e) => heard.push(`doc ${e.id}`));
    bus.on<BrowserDomainEvent>('platform.team.renamed', (e) => heard.push(`team ${e.id}`));
    bus.on('folio.document.published', () => {
      throw new Error('one handler failing');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => streamOf([': connected\n\n', sse(event('d1')), sse(event('t1', 'platform.team.renamed')) + sse(event('d2'))], init?.signal)) as unknown as typeof fetch;
    const stream = new DomainEventStream({ getToken: async () => 'tok', floor: 'w-fin', topics: ['folio.*', 'platform.*'], bus, fetchImpl });
    stream.start();
    await vi.waitFor(() => expect(heard).toEqual(['doc d1', 'team t1', 'doc d2']));
    stream.stop();
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe('/api/events/v1/domain-events/stream?topics=folio.*%2Cplatform.*');
    expect(init).toMatchObject({ headers: { authorization: 'Bearer tok', 'x-workspace-id': 'w-fin' } });
  });

  it('tries again when the stream drops or is refused', async () => {
    const bus = createEventBus();
    const heard: string[] = [];
    bus.on<BrowserDomainEvent>('folio.document.published', (e) => heard.push(e.id));
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => (++calls === 1 ? new Response('down', { status: 503 }) : streamOf([sse(event('after'))], init?.signal))) as unknown as typeof fetch;
    const stream = new DomainEventStream({ getToken: async () => 'tok', floor: 'w-fin', topics: ['folio.*'], bus, fetchImpl, retryMs: 5 });
    stream.start();
    await vi.waitFor(() => expect(heard).toEqual(['after']));
    stream.stop();
  });
});
