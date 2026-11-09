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
const uploads: WireRequest[] = [];
const downloads: [string, { save?: boolean }?][] = [];
const opened: string[] = [];
const posted: [string, unknown[]][] = [];
const drawn: { root: string; records: unknown[] }[] = [];
const canvasPorts = new MessageChannel();
const host = new Channel(asPort(port2), (method, args) => {
  if (method === 'files.drops' || method === 'canvas.close' || method === 'signInAgain') posted.push([method, args]);
  if (method === 'files.download') {
    downloads.push(args as [string, { save?: boolean }?]);
    if ((args[1] as { save?: boolean } | undefined)?.save) return undefined;
    const missing = args[0] === '/api/notes/v1/files/gone';
    const body = new TextEncoder().encode(missing ? JSON.stringify({ message: 'That file is gone.' }) : 'hello').buffer as ArrayBuffer;
    return { status: missing ? 404 : 200, statusText: '', headers: [['content-type', missing ? 'application/json' : 'text/plain']], body } satisfies WireResponse;
  }
  if (method === 'canvas.open') {
    opened.push(String(args[0]));
    return canvasPorts.port1;
  }
  if (method !== 'fetch' && method !== 'files.upload') return undefined;
  const wire = args[0] as WireRequest;
  if (method === 'files.upload') uploads.push(wire);
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
    canvas: true,
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

  it('uploads a file’s bytes through the host, with its type, and hands back the answer', async () => {
    const res = await ctx.files.upload(new Blob(['hi there'], { type: 'text/plain' }), '/api/notes/v1/files');
    expect(res.status).toBe(200);
    expect(uploads.at(-1)).toMatchObject({ path: '/api/notes/v1/files', method: 'POST', headers: [['content-type', 'text/plain']] });
    expect(new TextDecoder().decode(uploads.at(-1)!.body as ArrayBuffer)).toBe('hi there');
    await expect(ctx.files.upload(new Blob(['x']), 'https://example.org/up')).rejects.toThrow(TypeError);
  });

  it('downloads a file as a Blob, has the host save one, and says why one can’t be had', async () => {
    const blob = await ctx.files.download('/api/notes/v1/files/1');
    expect(blob?.type).toBe('text/plain');
    expect(await blob!.text()).toBe('hello');
    expect(await ctx.files.download('/api/notes/v1/files/1', { save: true })).toBeUndefined();
    expect(downloads.at(-1)).toEqual(['/api/notes/v1/files/1', { save: true }]);
    await expect(ctx.files.download('/api/notes/v1/files/gone')).rejects.toThrow('That file is gone.');
    await expect(ctx.files.download('/elsewhere')).rejects.toThrow(TypeError);
  });

  it('hands files dropped on the pane to the app’s handler, and tells the host when it takes them', async () => {
    const got: File[] = [];
    const off = ctx.files.onDrop((files) => void got.push(...files));
    await new Promise((r) => setTimeout(r, 10));
    expect(posted).toContainEqual(['files.drops', [true]]);
    await host.call('drop', [{ name: 'a.txt', type: 'text/plain', lastModified: 1, bytes: new TextEncoder().encode('A').buffer }]);
    expect(got.map((f) => [f.name, f.type])).toEqual([['a.txt', 'text/plain']]);
    expect(await got[0]!.text()).toBe('A');
    off();
    await new Promise((r) => setTimeout(r, 10));
    expect(posted.at(-1)).toEqual(['files.drops', [false]]);
  });

  it('opens the canvas through the host and hands the app the port to talk to it', async () => {
    const port = await ctx.canvas!.open('canvas.js');
    expect(opened).toEqual(['canvas.js']);
    expect(port).toBeDefined();
    ctx.canvas!.close();
    await new Promise((r) => setTimeout(r, 10));
    expect(posted).toContainEqual(['canvas.close', []]);
  });

  it('asks the host for a fresh sign-in', async () => {
    ctx.signInAgain();
    await new Promise((r) => setTimeout(r, 10));
    expect(posted).toContainEqual(['signInAgain', []]);
  });

  it('runs what start returned when the host stops the app', async () => {
    await host.call('stop');
    expect((globalThis as { stopped?: boolean }).stopped).toBe(true);
  });
});
