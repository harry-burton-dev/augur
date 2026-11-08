import { MessageChannel, type MessagePort } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from './context.js';
import { Channel, type Port } from './channel.js';
import type { WireRequest, WireResponse } from './fetch.js';
import { runWorker, type StartInit } from './runtime.js';

/** A message port as the bridge takes one, with the network a worker would have, for the runtime to take away. */
const asPort = (port: MessagePort) => {
  const listeners = new Map<(e: MessageEvent) => void, (data: unknown) => void>();
  port.unref();
  return {
    fetch: () => undefined,
    WebSocket: class {},
    navigator: { storage: {}, locks: {}, userAgent: 'test' },
    postMessage: (m: unknown, transfer?: Transferable[]) => port.postMessage(m, transfer as never),
    addEventListener: (_: 'message', fn: (e: MessageEvent) => void) => {
      const on = (data: unknown) => fn({ data } as MessageEvent);
      listeners.set(fn, on);
      port.on('message', on);
    },
    removeEventListener: (_: 'message', fn: (e: MessageEvent) => void) => void port.off('message', listeners.get(fn)!),
  } satisfies Port & Record<string, unknown>;
};

const { port1, port2 } = new MessageChannel();
const worker = asPort(port1);
const asked: WireRequest[] = [];
const drawn: { root: string; records: unknown[] }[] = [];
const host = new Channel(asPort(port2), (method, args) => {
  if (method !== 'fetch') return undefined;
  const wire = args[0] as WireRequest;
  asked.push(wire);
  const body = new TextEncoder().encode(JSON.stringify({ got: wire.path })).buffer as ArrayBuffer;
  return { status: 200, statusText: 'OK', headers: [['content-type', 'application/json']], body } satisfies WireResponse;
});
host.onMutate = (root, records) => drawn.push({ root, records });
let ctx: AppContext;

beforeAll(async () => {
  runWorker(worker);
  // As the shell's bootstrap defines Quill's elements (here, one of them) before the app starts.
  const { createRemoteElement } = await import('@remote-dom/core/elements');
  customElements.define('quill-notice', createRemoteElement({ properties: { heading: { attribute: false } } }) as unknown as CustomElementConstructor);
  const init: StartInit = {
    entry: fileURLToPath(new URL('../../test/sdk3-app.ts', import.meta.url)),
    person: { id: 'p1', name: 'Ada' },
    workspace: { id: 'w1', kind: 'team', name: 'Claims' },
    path: '/',
    previewsOn: ['board'],
  };
  await host.call('start', init);
  ctx = (globalThis as { testCtx?: AppContext }).testCtx!;
});
afterAll(() => host.close());

describe('the worker runtime', () => {
  it('takes the network away from the worker’s scope', () => {
    expect(worker).not.toHaveProperty('fetch');
    expect(worker).not.toHaveProperty('WebSocket');
  });

  it('takes away the origin’s file system and locks, which the shell and other apps share', () => {
    expect(worker.navigator.storage).toBeUndefined();
    expect(worker.navigator.locks).toBeUndefined();
    expect(worker.navigator.userAgent).toBe('test');
  });

  it('hands start(ctx) the person, the floor and the previews, and nothing that names a token', () => {
    expect(ctx.person).toEqual({ id: 'p1', name: 'Ada' });
    expect(ctx.workspace.name).toBe('Claims');
    expect(ctx.previewOn('board')).toBe(true);
    expect(ctx.previewOn('other')).toBe(false);
    expect(JSON.stringify(Object.keys(ctx))).not.toMatch(/token/i);
  });

  it('sends what the app renders to the host as remote-dom mutations of its root', async () => {
    await new Promise((r) => setTimeout(r, 20));
    const screen = drawn.filter((d) => d.root === 'screen').flatMap((d) => d.records) as [number, string, { element: string; properties: Record<string, unknown> }, number][];
    const inserted = screen.find((r) => r[0] === 0)?.[2];
    expect(inserted?.element).toBe('quill-notice');
    expect(inserted?.properties).toMatchObject({ heading: 'Hello Ada' });
  });

  it('refuses an absolute URL, a protocol-relative one and a path outside /api/', async () => {
    await expect(ctx.fetch('https://example.org/api/x')).rejects.toThrow(TypeError);
    await expect(ctx.fetch('//example.org/api/x')).rejects.toThrow(/not an address/);
    await expect(ctx.fetch('/api/../sso/admin')).rejects.toThrow(/only the gateway/);
    expect(asked).toEqual([]);
  });

  it('returns a Response built from the bytes the host sent, and never sends who is calling itself', async () => {
    const res = await ctx.fetch('/api/notes/v1/notes', { method: 'POST', body: JSON.stringify({ a: 1 }), headers: { authorization: 'Bearer stolen', 'x-augur-app': 'other', 'x-forwarded-for': '10.0.0.1', 'content-type': 'application/json' } });
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ got: '/api/notes/v1/notes' });
    expect(asked[0]).toMatchObject({ path: '/api/notes/v1/notes', method: 'POST', body: '{"a":1}', headers: [['content-type', 'application/json']] });
  });

  it('sends a form with the type fetch would have given it', async () => {
    await ctx.fetch('/api/notes/v1/search', { method: 'POST', body: new URLSearchParams({ q: 'a b' }) });
    expect(asked.at(-1)).toMatchObject({ body: 'q=a+b', headers: [['content-type', 'application/x-www-form-urlencoded;charset=UTF-8']] });
  });

  it('runs what start returned when the host stops the app', async () => {
    await host.call('stop');
    expect((globalThis as { stopped?: boolean }).stopped).toBe(true);
  });
});
