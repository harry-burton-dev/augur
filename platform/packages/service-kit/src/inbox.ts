import { callService, type ServiceCredentials } from './service.js';

/**
 * The Inbox (ADR 0026): work that waits on someone. An app's service puts an item in a
 * person's or a team's inbox, keyed by its own id for the work, and closes it when the work
 * is done. People take, decline, hand on or open items in the shell; the app hears about
 * those through the `platform.inbox.*` domain events. A notification tells; an item waits.
 */

/** Where an item stands. `handed-on` is kept for ADR 0026's list; handing on changes the owner and keeps the item open. */
export type InboxState = 'open' | 'done' | 'declined' | 'handed-on' | 'withdrawn';

/** Who an item waits on: a person, or a team (any member takes it; with `role: 'lead'` only its leads). */
export interface InboxOwner {
  kind: 'person' | 'team';
  id: string;
  role?: 'lead';
}

/** What a person may do with an item besides opening it. Decline and hand on are allowed unless turned off. */
export interface InboxAllow {
  decline?: boolean;
  handOn?: boolean;
  /** Whether the person may mark it done in the shell, rather than the app closing it when the work is done. */
  selfComplete?: boolean;
}

/** A reference back to the thing in the app (an SDK `Ref`, `DocumentRef`, `EntityRef` or `UnitRef`). */
export interface InboxRef {
  kind: string;
  app?: string;
  id: string;
  label?: string;
  [field: string]: unknown;
}

export interface NewInboxItem {
  /** One of the kinds the app declares in its manifest's `inbox.kinds`. */
  kind: string;
  owner: InboxOwner;
  /** 1 to 200 characters, in the app's words. */
  title: string;
  /** Up to 1000 characters. */
  detail?: string;
  /** What the item is about. */
  subject: InboxRef;
  /** Up to five related things. */
  refs?: InboxRef[];
  /** The intent Open raises (payload at most 1 KB as JSON); without it the shell opens the app at `path`. */
  open?: { type: string; payload?: unknown };
  /** A path inside the app, starting with "/". */
  path?: string;
  /** When it's due, an ISO date or date and time. */
  due?: string;
  allow?: InboxAllow;
  /** The person on whose behalf the app made it, if any. */
  from?: string;
  /** Opens a closed item again; without it, putting a closed item answers 409. */
  reopen?: boolean;
}

/** What an app may change on its own item. `done` and `withdrawn` close it. */
export interface InboxChange {
  state?: 'done' | 'withdrawn';
  title?: string;
  detail?: string;
  due?: string;
  refs?: InboxRef[];
  /** Why, kept in the item's history. */
  note?: string;
}

export interface InboxItem {
  id: string;
  app: string;
  key: string;
  kind: string;
  owner: InboxOwner;
  /** For a team item: the person who took it. */
  takenBy?: string;
  takenAt?: string;
  state: InboxState;
  title: string;
  detail?: string;
  subject: InboxRef;
  refs?: InboxRef[];
  open?: { type: string; payload?: unknown };
  path?: string;
  due?: string;
  allow: Required<InboxAllow>;
  from?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  closeNote?: string;
  workspace?: { id: string; path: string[] };
}

/** One change to an item: who did what, and from and to whom for a hand-on. */
export interface InboxHistory {
  at: string;
  /** A person's id; none when the app did it. */
  by?: string;
  action: 'created' | 'updated' | 'taken' | 'released' | 'declined' | 'handed-on' | 'done' | 'withdrawn' | 'reopened';
  /** `person:<id>` or `team:<id>`. */
  from?: string;
  to?: string;
  note?: string;
}

/** The domain events the events service publishes as people act on items: `{ item, app, key, by[, to] }`. Follow them and skip other apps' items by `app`. */
export const INBOX_TOPICS = {
  taken: 'platform.inbox.taken',
  released: 'platform.inbox.released',
  declined: 'platform.inbox.declined',
  handedOn: 'platform.inbox.handed-on',
  done: 'platform.inbox.done',
} as const;

interface InboxOptions {
  /** The events service's internal address, e.g. http://events:8084. */
  eventsUrl: string;
  credentials: ServiceCredentials;
  /** The floor the item is on; the app's `inbox:write` grant is checked there. */
  workspace?: string;
  fetchImpl?: typeof fetch;
  app: string;
  /** The app's own id for this piece of work: putting the same key twice keeps one item. */
  key: string;
}

const itemUrl = ({ eventsUrl, app, key }: InboxOptions) => `${eventsUrl.replace(/\/$/, '')}/v1/inbox/items/${encodeURIComponent(app)}/${encodeURIComponent(key)}`;

/**
 * Puts an item in someone's inbox, or changes the one already there under the same key. Safe to call
 * again after any failure, or on start to reconcile. Retried while the events service is unreachable.
 */
export async function inboxItem(o: InboxOptions & { item: NewInboxItem }): Promise<InboxItem> {
  return (await callService({ method: 'PUT', url: itemUrl(o), credentials: o.credentials, body: o.item, what: `put ${o.key} in the inbox`, workspace: o.workspace, attempts: 3, fetchImpl: o.fetchImpl })) as InboxItem;
}

/** Changes an item the app made, or closes it as done or withdrawn. */
export async function updateInboxItem(o: InboxOptions & { change: InboxChange }): Promise<InboxItem> {
  return (await callService({ method: 'PATCH', url: itemUrl(o), credentials: o.credentials, body: o.change, what: `update inbox item ${o.key}`, workspace: o.workspace, attempts: 3, fetchImpl: o.fetchImpl })) as InboxItem;
}

/** An item the app made, with its history, notes included (a decline's reason is read here, not carried in the event). */
export async function getInboxItem(o: InboxOptions): Promise<InboxItem & { history: InboxHistory[] }> {
  return (await callService({ method: 'GET', url: itemUrl(o), credentials: o.credentials, what: `read inbox item ${o.key}`, workspace: o.workspace, attempts: 3, fetchImpl: o.fetchImpl })) as InboxItem & { history: InboxHistory[] };
}
