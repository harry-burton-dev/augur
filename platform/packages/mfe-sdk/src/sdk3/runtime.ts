/**
 * The SDK 3 runtime, inside the app's worker (spec 6.5, 6.6): it gives the worker remote-dom's DOM,
 * takes the network away, loads the app's entry when the host says start, and hands `start(ctx)` an
 * `AppContext` whose every call crosses the bridge. The shell's worker bootstrap runs this; an app
 * never imports it, so its bundle carries only its own code and the element constructors.
 */
// First: remote-dom's elements extend the DOM this puts in the worker's global scope.
import '@remote-dom/core/polyfill';
import { BatchingRemoteConnection, RemoteRootElement } from '@remote-dom/core/elements';
import { Channel, type Port } from './channel.js';
import type { AppContext, FrameRoot, FrameState, Notice, PlaceItem, Start } from './context.js';
import type { Intent } from '../contract.js';
import { fromWire, pathProblem, toWire, type WireResponse } from './fetch.js';
import { reconcile } from './tree.js';
import { CARD_ROOT, SCREEN_ROOT, aboutRoot, type StartInit, type WireFile } from './runtime-names.js';

export { CARD_ROOT, SCREEN_ROOT, aboutRoot, type StartInit };

/**
 * What the worker would otherwise reach beyond the bridge: the network (its own CSP refuses it too; this
 * makes it plain), and what it shares with the shell's page because it runs on the same origin: its
 * stored data (IndexedDB, the Cache API), its other windows and workers (BroadcastChannel), and more workers.
 */
const TAKEN = ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'WebTransport', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker', 'SharedWorker'] as const;

/** The same on the worker's `navigator`: the origin's file system and locks, which other apps and the shell share, and service workers. */
const TAKEN_FROM_NAVIGATOR = ['storage', 'locks', 'serviceWorker'] as const;

const ROOT_TAG = 'augur-remote-root';

/** Runs the worker side of the bridge on `scope`, the worker's global scope. Called once, by the bootstrap. */
export function runWorker(scope: Port & Record<string, unknown> = globalThis as never) {
  for (const name of TAKEN) takeAway(scope, name);
  const nav = (scope as { navigator?: object }).navigator;
  if (nav) for (const name of TAKEN_FROM_NAVIGATOR) takeAway(nav, name);
  if (!customElements.get(ROOT_TAG)) customElements.define(ROOT_TAG, RemoteRootElement);

  const roots = new Map<string, RemoteRootElement>();
  const navigated = new Set<(path: string) => void>();
  const commands = new Map<string, (detail?: unknown) => void | Promise<void>>();
  const drops = new Set<(files: File[]) => void | Promise<void>>();
  let stop: (() => void) | undefined;
  let ctx: AppContext | undefined;

  const handle = async (method: string, args: unknown[]) => {
    if (method === 'start') {
      if (ctx) throw new Error('The app has started already.');
      const init = args[0] as StartInit;
      ctx = contextFor(init);
      const mod = (await import(/* @vite-ignore */ init.entry)) as { default?: unknown };
      if (typeof mod.default !== 'function') throw new Error('The app’s entry doesn’t export start(ctx) as its default.');
      const done = await (mod.default as Start)(ctx);
      if (typeof done === 'function') stop = done;
      return;
    }
    if (method === 'navigate') {
      const path = String(args[0]);
      if (ctx) (ctx as { path: string }).path = path;
      for (const fn of [...navigated]) fn(path);
      return;
    }
    if (method === 'command') {
      const fn = commands.get(String(args[0]));
      if (!fn) throw new Error('The app has no handler for that command now.');
      return fn(args[1]);
    }
    // Files dropped on the pane (spec 6.10): the host read them, and they reach every handler.
    if (method === 'drop') {
      const files = (Array.isArray(args[0]) ? (args[0] as WireFile[]) : []).map((f) => new File([f.bytes], String(f.name), { type: String(f.type ?? ''), lastModified: Number(f.lastModified) || 0 }));
      for (const fn of [...drops]) await fn(files);
      return;
    }
    // The host asks now and then, to know the app still answers (spec 6.13).
    if (method === 'ping') return;
    if (method === 'stop') {
      const fn = stop;
      stop = undefined;
      fn?.();
      return;
    }
    throw new Error(`The app doesn’t answer ${method}.`);
  };
  const channel = new Channel(scope, handle);

  const root = (name: string): FrameRoot => {
    let el = roots.get(name);
    if (!el) {
      el = document.createElement(ROOT_TAG) as RemoteRootElement;
      el.connect(new BatchingRemoteConnection({ mutate: (records) => channel.mutate(name, records), call: () => undefined }));
      roots.set(name, el);
    }
    const it = el;
    return { render: (node) => reconcile(it, node), clear: () => it.replaceChildren() };
  };

  const tellCommands = () => channel.post('commands', [...commands.keys()]);

  function contextFor(init: StartInit): AppContext {
    const previews = new Set(init.previewsOn);
    return {
      person: Object.freeze({ ...init.person }),
      workspace: Object.freeze({ ...init.workspace }),
      path: init.path,
      surface: init.surface === 'card' ? 'card' : 'screen',
      onNavigate(fn) {
        navigated.add(fn);
        return () => void navigated.delete(fn);
      },
      navigate: (path) => channel.post('navigate', String(path)),
      fetch: async (path, options) => fromWire((await channel.call('fetch', await toWire(path, options))) as WireResponse),
      frame: {
        screen: root(SCREEN_ROOT),
        card: root(CARD_ROOT),
        about: (id) => root(aboutRoot(String(id))),
        set: (state: FrameState) => channel.post('frame.set', plain(state)),
        under: (placeId: string, items: PlaceItem[]) => channel.post('frame.under', String(placeId), plain(items)),
        onCommand(id, fn) {
          commands.set(String(id), fn);
          tellCommands();
          return () => {
            if (commands.get(String(id)) !== fn) return;
            commands.delete(String(id));
            tellCommands();
          };
        },
      },
      files: {
        upload: async (blob, path) => fromWire((await channel.call('files.upload', await toWire(path, { method: 'POST', body: blob }))) as WireResponse),
        async download(path, options) {
          const problem = pathProblem(path);
          if (problem) throw new TypeError(problem);
          if (options?.save) return void (await channel.call('files.download', path, { save: true }));
          const res = fromWire((await channel.call('files.download', path)) as WireResponse);
          if (!res.ok) throw new Error(await refusal(res, path));
          return res.blob();
        },
        onDrop(fn) {
          drops.add(fn);
          if (drops.size === 1) channel.post('files.drops', true);
          return () => {
            if (!drops.delete(fn) || drops.size) return;
            channel.post('files.drops', false);
          };
        },
      },
      ...(init.canvas ? { canvas: { open: async (entry: string) => (await channel.call('canvas.open', String(entry))) as MessagePort, close: () => channel.post('canvas.close') } } : {}),
      raise: async (intent) => void (await channel.call('raise', plain(intent))),
      request: async <T>(intent: Intent) => (await channel.call('request', plain(intent))) as T,
      notify: (notice: Notice) => channel.post('notify', plain(notice)),
      ...(init.intent ? { intent: init.intent } : {}),
      ...(init.replying ? { reply: { respond: (result: unknown) => channel.post('reply.respond', plain(result)), cancel: () => channel.post('reply.cancel') } } : {}),
      previewOn: (id) => previews.has(id),
    };
  }
  return channel;
}

/**
 * Takes a global away: from the scope and from each prototype it inherits from (a worker's `fetch`
 * lives on WorkerGlobalScope's prototype). Where one can't be deleted, it is shadowed with undefined;
 * the worker's CSP refuses the network either way.
 */
function takeAway(scope: object, name: string) {
  for (let at: object | null = scope; at && at !== Object.prototype; at = Object.getPrototypeOf(at)) {
    if (!Object.prototype.hasOwnProperty.call(at, name)) continue;
    try {
      delete (at as Record<string, unknown>)[name];
    } catch {
      // Not configurable: shadowed below.
    }
  }
  if (name in scope) {
    try {
      Object.defineProperty(scope, name, { value: undefined, configurable: false, writable: false });
    } catch {
      // The CSP still holds it.
    }
  }
}

/** A value as plain data, so it can cross: anything that can't (a class instance, a function) is refused here, where the app can see why. */
function plain<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    throw new TypeError('That can’t cross to the shell: send plain data (text, numbers, lists and objects).');
  }
}

/** Why a download couldn't be had, in the service's own words where it gave them. */
async function refusal(res: Response, path: string) {
  try {
    const body = (await res.json()) as { message?: unknown; detail?: unknown };
    const said = typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : undefined;
    if (said) return said;
  } catch {
    // Not JSON: say what failed.
  }
  return `${path} couldn’t be downloaded (${res.status}).`;
}
