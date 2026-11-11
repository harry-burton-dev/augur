import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel, type Port } from '@augur/mfe-sdk/sdk3/host';
import { fromCatalogue3, type Catalogue3, type WorkerApp } from './apps3.js';
import { WorkerMounter, inAppPath, workerCard, type WorkerContext } from './worker-host.js';
import { NodeBudget, RateBudget } from './budget.js';
import { PaneSlot } from './pane-target.js';
import { createRoot, type Root } from 'react-dom/client';

/** The slot the Shell draws at the window's right edge, with a stand-in clock at its top. */
let slotRoot: Root | undefined;
const drawSlot = () => {
  const el = document.createElement('div');
  document.body.append(el);
  slotRoot = createRoot(el);
  act(() => slotRoot!.render(<PaneSlot top={<span className="test-clock">09:41</span>} over={false} />));
  return el;
};
afterEach(() => {
  act(() => slotRoot?.unmount());
  slotRoot = undefined;
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Two ends of a worker's postMessage, in one thread: what one posts, the other hears, cloned. */
function pair() {
  const make = () => {
    const listeners = new Set<(e: MessageEvent) => void>();
    return {
      listeners,
      other: undefined as unknown as { listeners: Set<(e: MessageEvent) => void> },
      postMessage(m: unknown, transfer: Transferable[] = []) {
        const data = structuredClone(m, { transfer });
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
  postMessage(m: unknown, transfer?: Transferable[]) {
    if (!this.terminated) this.end.postMessage(m, transfer);
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
  contributes: { commands: [{ id: 'note.new', label: 'New note' }], places: [{ id: 'notebooks', label: 'Notebooks', fills: true }, { id: 'home', label: 'Home' }] },
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
  signInAgain: vi.fn(),
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

  it('stops an app that reuses a name in its tree, so what is drawn can’t outgrow the count', async () => {
    const stub = stubApp((self, method) => method === 'start' && self.mutate('screen', [notice('a', 'One'), notice('a', 'Two')]));
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    expect(stage.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('unresponsive');
    expect(stage.textContent).toContain('two things under one name');
  });

  it('stops an app that floods the shell with small changes', async () => {
    const stub = stubApp((self, method) => {
      if (method !== 'start') return;
      self.mutate('screen', [notice('n1', 'Ready')]);
      for (let i = 0; i < 50; i++) self.post('frame.set', { title: `t${i}` });
    });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker, budgets: { perSecond: 20 } });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    expect(stage.textContent).toContain('more than 20 changes in a second');
    expect(stub.worker.terminated).toBe(true);
  });

  it('stops an app that stops answering after it opened', async () => {
    vi.useFakeTimers();
    let hung = false;
    const stub = stubApp((self, method) => {
      if (method === 'start') self.mutate('screen', [notice('n1', 'Ready')]);
      if (method === 'ping' && hung) return new Promise(() => undefined);
    });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker, budgets: { hangMs: 1000 } });
    act(() => void mounter.mount(app, ctxFor()));
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    expect(stage.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('open');
    await act(async () => void (await vi.advanceTimersByTimeAsync(3000)));
    expect(stage.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('open');
    hung = true;
    await act(async () => void (await vi.advanceTimersByTimeAsync(3000)));
    expect(stage.textContent).toContain('Notes stopped answering for 1 seconds');
  });

  it('moves only inside the app, and takes no function across to another app or the page', async () => {
    const stub = stubApp((self, method) => {
      if (method !== 'start') return;
      self.post('navigate', '/../admin/people');
      self.post('navigate', '/%2e%2e/admin');
      self.post('navigate', '/notebooks/7');
      return self.call('raise', { type: 'note.share', payload: { id: 'n1', run: () => 'called' } });
    });
    const ctx = ctxFor();
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctx));
    await flush();
    await flush();
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).toHaveBeenCalledWith('/notebooks/7');
    const raised = (ctx.raise as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { payload: Record<string, unknown> };
    expect(raised.payload.id).toBe('n1');
    expect(raised.payload.run).toBeUndefined();
  });

  it('keeps what sits under a place only for a place that fills, with paths inside the app', async () => {
    let self!: Channel;
    const stub = stubApp((app, method) => {
      self = app;
      if (method === 'start') app.mutate('screen', [notice('n1', 'Ready')]);
    });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    self.post('frame.under', 'home', [{ label: 'Nope', path: '/x' }]);
    self.post('frame.under', 'notebooks', [{ label: 'Work', path: '/notebooks/1' }, { label: 'Out', path: '/../admin' }]);
    await flush();
    const under = mounter.session!.state.under;
    expect(under.has('home')).toBe(false);
    expect(under.get('notebooks')!.map((i) => i.label)).toEqual(['Work']);
  });

  it('tells the rail what sits under each place, for the app it is', async () => {
    let self!: Channel;
    const seen: [string, Record<string, unknown[]>][] = [];
    const stub = stubApp((app, method) => {
      self = app;
      if (method === 'start') app.mutate('screen', [notice('n1', 'Ready')]);
    });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker, onUnder: (id, under) => seen.push([id, under]) });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    self.post('frame.under', 'notebooks', [{ label: 'Work', path: '/notebooks/1' }]);
    await flush();
    expect(seen.at(-1)).toEqual(['notes', { notebooks: [{ label: 'Work', path: '/notebooks/1' }] }]);
  });

  it('answers a stopping app nothing', async () => {
    let self!: Channel;
    const stub = stubApp((app, method) => {
      self = app;
      if (method === 'start') app.mutate('screen', [notice('n1', 'Ready')]);
      if (method === 'stop') return new Promise(() => undefined);
    });
    const ctx = ctxFor();
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctx));
    await flush();
    act(() => mounter.unmount());
    self.post('navigate', '/notebooks');
    self.post('notify', { title: 'Still here' });
    await flush();
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.notify).not.toHaveBeenCalled();
  });
});

describe('files and the canvas', () => {
  const filer: WorkerApp = fromCatalogue3({ ...manifest, maxUpload: 1, contributes: { ...manifest.contributes, canvas: true } });
  const wire = (body: ArrayBuffer | string, path = '/api/notes/v1/files') => ({ path, method: 'POST', headers: [['content-type', 'text/plain']], body });
  const start = (target: WorkerApp = filer, over: Partial<WorkerContext> = {}) => {
    let self!: Channel;
    const dropped: unknown[] = [];
    const stub = stubApp((app, method, args) => {
      self = app;
      if (method === 'start') app.mutate('screen', [notice('n1', 'Ready')]);
      if (method === 'drop') dropped.push(...(args[0] as unknown[]));
    });
    const ctx = ctxFor(over);
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(target, ctx));
    return { self: () => self, ctx, dropped };
  };
  const fetched = (ctx: WorkerContext) => (ctx.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;

  it('uploads the bytes the worker sends with the person’s token and the app’s id, intact', async () => {
    const { self, ctx } = start();
    await flush();
    const bytes = new Uint8Array([1, 2, 3, 250]).buffer;
    const answer = (await self().call('files.upload', wire(bytes))) as { status: number };
    expect(answer.status).toBe(200);
    const [path, init] = fetched(ctx)[0]!;
    expect(path).toBe('/api/notes/v1/files');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer the-token');
    expect(new Headers(init.headers).get('x-augur-app')).toBe('notes');
    expect([...new Uint8Array(init.body as ArrayBuffer)]).toEqual([1, 2, 3, 250]);
  });

  it('answers an upload past the app’s limit as the gateway would, without sending it', async () => {
    const { self, ctx } = start();
    await flush();
    const answer = (await self().call('files.upload', wire(new ArrayBuffer(2 * 1024 * 1024)))) as { status: number; body: ArrayBuffer };
    expect(answer.status).toBe(413);
    expect(JSON.parse(new TextDecoder().decode(answer.body))).toEqual({ error: 'too_large', message: 'This is more than Notes takes at once (1 MB).' });
    expect(fetched(ctx)).toEqual([]);
  });

  it('saves a download for the person when the app asks, and hands it the bytes otherwise', async () => {
    const fetchImpl = vi.fn(async () => new Response('file body', { headers: { 'content-type': 'text/plain', 'content-disposition': 'attachment; filename="notes.txt"' } })) as unknown as typeof fetch;
    const { self } = start(filer, { fetchImpl });
    await flush();
    const made: Blob[] = [];
    Object.assign(URL, { createObjectURL: (b: Blob) => (made.push(b), 'blob:saved'), revokeObjectURL: () => undefined });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    expect(await self().call('files.download', '/api/notes/v1/files/1', { save: true })).toBeUndefined();
    expect(clicked[0]?.download).toBe('notes.txt');
    expect(await made[0]!.text()).toBe('file body');
    const got = (await self().call('files.download', '/api/notes/v1/files/1')) as { status: number; body: ArrayBuffer };
    expect(new TextDecoder().decode(got.body)).toBe('file body');
    await expect(self().call('files.download', 'https://example.org/x')).rejects.toThrow();
  });

  it('takes files dropped on the pane only once the app has a handler, and hands it their bytes', async () => {
    const { self, dropped } = start();
    await flush();
    const pane = () => stage.querySelector('.app-pane')!;
    const drop = (files: File[]) => {
      const e = Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer: { files, types: ['Files'] } });
      act(() => void pane().dispatchEvent(e));
      return e;
    };
    expect(drop([new File(['A'], 'a.txt', { type: 'text/plain' })]).defaultPrevented).toBe(false);
    self().post('files.drops', true);
    await flush();
    expect(drop([new File(['A'], 'a.txt', { type: 'text/plain' })]).defaultPrevented).toBe(true);
    await flush();
    await flush();
    expect(dropped).toMatchObject([{ name: 'a.txt', type: 'text/plain' }]);
    expect(new TextDecoder().decode((dropped[0] as { bytes: ArrayBuffer }).bytes)).toBe('A');
  });

  it('hands a file button’s files to the app as a drop, and says it can’t take them before the app has a handler', async () => {
    const { self, dropped } = start();
    await flush();
    self().mutate('screen', [[0, '~', { id: 'b1', type: 1, element: 'quill-file-button', properties: { label: 'Add a document' }, attributes: {}, eventListeners: {}, children: [] }, 1]]);
    await flush();
    expect(stage.textContent).toContain('This screen can’t take files from here.');
    self().post('files.drops', true);
    await flush();
    expect(stage.textContent).not.toContain('This screen can’t take files from here.');
    const input = stage.querySelector<HTMLInputElement>('.quill-file-button input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['B'], 'berth.pdf', { type: 'application/pdf' })], configurable: true });
    act(() => void input.dispatchEvent(new Event('change', { bubbles: true })));
    await flush();
    await flush();
    expect(dropped).toMatchObject([{ name: 'berth.pdf', type: 'application/pdf' }]);
  });

  it('fetches a reader’s pictures itself, only under the app’s own API, and frees them when the app stops', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch;
    const made: string[] = [];
    const freed: string[] = [];
    Object.assign(URL, { createObjectURL: () => (made.push(`blob:p${made.length}`), made[made.length - 1]!), revokeObjectURL: (u: string) => void freed.push(u) });
    const { self, ctx } = start(filer, { fetchImpl });
    await flush();
    const markdown = 'Text.\n\n![Plan](documents/d1/pictures/plan.png)\n\n![Away](https://evil.example/x.png)\n\n![Up](../admin/x.png)';
    self().mutate('screen', [[0, '~', { id: 'r1', type: 1, element: 'quill-reader', properties: { markdown }, attributes: {}, eventListeners: {}, children: [] }, 1]]);
    for (let i = 0; i < 20 && stage.querySelectorAll('.quill-reader-missing').length < 2; i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
    const calls = fetched(ctx);
    expect(calls.map(([path]) => path)).toEqual(['/api/notes/documents/d1/pictures/plan.png']);
    expect(new Headers(calls[0]![1].headers).get('authorization')).toBe('Bearer the-token');
    expect(new Headers(calls[0]![1].headers).get('x-augur-app')).toBe('notes');
    expect(stage.querySelector('.quill-reader img')?.getAttribute('src')).toBe('blob:p0');
    expect(stage.querySelectorAll('.quill-reader-missing')).toHaveLength(2);
    act(() => mounter.unmount());
    await flush();
    expect(freed).toEqual(['blob:p0']);
  });

  it('opens the canvas as a sandboxed frame with an opaque origin in place of the screen, and stops it with the app', async () => {
    const { self } = start();
    await flush();
    const port = await self().call('canvas.open', 'canvas.js');
    expect((port as object).constructor.name).toBe('MessagePort');
    await flush();
    const frame = stage.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('src')).toBe('/sandbox/canvas.html');
    expect(frame.title).toBe('Notes');
    await expect(self().call('canvas.open', '../admin.js')).rejects.toThrow(/inside its bundle/);
    // Opened again over the first: a new frame, which loads afresh for its new port.
    const first = stage.querySelector('iframe');
    await self().call('canvas.open', 'canvas.js');
    await flush();
    expect(stage.querySelector('iframe')).not.toBe(first);
    self().post('canvas.close');
    await flush();
    expect(stage.querySelector('iframe')).toBeNull();
    await self().call('canvas.open', 'canvas.js');
    await flush();
    expect(stage.querySelector('iframe')).not.toBeNull();
    act(() => mounter.unmount());
    expect(stage.querySelector('iframe')).toBeNull();
  });

  it('refuses a canvas to an app that doesn’t declare one', async () => {
    const { self } = start(app);
    await flush();
    await expect(self().call('canvas.open', 'canvas.js')).rejects.toThrow(/doesn’t declare a canvas/);
  });
});

describe('the frame round an app’s pane', () => {
  const framed: WorkerApp = fromCatalogue3({
    ...manifest,
    contributes: {
      ...manifest.contributes,
      commands: [{ id: 'note.new', label: 'New note' }, { id: 'note.pin', label: 'Pin note' }],
      radial: [{ command: 'note.pin', on: 'note' }],
      about: [{ id: 'details', label: 'Details' }, { id: 'history', label: 'History' }],
    },
  });
  const run = (onCommand: (id: string, detail: unknown) => void = () => undefined) => {
    let self!: Channel;
    const stub = stubApp((app, method, args) => {
      self = app;
      if (method === 'start') app.mutate('screen', [notice('n1', 'Ready')]);
      if (method === 'command') onCommand(String(args[0]), args[1]);
    });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(framed, ctxFor()));
    return () => self;
  };
  const press = (init: KeyboardEventInit) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })));
  const option = (label: string) => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes(label)) as HTMLElement | undefined;

  it('opens the command palette on its key, keeping a command the app hasn’t loaded locked with why, and runs one it has', async () => {
    const ran: string[] = [];
    const self = run((id) => ran.push(id));
    await flush();
    press({ key: 'P', ctrlKey: true, shiftKey: true });
    await flush();
    expect(option('New note')?.textContent).toContain('Notes hasn’t loaded this yet');
    self().post('commands', ['note.new']);
    await flush();
    expect(option('New note')?.textContent).not.toContain('hasn’t loaded');
    act(() => option('New note')!.click());
    await flush();
    expect(ran).toEqual(['note.new']);
    expect(option('New note')).toBeUndefined();
  });

  it('takes the palette key only in the pane in front, and the second key by its place, as a Mac’s Option changes the letter', async () => {
    run();
    await flush();
    stage.setAttribute('aria-hidden', 'true');
    press({ key: 'P', ctrlKey: true, shiftKey: true });
    await flush();
    expect(option('New note')).toBeUndefined();
    stage.removeAttribute('aria-hidden');
    press({ key: '∏', code: 'KeyP', altKey: true, shiftKey: true });
    await flush();
    expect(option('New note')).toBeDefined();
  });

  it('offers no palette for an app that stopped: its pane says why and offers Try again', async () => {
    const stub = stubApp((_, method) => {
      if (method === 'start') throw new Error('Broken.');
    });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(framed, ctxFor()));
    await flush();
    expect(stage.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('failed');
    press({ key: 'P', ctrlKey: true, shiftKey: true });
    await flush();
    expect(option('New note')).toBeUndefined();
  });

  it('opens the radial menu on a thing the app marked, and sends the command with the thing', async () => {
    const ran: [string, unknown][] = [];
    const self = run((id, detail) => ran.push([id, detail]));
    await flush();
    self().post('commands', ['note.pin']);
    await flush();
    // The app marks a list item as a note; Quill's receiver draws its kind, id and name on the row.
    self().mutate('screen', [[0, '~', { id: 'l1', type: 1, element: 'quill-list', properties: { label: 'Notes', items: [{ id: 'n7', title: 'Shopping list', thing: { kind: 'note' } }] }, attributes: {}, eventListeners: {}, children: [] }, 1]]);
    await flush();
    const thing = stage.querySelector<HTMLElement>('[data-thing="note"]')!;
    act(() => void thing.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })));
    await flush();
    const pin = [...document.querySelectorAll('button, [role="menuitem"]')].find((b) => b.textContent?.includes('Pin note')) as HTMLElement;
    act(() => pin.click());
    // The ring leaves before the command goes.
    await act(async () => void (await new Promise((r) => setTimeout(r, 500))));
    expect(ran).toEqual([['note.pin', { thing: { kind: 'note', id: 'n7', label: 'Shopping list' } }]]);
  });

  it('draws the app’s sections in the pane at the edge, each saying so until the app fills it', async () => {
    const slot = drawSlot();
    const self = run();
    await flush();
    const pane = slot.querySelector('.aerie-pane')!;
    expect(pane.querySelector('.test-clock')).not.toBeNull();
    const titles = [...pane.querySelectorAll<HTMLButtonElement>('.aerie-pane-title')];
    expect(titles.map((t) => t.textContent)).toEqual(['Details', 'History']);
    act(() => titles[0]!.click());
    await flush();
    expect(pane.textContent).toContain('Nothing here yet');
    self().mutate('about:details', [notice('d1', 'Made by Ada')]);
    await flush();
    expect(pane.textContent).toContain('Made by Ada');
    expect(stage.querySelector('.aerie-pane')).toBeNull();
  });

  it('draws no pane while the Shell has no slot for one', async () => {
    run();
    await flush();
    expect(document.querySelector('.aerie-pane')).toBeNull();
  });

  it('lays the pane out as the manifest says until a page sets another layout, keeping only the names the shell knows', async () => {
    let self!: Channel;
    const stub = stubApp((a, method) => {
      self = a;
      if (method === 'start') a.mutate('screen', [notice('n1', 'Ready')]);
    });
    const split = fromCatalogue3({ ...manifest, contributes: { ...manifest.contributes, about: [{ id: 'details', label: 'Details' }], frame: { layout: 'split', density: 'compact' } } });
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(split, ctxFor()));
    await flush();
    const pane = () => stage.querySelector<HTMLElement>('.app-frame')!;
    expect([pane().dataset.layout, pane().dataset.density, pane().dataset.inset]).toEqual(['split', 'compact', 'standard']);
    self.post('frame.set', { layout: 'aside', inset: 'flush', width: 'wide' });
    await flush();
    expect([pane().dataset.layout, pane().dataset.inset]).toEqual(['aside', 'flush']);
    expect(stage.querySelector('[data-width]')?.getAttribute('data-width')).toBe('wide');
    // A layout the shell doesn't know is left out, so the manifest's default stands.
    self.post('frame.set', { layout: 'three-column', density: '4px' });
    await flush();
    expect([pane().dataset.layout, pane().dataset.density]).toEqual(['split', 'compact']);
  });

  it('defaults to one column, with sections or without: the sections are in the pane at the edge', async () => {
    run();
    await flush();
    expect(stage.querySelector<HTMLElement>('.app-frame')!.dataset.layout).toBe('focus');
    act(() => mounter.unmount());
    const stub = stubApp((self, method) => method === 'start' && self.mutate('screen', [notice('n1', 'Ready')]));
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    expect(stage.querySelector<HTMLElement>('.app-frame')!.dataset.layout).toBe('focus');
  });

  it('keeps the pane’s strip, with no titles, for an app that declares no sections', async () => {
    const slot = drawSlot();
    const stub = stubApp((self, method) => method === 'start' && self.mutate('screen', [notice('n1', 'Ready')]));
    mounter = new WorkerMounter(stage, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void mounter.mount(app, ctxFor()));
    await flush();
    expect(slot.querySelector('.aerie-pane')).not.toBeNull();
    expect(slot.querySelector('.aerie-pane-title')).toBeNull();
  });
});

describe('an app’s card on Home', () => {
  const withCard = fromCatalogue3({ ...manifest, floors: ['personal'], contributes: { ...manifest.contributes, card: true } });

  it('is offered on the floors the app is on, and shows only what the app draws into its card', async () => {
    expect(withCard.surfaces).toEqual([{ floor: 'personal', slot: 'card', module: 'card' }]);
    const stub = stubApp((self, method) => {
      if (method !== 'start') return;
      self.mutate('screen', [notice('s1', 'The whole screen')]);
      self.mutate('card', [notice('c1', 'Three to check')]);
    });
    const el = document.createElement('div');
    stage.append(el);
    const card = workerCard(withCard, ctxFor(), { createWorker: () => stub.worker as unknown as Worker });
    act(() => void card.mount(el, {} as never));
    await flush();
    expect(await card.shown).toBe(true);
    expect(el.textContent).toContain('Three to check');
    expect(el.textContent).not.toContain('The whole screen');
    act(() => void card.unmount!(el));
    await flush();
    expect(el.textContent).toBe('');
  });

  it('says so in the card when the app stops after drawing it, never leaving it blank', async () => {
    const stub = stubApp((self, method) => method === 'start' && self.mutate('card', [notice('c1', 'Three to check')]));
    const el = document.createElement('div');
    stage.append(el);
    const card = workerCard(withCard, ctxFor(), { createWorker: () => stub.worker as unknown as Worker });
    act(() => void card.mount(el, {} as never));
    await flush();
    act(() => void stub.worker.dispatchEvent(Object.assign(new Event('error'), { message: 'boom' })));
    expect(el.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('failed');
    expect(el.textContent).toContain('Notes stopped');
    act(() => void card.unmount!(el));
    expect(stub.worker.terminated).toBe(true);
  });

  it('moves the person or opens another app only just after a press in the card', async () => {
    let self!: Channel;
    const stub = stubApp((app, method, args) => {
      self = app;
      if (method === 'start') {
        expect((args[0] as { surface?: string }).surface).toBe('card');
        app.mutate('card', [notice('c1', 'Three to check')]);
      }
    });
    const ctx = ctxFor();
    const el = document.createElement('div');
    stage.append(el);
    const card = workerCard(withCard, ctx, { createWorker: () => stub.worker as unknown as Worker });
    act(() => void card.mount(el, {} as never));
    await flush();
    self.post('navigate', '/notebooks');
    self.post('signInAgain');
    await expect(self.call('raise', { type: 'note.share' })).rejects.toThrow(/only when someone presses something/);
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.signInAgain).not.toHaveBeenCalled();
    el.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    self.post('navigate', '/notebooks');
    self.post('signInAgain');
    await flush();
    expect(ctx.navigate).toHaveBeenCalledWith('/notebooks');
    expect(ctx.signInAgain).toHaveBeenCalledTimes(1);
    act(() => void card.unmount!(el));
  });

  it('isn’t shown when the app fails before drawing it', async () => {
    const stub = stubApp();
    const el = document.createElement('div');
    stage.append(el);
    const card = workerCard(withCard, ctxFor(), { createWorker: () => stub.worker as unknown as Worker });
    act(() => void card.mount(el, {} as never));
    await flush();
    act(() => void stub.worker.dispatchEvent(new Event('error')));
    expect(await card.shown).toBe(false);
    act(() => void card.unmount!(el));
  });
});

describe('a path an app may move to', () => {
  it('stays below the app', () => {
    expect(inAppPath('/notebooks/7?tab=a')).toBe(true);
    for (const bad of ['notebooks', '//evil.example', '/../admin', '/a/%2E%2E/b', '/a/./b', '/a\\b', '/a/%2fb', '/a/%zz']) expect(inAppPath(bad)).toBe(false);
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

  it('refuses a change that would make its count and the drawing differ', () => {
    const budget = () => new NodeBudget({ perFlush: 10, live: 100 });
    const one = (id: string) => ({ id });
    expect(budget().take('screen', [[0, '~', one('a'), 0], [0, '~', one('a'), 0]])).toMatchObject({ kind: 'malformed' });
    expect(budget().take('screen', [[0, '~', one('a'), 'first']])).toMatchObject({ kind: 'malformed' });
    expect(budget().take('screen', [[0, '~', one('a'), 3]])).toMatchObject({ kind: 'malformed' });
    expect(budget().take('screen', [[0, 'nowhere', one('a'), 0]])).toMatchObject({ kind: 'malformed' });
    expect(budget().take('screen', [[1, '~', 0]])).toMatchObject({ kind: 'malformed' });
    expect(budget().take('screen', [[0, '~', { id: 'a', children: [one('b'), one('b')] }, 0]])).toMatchObject({ kind: 'malformed' });
  });

  it('counts every message and record against a second’s rate', () => {
    let now = 0;
    const rate = new RateBudget(10, () => now);
    expect(rate.take(6)).toBeUndefined();
    expect(rate.take(5)).toEqual({ kind: 'rate', nodes: 11, limit: 10 });
    now = 1000;
    expect(rate.take(10)).toBeUndefined();
  });
});
