/**
 * The host for apps on the app contract (spec 6.5 to 6.14, ADR 0076): each app's frontend runs in a
 * web worker with no DOM and no network, one worker per app, and describes its screen in Quill's
 * remote vocabulary. The host draws what it describes with the real kit (only the vocabulary passes,
 * P6a), makes every call for it with the person's token, the floor and the app's header, and owns
 * the pane: its heading, its actions and its states. An app that fails, hangs or draws past its
 * budget stops only its own pane.
 */
import { PageHead, QuillRemote, State, createQuillReceiver, type QuillReceiver } from '@augur/app-kit';
import type { Intent, IntentReply, NotifyMessage } from '@augur/mfe-sdk';
import type { FrameState, Person, PlaceItem, Workspace } from '@augur/mfe-sdk/sdk3';
import { CARD_ROOT, Channel, SCREEN_ROOT, aboutRoot, isHostHeader, pathProblem, responseToWire, type Message, type Port, type StartInit, type WireRequest } from '@augur/mfe-sdk/sdk3/host';
import { createRoot, type Root } from 'react-dom/client';
import { useSyncExternalStore } from 'react';
import { DEFAULT_BUDGETS, NodeBudget, RateBudget, type Budgets, type Overrun } from './budget.js';
import { actionsOf, type WorkerApp } from './apps3.js';

/** The header that names the app a call is made for (contract 3); the gateway checks it against the app's grants. */
export const APP_HEADER = 'x-augur-app';
export const WORKSPACE_HEADER = 'x-workspace-id';

/** What the shell gives an app's worker: who and where, and the shell's own ways to do what the app asks. */
export interface WorkerContext {
  person: Person;
  workspace: Workspace;
  /** Below `/<id>`. */
  path: string;
  intent?: Intent;
  reply?: IntentReply;
  getToken(): Promise<string>;
  fetchImpl: typeof fetch;
  /** Moves to `path` below `/<id>`. */
  navigate(path: string): void;
  notify(message: NotifyMessage): void;
  raise(intent: Intent): Promise<void>;
  request(intent: Intent): Promise<unknown>;
}

/** Where the pane is: opening, slow to open, open, or stopped with why. */
export type Phase = 'opening' | 'slow' | 'open' | 'failed' | 'unresponsive';

export interface PaneState {
  phase: Phase;
  /** Why it failed or was stopped, in a sentence the person can act on. */
  reason?: string;
  frame: FrameState;
  /** The commands the app handles now. */
  handled: ReadonlySet<string>;
  /** What sits under each place that fills (spec 6.3), as the app last said. */
  under: ReadonlyMap<string, PlaceItem[]>;
}

export interface WorkerHostOptions {
  /** Makes the app's worker; the shell's bootstrap by default. Tests stand in for it. */
  createWorker?: (app: WorkerApp) => Worker;
  budgets?: Partial<Budgets>;
}

const defaultWorker = (app: WorkerApp) => new Worker(new URL('../sandbox/worker.ts', import.meta.url), { type: 'module', name: `app ${app.id}` });

/** How long the app's own stop gets before its worker is ended anyway. */
const STOP_GRACE_MS = 1000;

/** The most items one place may hold under it; the rail shows fewer and says how many more. */
const UNDER_MAX = 200;

const WIDTHS = new Set(['read', 'wide', 'full']);
const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

/**
 * A path the app may move to: below its own `/<id>`, so never a dot segment that would climb out of
 * it (`/../admin`, `%2e%2e` too), a backslash or a second slash at the start.
 */
export function inAppPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length > 2000 || !path.startsWith('/') || path.startsWith('//') || path.includes('\\') || [...path].some((c) => c.charCodeAt(0) < 0x20)) return false;
  const pathname = path.split(/[?#]/, 1)[0]!;
  for (const segment of pathname.split('/')) {
    let plain: string;
    try {
      plain = decodeURIComponent(segment);
    } catch {
      return false;
    }
    if (plain === '.' || plain === '..' || plain.includes('/') || plain.includes('\\')) return false;
  }
  return true;
}

/** What `ctx.frame.set` may change, kept to its shape: anything else the app sends is left out. */
function frameFrom(was: FrameState, v: unknown): FrameState {
  if (!isPlain(v)) return was;
  const next: FrameState = { ...was };
  if ('title' in v) next.title = text(v.title, 120);
  if ('busy' in v) next.busy = v.busy === true;
  if ('width' in v) next.width = typeof v.width === 'string' && WIDTHS.has(v.width) ? (v.width as FrameState['width']) : undefined;
  if ('actions' in v)
    next.actions = Array.isArray(v.actions)
      ? v.actions.filter(isPlain).slice(0, 8).flatMap((a) => (typeof a.command === 'string' ? [{ command: a.command, label: text(a.label, 60), unavailable: text(a.unavailable, 200) }] : []))
      : undefined;
  return next;
}

/**
 * One app's run in a worker: its bridge, the receiver its screen draws from, its budget, its timers
 * and the pane's state. Starting again (Try again, a new floor) makes a new worker and keeps nothing.
 */
export class AppSession {
  readonly screen: QuillReceiver = createQuillReceiver();
  #state: PaneState = { phase: 'opening', frame: {}, handled: new Set(), under: new Map() };
  readonly #listeners = new Set<() => void>();
  readonly #budgets: Budgets;
  #worker: Worker | undefined;
  #channel: Channel | undefined;
  #budget: NodeBudget;
  #rate: RateBudget;
  /** Set once the run is ending: the worker is answered nothing more. */
  #stopping = false;
  /** When the host's check went unanswered since, after first paint. */
  #pinged: number | undefined;
  #timers: ReturnType<typeof setTimeout>[] = [];
  #receivers = new Map<string, QuillReceiver>();
  #ctx: WorkerContext;

  constructor(
    readonly app: WorkerApp,
    ctx: WorkerContext,
    private readonly makeWorker: (app: WorkerApp) => Worker = defaultWorker,
    budgets: Partial<Budgets> = {},
  ) {
    this.#ctx = ctx;
    this.#budgets = { ...DEFAULT_BUDGETS, ...budgets };
    this.#budget = new NodeBudget(this.#budgets);
    this.#rate = new RateBudget(this.#budgets.perSecond);
    this.#receivers.set(SCREEN_ROOT, this.screen);
  }

  get state() {
    return this.#state;
  }

  subscribe = (fn: () => void) => {
    this.#listeners.add(fn);
    return () => void this.#listeners.delete(fn);
  };

  #set(patch: Partial<PaneState>) {
    this.#state = { ...this.#state, ...patch };
    for (const fn of [...this.#listeners]) fn();
  }

  /** Stops the app with a reason: only its pane shows it, and the person can try again. */
  #fail(phase: 'failed' | 'unresponsive', reason: string) {
    if (this.#state.phase === 'failed' || this.#state.phase === 'unresponsive') return;
    this.#end();
    this.#set({ phase, reason });
  }

  start() {
    const app = this.app;
    let worker: Worker;
    try {
      worker = this.makeWorker(app);
    } catch {
      this.#set({ phase: 'failed', reason: `${app.name} couldn’t start here. Nothing was lost; try again.` });
      return;
    }
    this.#worker = worker;
    // Functions cross only as an element's listeners; everything the worker sends counts against its rate.
    const channel = new Channel(worker as unknown as Port, (method, args) => this.#answer(method, args), { functions: 'mutate', admit: (m) => this.#admit(m) });
    this.#channel = channel;
    channel.onMutate = (root, records) => this.#draw(root, records);
    worker.addEventListener('error', (e) => {
      e.preventDefault?.();
      this.#fail('failed', `${app.name} stopped answering${e.message ? ` (${e.message})` : ''}. Nothing was lost; try again.`);
    });
    worker.addEventListener('messageerror', () => this.#fail('failed', `${app.name} sent the shell something it couldn’t read. Nothing was lost; try again.`));
    this.#timers.push(
      setTimeout(() => this.#state.phase === 'opening' && this.#set({ phase: 'slow' }), this.#budgets.slowMs),
      setTimeout(() => {
        if (this.#state.phase === 'opening' || this.#state.phase === 'slow') this.#fail('failed', `${app.name} didn’t open in ${Math.round(this.#budgets.failMs / 1000)} seconds. Nothing was lost; try again.`);
      }, this.#budgets.failMs),
    );
    const ctx = this.#ctx;
    const init: StartInit = {
      entry: app.entry,
      person: { id: ctx.person.id, name: ctx.person.name },
      workspace: { id: ctx.workspace.id, kind: ctx.workspace.kind, name: ctx.workspace.name },
      path: ctx.path,
      previewsOn: app.previewsOn ?? [],
      ...(ctx.intent ? { intent: ctx.intent } : {}),
      ...(ctx.reply ? { replying: true } : {}),
    };
    channel.call('start', init).catch((err: Error) => this.#fail('failed', `${app.name} couldn’t open: ${err.message} Nothing was lost; try again.`));
  }

  /** Tells the running app it moved, without starting it again (spec 6.12). */
  navigated(path: string) {
    this.#ctx = { ...this.#ctx, path };
    this.#channel?.post('navigate', path);
  }

  /** The person chose one of the app's commands: the pane's action, and later the palette and the radial menu. */
  command(id: string, detail?: unknown) {
    if (!this.#state.handled.has(id)) return;
    this.#channel?.call('command', id, detail).catch((err: Error) => this.#ctx.notify({ title: `${this.app.name} couldn’t do that: ${err.message}` }));
  }

  /** Ends the run, giving the app's own stop a moment first. Meanwhile it is answered nothing. */
  async stop() {
    this.#stopping = true;
    const channel = this.#channel;
    if (channel && this.#state.phase !== 'failed' && this.#state.phase !== 'unresponsive') {
      await Promise.race([channel.call('stop').catch(() => undefined), new Promise((r) => setTimeout(r, STOP_GRACE_MS))]);
    }
    this.#end();
  }

  #end() {
    this.#stopping = true;
    for (const t of this.#timers) clearTimeout(t);
    this.#timers = [];
    this.#channel?.close();
    this.#channel = undefined;
    this.#worker?.terminate();
    this.#worker = undefined;
  }

  /** Counts each message against the app's rate; past it, the app is stopped and the message dropped. */
  #admit(m: Message): boolean {
    if (this.#stopping) return m.kind === 'answer';
    const over = this.#rate.take(m.kind === 'mutate' && Array.isArray(m.records) ? 1 + m.records.length : 1);
    if (!over) return true;
    this.#fail('unresponsive', overrunReason(this.app.name, over));
    return false;
  }

  /** The roots an app may draw into: its screen, and its card and About sections when its manifest has them. */
  #rootAllowed(root: string) {
    const c = this.app.manifest.contributes;
    return root === SCREEN_ROOT || (root === CARD_ROOT && c?.card === true) || (c?.about ?? []).some((a) => aboutRoot(a.id) === root);
  }

  #draw(root: string, records: unknown[]) {
    if (this.#stopping || this.#state.phase === 'failed' || this.#state.phase === 'unresponsive') return;
    if (!this.#rootAllowed(root)) return;
    const over = this.#budget.take(root, records);
    if (over) return this.#fail('unresponsive', overrunReason(this.app.name, over));
    let receiver = this.#receivers.get(root);
    // About sections and the card are kept as the app draws them, for when the shell shows them.
    if (!receiver) this.#receivers.set(root, (receiver = createQuillReceiver()));
    receiver.connection.mutate(records);
    if (root === SCREEN_ROOT && (this.#state.phase === 'opening' || this.#state.phase === 'slow')) {
      for (const t of this.#timers) clearTimeout(t);
      this.#timers = [];
      this.#set({ phase: 'open' });
      this.#watch();
    }
  }

  /**
   * Once open, the host asks now and then whether the app still answers (spec 6.13). A worker stuck
   * in a loop answers nothing: past `hangMs` it is stopped, and only its pane says so.
   */
  #watch() {
    const every = Math.max(250, Math.floor(this.#budgets.hangMs / 2));
    const check = () => {
      if (this.#stopping) return;
      const now = Date.now();
      if (this.#pinged !== undefined && now - this.#pinged >= this.#budgets.hangMs) {
        return this.#fail('unresponsive', `${this.app.name} stopped answering for ${Math.round(this.#budgets.hangMs / 1000)} seconds, so it was stopped. Nothing was lost; try again.`);
      }
      if (this.#pinged === undefined) {
        this.#pinged = now;
        this.#channel?.call('ping').then(
          () => (this.#pinged = undefined),
          () => undefined,
        );
      }
      this.#timers.push(setTimeout(check, every));
    };
    this.#timers.push(setTimeout(check, every));
  }

  /** What the app asks for over the bridge. Its id is never taken from the worker: it is this session's. */
  async #answer(method: string, args: unknown[]): Promise<unknown> {
    if (this.#stopping) throw new Error('The app is stopping.');
    const ctx = this.#ctx;
    switch (method) {
      case 'fetch':
        return this.#fetch(args[0]);
      case 'navigate': {
        if (inAppPath(args[0])) ctx.navigate(args[0]);
        return;
      }
      case 'notify': {
        const n = args[0];
        if (isPlain(n) && typeof n.title === 'string') ctx.notify({ title: n.title.slice(0, 200), body: text(n.body, 1000), kind: text(n.kind, 60), needsYou: n.needsYou === true });
        return;
      }
      case 'raise':
        return ctx.raise(intentOf(args[0]));
      case 'request':
        return ctx.request(intentOf(args[0]));
      case 'reply.respond':
        return ctx.reply?.respond(args[0]);
      case 'reply.cancel':
        return ctx.reply?.cancel();
      case 'frame.set':
        return this.#set({ frame: frameFrom(this.#state.frame, args[0]) });
      case 'frame.under': {
        const [place, items] = args;
        // Only a place the manifest says fills, with items that lead somewhere inside the app.
        const fills = (this.app.manifest.contributes?.places ?? []).some((p) => p.id === place && p.fills === true);
        if (typeof place !== 'string' || !fills || !Array.isArray(items)) return;
        const under = new Map(this.#state.under);
        under.set(
          place,
          items
            .filter(isPlain)
            .filter((i) => typeof i.label === 'string' && (i.path === undefined || inAppPath(i.path)))
            .slice(0, UNDER_MAX)
            .map((i) => ({ label: text(i.label, 80)!, icon: text(i.icon, 40), detail: text(i.detail, 80), path: text(i.path, 200) ?? '/' })),
        );
        return this.#set({ under });
      }
      case 'commands': {
        const declared = new Set((this.app.manifest.contributes?.commands ?? []).map((c) => c.id));
        const ids = Array.isArray(args[0]) ? args[0].filter((id): id is string => typeof id === 'string' && declared.has(id)) : [];
        return this.#set({ handled: new Set(ids) });
      }
      default:
        throw new Error(`The shell doesn’t answer ${String(method).slice(0, 40)}.`);
    }
  }

  /** `ctx.fetch`, made by the host: a path under /api/ on this origin, with the token, the floor and the app (spec 6.6, 6.14). */
  async #fetch(wire: unknown) {
    if (!isPlain(wire)) throw new TypeError('ctx.fetch sent something the shell couldn’t read.');
    const { path, method, headers, body } = wire as unknown as WireRequest;
    const problem = pathProblem(path);
    if (problem) throw new TypeError(problem);
    const ctx = this.#ctx;
    const sent = new Headers();
    if (Array.isArray(headers)) for (const pair of headers) if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string' && !isHostHeader(pair[0])) sent.append(pair[0], pair[1]);
    sent.set('authorization', `Bearer ${await ctx.getToken()}`);
    sent.set(WORKSPACE_HEADER, ctx.workspace.id);
    sent.set(APP_HEADER, this.app.id);
    const verb = typeof method === 'string' && /^[A-Z]{3,7}$/.test(method) ? method : 'GET';
    const res = await ctx.fetchImpl(path, {
      method: verb,
      headers: sent,
      body: verb === 'GET' || verb === 'HEAD' ? undefined : typeof body === 'string' || body instanceof ArrayBuffer ? body : undefined,
      credentials: 'omit',
      // A redirect would be followed with the token: the gateway answers, or the call fails.
      redirect: 'error',
    });
    return responseToWire(res);
  }
}

const intentOf = (v: unknown): Intent => {
  if (!isPlain(v) || typeof v.type !== 'string') throw new TypeError('An intent needs a type, such as document.open.');
  return { type: v.type, payload: v.payload ?? {} };
};

const overrunReason = (name: string, over: Overrun) => {
  switch (over.kind) {
    case 'flush':
      return `${name} tried to draw ${over.nodes.toLocaleString()} things at once, more than the ${over.limit.toLocaleString()} the shell takes in one go, so it was stopped. Its team can send long lists as rows. Nothing was lost; try again.`;
    case 'live':
      return `${name} kept ${over.nodes.toLocaleString()} things on screen, more than the ${over.limit.toLocaleString()} the shell keeps for one app, so it was stopped. Nothing was lost; try again.`;
    case 'rate':
      return `${name} sent the shell more than ${over.limit.toLocaleString()} changes in a second, so it was stopped. Nothing was lost; try again.`;
    case 'malformed':
      return `${name} sent ${over.problem}, so it was stopped. Its team needs to fix it. Nothing was lost; try again.`;
  }
};

/** The pane: the heading the shell draws from what the app set, and the app's screen or why it isn't there. */
export function AppPane({ session, onRetry }: { session: AppSession; onRetry: () => void }) {
  const state = useSyncExternalStore(session.subscribe, () => session.state);
  const { app } = session;
  const stopped = state.phase === 'failed' || state.phase === 'unresponsive';
  const actions = stopped ? [] : actionsOf(app, state.frame.actions, state.handled);
  return (
    <section className="app-pane" data-app={app.id} data-width={state.frame.width ?? 'read'} data-phase={state.phase} aria-busy={state.frame.busy || state.phase === 'opening' || state.phase === 'slow'}>
      <PageHead heading={state.frame.title || app.name} actions={actions} onAction={(a) => session.command(a.id)} />
      {stopped ? (
        <State kind="error" heading={state.phase === 'unresponsive' ? `${app.name} was stopped` : `${app.name} stopped`} body={state.reason} action="Try again" onAction={onRetry} />
      ) : (
        <>
          {state.phase !== 'open' && (
            <State kind="loading" heading={state.phase === 'slow' ? `${app.name} is taking a while to open` : `Opening ${app.name}`} body={state.phase === 'slow' ? 'It’s still starting. The rest of the shell works meanwhile.' : undefined} />
          )}
          <div className="app-pane-screen" hidden={state.phase !== 'open'}>
            <QuillRemote receiver={session.screen} />
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Mounts one contract 3 app at a time into the stage, as `AppMounter` does an SDK 2 one: a new
 * floor, a new app or an app opened for an intent starts a new worker; a move inside the same app on
 * the same floor is told to the worker that's running.
 */
export class WorkerMounter {
  #current: { app: WorkerApp; floor: string; session: AppSession; root: Root; el: HTMLElement; ctx: WorkerContext } | null = null;

  constructor(
    private readonly stage: HTMLElement,
    private readonly options: WorkerHostOptions = {},
  ) {}

  get mounted(): WorkerApp | null {
    return this.#current?.app ?? null;
  }

  /** The running session, for the shell's other parts (the palette, the About panel) to reach. */
  get session(): AppSession | null {
    return this.#current?.session ?? null;
  }

  mount(app: WorkerApp, ctx: WorkerContext): 'mounted' | 'kept' {
    const open = this.#current;
    if (open && open.app === app && open.floor === ctx.workspace.id && !ctx.intent && !ctx.reply && open.session.state.phase !== 'failed' && open.session.state.phase !== 'unresponsive') {
      open.ctx = ctx;
      open.session.navigated(ctx.path);
      return 'kept';
    }
    this.unmount();
    const el = document.createElement('div');
    el.dataset.app = app.id;
    el.className = 'app-pane-host';
    this.stage.append(el);
    const root = createRoot(el);
    const current = { app, floor: ctx.workspace.id, session: this.#session(app, ctx), root, el, ctx };
    this.#current = current;
    const draw = () =>
      root.render(
        <AppPane
          session={current.session}
          onRetry={() => {
            void current.session.stop();
            current.session = this.#session(app, current.ctx);
            draw();
            current.session.start();
          }}
        />,
      );
    draw();
    current.session.start();
    return 'mounted';
  }

  #session(app: WorkerApp, ctx: WorkerContext) {
    return new AppSession(app, ctx, this.options.createWorker, this.options.budgets);
  }

  unmount() {
    const open = this.#current;
    if (!open) return;
    this.#current = null;
    void open.session.stop();
    open.root.unmount();
    open.el.remove();
  }
}
