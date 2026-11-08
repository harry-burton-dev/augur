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
import { fromWire, toWire, type WireResponse } from './fetch.js';
import { reconcile } from './tree.js';
import { CARD_ROOT, SCREEN_ROOT, aboutRoot, type StartInit } from './runtime-names.js';

export { CARD_ROOT, SCREEN_ROOT, aboutRoot, type StartInit };

/**
 * What the worker would otherwise reach beyond the bridge: the network (its own CSP refuses it too; this
 * makes it plain), and what it shares with the shell's page because it runs on the same origin: its
 * stored data (IndexedDB, the Cache API), its other windows and workers (BroadcastChannel), and more workers.
 */
const TAKEN = ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'WebTransport', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker', 'SharedWorker'] as const;

const ROOT_TAG = 'augur-remote-root';

/** Runs the worker side of the bridge on `scope`, the worker's global scope. Called once, by the bootstrap. */
export function runWorker(scope: Port & Record<string, unknown> = globalThis as never) {
  for (const name of TAKEN) takeAway(scope, name);
  if (!customElements.get(ROOT_TAG)) customElements.define(ROOT_TAG, RemoteRootElement);

  const roots = new Map<string, RemoteRootElement>();
  const navigated = new Set<(path: string) => void>();
  const commands = new Map<string, (detail?: unknown) => void | Promise<void>>();
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
    const unavailable = (what: string) => () => Promise.reject(new Error(`${what} arrives with a later release of AUGUR.`));
    return {
      person: Object.freeze({ ...init.person }),
      workspace: Object.freeze({ ...init.workspace }),
      path: init.path,
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
      files: { upload: unavailable('Uploading files'), download: unavailable('Downloading files'), onDrop: () => () => undefined },
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
