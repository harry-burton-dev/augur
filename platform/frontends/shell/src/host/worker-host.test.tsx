import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, type Port } from '@augur/mfe-sdk/sdk3/host';
import { fromCatalogue3, type Catalogue3, type WorkerApp } from './apps3.js';
import { WorkerMounter, type WorkerContext } from './worker-host.js';
import { NodeBudget } from './budget.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Two ends of a worker's postMessage, in one thread: what one posts, the other hears, cloned. */
function pair() {
  const make = () => {
    const listeners = new Set<(e: MessageEvent) => void>();
    return {
      listeners,
      other: undefined as unknown as { listeners: Set<(e: MessageEvent) => void> },
      postMessage(m: unknown) {
        const data = structuredClone(m);
        const to = this.other.listeners;
        queueMicrotask(() => to.forEach((fn) => fn({ data } as MessageEvent)));
      },
      addEventListener: (type: string, fn: (e: MessageEvent) => void) => type === 'message' && listeners.add(fn),
      removeEventListener: (_: string, fn: (e: MessageEvent) => void) => void listeners.delete(fn),
    };
  };
  const a = make();
  const b = make();
  a.other = b;
  b.other = a;
  return [a, b] as const;
}

/** A stand-in worker: the host's end, with the worker's `error` event and `terminate`. */
class FakeWorker extends EventTarget {
  terminated = false;
  constructor(readonly end: ReturnType<typeof pair>[0]) {
    super();
  }
  postMessage(m: unknown) {
    if (!this.terminated) this.end.postMessage(m);
  }
  override addEventListener(type: string, fn: EventListenerOrEventListenerObject | null) {
    if (type === 'message') this.end.addEventListener(type, fn as never);
    else super.addEventListener(type, fn);
  }
  override removeEventListener(type: string, fn: EventListenerOrEventListenerObject | null) {
    if (type === 'message') this.end.removeEventListener(type, fn as never);
    else super.removeEventListener(type, fn);
  }
  terminate() {
    this.terminated = true;
  }
}

/** The app's end: a channel that answers start the way `run` says, and sends whatever the test draws. */
function stubApp(run: (app: Channel, method: string, args: unknown[]) => unknown = () => undefined) {
  const [host, worker] = pair();
  const fake = new FakeWorker(host);
  const app: Channel = new Channel(worker as unknown as Port, (method, args) => run(app, method, args));
  return { worker: fake, app };
}

const notice = (id: string, heading: string) => [0, '~', { id, type: 1, element: 'quill-notice', properties: { heading }, attributes: {}, eventListeners: {}, children: [] }, 0];

const manifest: Catalogue3 = {
  contract: 3,
  id: 'notes',
  name: 'Notes',
  version: '1.0.0',
  frontend: { entry: 'sandbox.js' },
  contributes: { commands: [{ id: 'note.new', label: 'New note' }] },
};
const app: WorkerApp = fromCatalogue3(manifest);

const ctxFor = (over: Partial<WorkerContext> = {}): WorkerContext => ({
  person: { id: 'p1', name: 'Ada' },
  workspace: { id: 'floor-1', kind: 'team', name: 'Claims' },
  path: '/',
  getToken: async () => 'the-token',
  fetchImpl: vi.fn(async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch,
  navigate: vi.fn(),
  notify: vi.fn(),
  raise: vi.fn(async () => undefined),
  request: vi.fn(async () => undefined),
  ...over,
});

let stage: HTMLElement;
let mounter: WorkerMounter;
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

beforeEach(() => {
  stage = document.createElement('div');
  document.body.replaceChildren(stage);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  act(() => mounter?.unmount());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the worker host', () => {
  it('starts the app’s entry from the shell’s origin and draws its screen with the kit, dropping what isn’t in the vocabulary', async () => {
    let started: unknown;
    const stub = stubApp((self, method, args) => {
      if (method !== 'start') return;
      started = args[0];
      self.mutate('screen', [notice('n1', 'Hello Ada'), [0, '~', { id: 'e1', type: 1, element: 'evil-frame', properties: { src: 'https://example.org' }, attributes: {}, eventListeners: {}, children: [] }, 1]]);
    });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    expect(started).toMatchObject({ entry: '/apps/notes/1.0.0/sandbox.js', person: { id: 'p1', name: 'Ada' }, workspace: { id: 'floor-1', kind: 'team', name: 'Claims' }, path: '/' });
    expect(JSON.stringify(started)).not.toContain('the-token');
    expect(stage.textContent).toContain('Hello Ada');
    expect(stage.querySelector('iframe')).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('<evil-frame> isn’t in Quill’s remote vocabulary'));
    expect(stage.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('open');
  });

  it('makes ctx.fetch with the person’s token, the floor and the app’s own id, whatever the worker sends', async () => {
    let answer: unknown;
    const stub = stubApp(async (self, method) => {
      if (method !== 'start') return;
      answer = await self.call('fetch', { path: '/api/notes/v1/notes', method: 'GET', headers: [['x-augur-app', 'admin'], ['authorization', 'Bearer forged'], ['accept', 'application/json']], body: null });
    });
    const ctx = ctxFor();
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctx));
    await flush();
    await flush();
    const [path, init] = (ctx.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const headers = new Headers((init as RequestInit).headers);
    expect(path).toBe('/api/notes/v1/notes');
    expect(headers.get('authorization')).toBe('Bearer the-token');
    expect(headers.get('x-augur-app')).toBe('notes');
    expect(headers.get('x-workspace-id')).toBe('floor-1');
    expect(headers.get('accept')).toBe('application/json');
    expect(answer).toMatchObject({ status: 200 });
    expect(new TextDecoder().decode((answer as { body: ArrayBuffer }).body)).toBe('{"ok":true}');
  });

  it('refuses a fetch outside the gateway even when the worker skips its own check', async () => {
    let refused: Error | undefined;
    const stub = stubApp(async (self, method) => {
      if (method === 'start') await self.call('fetch', { path: 'https://example.org/api/x', method: 'GET', headers: [], body: null }).catch((e: Error) => (refused = e));
    });
    const ctx = ctxFor();
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctx));
    await flush();
    await flush();
    expect(refused?.message).toMatch(/under \/api\//);
    expect(ctx.fetchImpl).not.toHaveBeenCalled();
  });

  it('stops an app that draws more than 2,000 nodes in one flush, and says why in its pane only', async () => {
    const box = { id: 'box', type: 1, element: 'quill-section', properties: { label: 'Flood' }, attributes: {}, eventListeners: {}, children: Array.from({ length: 2000 }, (_, i) => ({ id: `t${i}`, type: 3, data: 'x' })) };
    const stub = stubApp((self, method) => method === 'start' && self.mutate('screen', [[0, '~', box, 0]]));
    const outside = document.createElement('p');
    outside.textContent = 'The rail';
    document.body.append(outside);
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    expect(stage.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('unresponsive');
    expect(stage.textContent).toContain('tried to draw 2,001 things at once');
    expect(stage.textContent).toContain('Try again');
    expect(stub.worker.terminated).toBe(true);
    expect(document.body.contains(outside)).toBe(true);
  });

  it('shows a worker that throws as failed, with Try again starting a new worker', async () => {
    const workers: FakeWorker[] = [];
    mounter = new WorkerMounter(stage, {
      createWorker: () => {
        const stub = stubApp((self, method) => {
          if (method !== 'start') return;
          if (workers.length === 1) throw new Error('Boom.');
          self.mutate('screen', [notice('n1', 'Back again')]);
        });
        workers.push(stub.worker);
        return stub.worker as unknown as Worker;
      },
    });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    expect(stage.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('failed');
    expect(stage.textContent).toContain('Notes couldn’t open: Boom.');
    const retry = [...stage.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again'))!;
    act(() => retry.click());
    await flush();
    expect(workers).toHaveLength(2);
    expect(workers[0]!.terminated).toBe(true);
    expect(stage.textContent).toContain('Back again');
  });

  it('fails the pane when the worker itself errors', async () => {
    const stub = stubApp();
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    act(() => void stub.worker.dispatchEvent(Object.assign(new Event('error'), { message: 'ReferenceError: x is not defined' })));
    expect(stage.textContent).toContain('Notes stopped answering (ReferenceError: x is not defined)');
  });

  it('starts a new worker on a new floor, and tells the running one about a move on the same floor', async () => {
    const workers: FakeWorker[] = [];
    const moves: string[] = [];
    mounter = new WorkerMounter(stage, {
      createWorker: () => {
        const stub = stubApp((self, method, args) => {
          if (method === 'start') self.mutate('screen', [notice('n1', `On ${(args[0] as { workspace: { name: string } }).workspace.name}`)]);
          if (method === 'navigate') moves.push(String(args[0]));
        });
        workers.push(stub.worker);
        return stub.worker as unknown as Worker;
      },
    });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    let kept: string | undefined;
    act(() => void (kept = mounter.mount(app, ctxFor({ path: '/notebooks' }))));
    expect(kept).toBe('kept');
    await flush();
    expect(moves).toEqual(['/notebooks']);
    expect(workers).toHaveLength(1);
    act(() => void mounter.mount(app, ctxFor({ workspace: { id: 'floor-2', kind: 'org', name: 'Everyone' } })));
    await flush();
    expect(workers).toHaveLength(2);
    expect(workers[0]!.terminated).toBe(true);
    expect(stage.textContent).toContain('On Everyone');
  });

  it('says an app is slow after 5 seconds without a screen, and failed after 30', async () => {
    vi.useFakeTimers();
    const stub = stubApp();
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    act(() => void vi.advanceTimersByTime(5000));
    expect(stage.textContent).toContain('Notes is taking a while to open');
    act(() => void vi.advanceTimersByTime(25_000));
    expect(stage.textContent).toContain('Notes didn’t open in 30 seconds');
    expect(stub.worker.terminated).toBe(true);
  });

  it('draws the pane’s heading and actions from what the app sets, and an action it doesn’t handle yet as unavailable', async () => {
    const commands: string[] = [];
    let self!: Channel;
    const stub = stubApp((app, method, args) => {
      self = app;
      if (method === 'start') {
        app.mutate('screen', [notice('n1', 'Ready')]);
        app.post('frame.set', { title: 'All notes', actions: [{ command: 'note.new' }, { command: 'not.declared' }], width: 'wide' });
      }
      if (method === 'command') commands.push(String(args[0]));
    });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    expect(stage.querySelector('[role="heading"]')?.textContent).toBe('All notes');
    expect(stage.querySelector('[data-width]')?.getAttribute('data-width')).toBe('wide');
    const button = () => [...stage.querySelectorAll('button')].find((b) => b.textContent?.includes('New note'))!;
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(stage.textContent).toContain('Notes hasn’t loaded this yet.');
    expect(stage.textContent).not.toContain('not.declared');
    self.post('commands', ['note.new']);
    await flush();
    act(() => button().click());
    await flush();
    expect(commands).toEqual(['note.new']);
  });
});

describe('the node budget', () => {
  it('counts what a removal takes away, and refuses more than the live budget', () => {
    const budget = new NodeBudget({ perFlush: 10, live: 12 });
    const tree = (id: string, n: number) => ({ id, children: Array.from({ length: n }, (_, i) => ({ id: `${id}.${i}` })) });
    expect(budget.take('screen', [[0, '~', tree('a', 4), 0]])).toBeUndefined();
    expect(budget.live).toBe(5);
    expect(budget.take('screen', [[0, '~', tree('b', 4), 1]])).toBeUndefined();
    expect(budget.take('screen', [[1, '~', 0]])).toBeUndefined();
    expect(budget.live).toBe(5);
    expect(budget.take('card', [[0, '~', tree('c', 6), 0]])).toBeUndefined();
    expect(budget.take('card', [[0, '~', tree('d', 1), 0]])).toEqual({ kind: 'live', nodes: 14, limit: 12 });
    expect(budget.take('card', [[0, '~', tree('e', 10), 0]])).toEqual({ kind: 'flush', nodes: 11, limit: 10 });
  });
});
