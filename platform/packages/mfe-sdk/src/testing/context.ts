import { createEventBus } from '../bus.js';
import type { EventBus, Intent, IntentReply, MountContext, NotifyMessage, User, Workspace, WorkspaceRef } from '../contract.js';
import { floorFetch } from '../floors.js';
import { IntentError } from '../intents.js';
import type { Focus } from '../refs.js';

/** Where `ctx.fetch` sends a path in tests, unless `base` says otherwise. */
export const TEST_BASE = 'http://augur.test';

/**
 * How a fake shell answers `ctx.request` for one intent type: a value, or a
 * function of the intent that returns one. To answer with a function itself,
 * return it from a function. Throw (or reject with) an `IntentCancelled` to act
 * as if the person closed the app that was asked.
 */
export type IntentAnswer = ((intent: Intent) => unknown) | object | string | number | boolean | bigint | null | undefined;

export interface FakeContextOptions {
  /** Merged over a test person with no roles. */
  user?: Partial<User>;
  /** Merged over the person's own floor. Without `path`, the floor is alone on its path. */
  workspace?: Partial<Workspace>;
  /** What relative `ctx.fetch` paths are resolved against. Default `TEST_BASE`. */
  base?: string;
  /** What `getToken` answers and `ctx.fetch` sends as the bearer token. Default `test-token`. */
  token?: string;
  /** The fetch `ctx.fetch` ends in. Default: the global `fetch` at call time, so MSW sees it. */
  fetch?: typeof fetch;
  /** Default: a fresh event bus. */
  bus?: EventBus;
  /** Default `/`. */
  path?: string;
  /** The intent the app was opened to handle. */
  intent?: Intent;
  /** `true` mounts the app to answer a request, with a reply that records what it does. */
  reply?: boolean;
  /** The ids of the app's previews that are on. Default: none. */
  previews?: Iterable<string>;
  /** How `ctx.request` is answered, by intent type. A type without one rejects with an `IntentError`, as the shell does. */
  answers?: Record<string, IntentAnswer>;
  focus?: Focus;
}

/** A reply that remembers what the app answered. */
export interface FakeReply extends IntentReply {
  /** Everything passed to `respond`, in order. */
  readonly responses: unknown[];
  /** How many times `cancel` was called. */
  readonly cancels: number;
}

/** A complete `MountContext`, and what the app did with it. */
export interface FakeContext extends MountContext {
  /** Every intent the app raised, in order. */
  readonly raised: Intent[];
  /** Every intent the app asked about with `request`, answered or not. */
  readonly requested: Intent[];
  /** Every notification the app sent. */
  readonly notified: NotifyMessage[];
  reply?: FakeReply;
  /** Moves the fake shell to another floor: `getWorkspace` and `ctx.fetch` use it from then on, `workspace` keeps the one mounted with. */
  moveTo(workspace: Partial<Workspace>): Workspace;
}

const testUser: User = { id: 'u-test', name: 'Test Person', email: 'test.person@augur.test', departments: [], roles: [] };

const ownFloor: Workspace = { id: 'ws-me', kind: 'personal', name: 'You', slug: 'me', role: 'lead', path: [] };

const refOf = ({ id, kind, name, slug, level }: Workspace): WorkspaceRef =>
  level === undefined ? { id, kind, name, slug } : { id, kind, name, slug, level };

const floor = (over: Partial<Workspace> = {}): Workspace => {
  const ws = { ...ownFloor, ...over };
  return over.path ? ws : { ...ws, path: [refOf(ws)] };
};

const joinBase = (base: string, path: string): string =>
  /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/**
 * A mount context for testing an app without AUGUR: a person, a floor, a real
 * event bus and a `fetch` that adds the token and `X-Workspace-Id` as the shell
 * does, against `base`. It records what the app raised, requested and notified.
 */
export const fakeContext = (options: FakeContextOptions = {}): FakeContext => {
  const token = options.token ?? 'test-token';
  const base = options.base ?? TEST_BASE;
  const answers = options.answers ?? {};
  const previews = new Set(options.previews ?? []);
  const raised: Intent[] = [];
  const requested: Intent[] = [];
  const notified: NotifyMessage[] = [];
  const mounted = floor(options.workspace);
  let current = mounted;

  const getToken = async () => token;
  const getWorkspace = () => current;
  const send = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const ctx: FakeContext = {
    user: { ...testUser, ...options.user },
    getToken,
    bus: options.bus ?? createEventBus(),
    async raise(intent) {
      raised.push(intent);
    },
    async request<T>(intent: Intent): Promise<T> {
      requested.push(intent);
      if (!Object.hasOwn(answers, intent.type)) throw new IntentError(`No app you can open handles "${intent.type}".`);
      const answer = answers[intent.type];
      return (await (typeof answer === 'function' ? answer(intent) : answer)) as T;
    },
    notify(message) {
      notified.push(message);
    },
    workspace: mounted,
    getWorkspace,
    fetch: floorFetch(getToken, getWorkspace, (input, init) => send(typeof input === 'string' ? joinBase(base, input) : input, init)),
    path: options.path ?? '/',
    previewOn: (id) => previews.has(id),
    raised,
    requested,
    notified,
    moveTo(workspace) {
      current = floor(workspace);
      return current;
    },
  };
  if (options.intent) ctx.intent = options.intent;
  if (options.focus) ctx.focus = options.focus;
  if (options.reply) {
    const responses: unknown[] = [];
    let cancels = 0;
    ctx.reply = {
      responses,
      get cancels() {
        return cancels;
      },
      respond: (result) => void responses.push(result),
      cancel: () => void cancels++,
    };
  }
  return ctx;
};
