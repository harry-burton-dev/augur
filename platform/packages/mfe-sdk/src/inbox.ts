import type { DocumentRef } from './documents.js';
import type { EntityRef } from './entities.js';
import type { Ref } from './refs.js';
import type { UnitRef } from './units.js';

/**
 * The Inbox (SDK 1.12, ADR 0026): one place in the shell for work that waits on someone.
 * An app's service puts items in a person's or a team's inbox (`inboxItem` in the service kit,
 * with the `inbox:write` scope) and closes them when the work is done; people take, decline,
 * hand on or open them in the shell, and opening raises the item's `open` intent like any
 * other. These are the shapes the shell and an app's frontend read.
 */

/** A kind of work an app puts in inboxes, declared in its manifest's `inbox.kinds`, so the words are the app's. */
export interface InboxKind {
  /** How the app's service names it: "assignment". */
  id: string;
  /** What the Inbox shows for it: "Assigned to you". */
  label: string;
  /** A UI kit icon name. */
  icon?: string;
}

/** Where an item stands. Handing on keeps it `open` with a new owner, so `handed-on` is never set. */
export type InboxState = 'open' | 'done' | 'declined' | 'handed-on' | 'withdrawn';

/** Who an item waits on: a person, or a team (anyone on it takes it; with `role: 'lead'` its leads). */
export interface InboxOwner {
  kind: 'person' | 'team';
  id: string;
  role?: 'lead';
}

/** One item, as the events service gives it to the person it's for. */
export interface InboxItem {
  id: string;
  app: string;
  key: string;
  /** One of the app's `inbox.kinds` ids. */
  kind: string;
  owner: InboxOwner;
  /** For a team item, who took it. */
  takenBy?: string;
  takenAt?: string;
  state: InboxState;
  /** Left out of a leads-only item shown to a member of the team who isn't a lead there (`redacted`). */
  title?: string;
  detail?: string;
  subject?: Ref | DocumentRef | EntityRef | UnitRef;
  refs?: (Ref | DocumentRef | EntityRef | UnitRef)[];
  /** The intent Open raises; without it the shell opens the app at `path`. */
  open?: { type: string; payload?: unknown };
  path?: string;
  due?: string;
  overdue?: boolean;
  allow: { decline: boolean; handOn: boolean; selfComplete: boolean };
  /** The person on whose behalf the app made it. */
  from?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  closeNote?: string;
  workspace?: { id: string; path: string[] };
  /** A leads-only item seen by someone on the team who isn't a lead there: that it's there, not what it is. */
  redacted?: boolean;
}

/** How many items wait: on the person (or taken by them), for their teams, and of the first, how many are late. */
export interface InboxCounts {
  you: number;
  teams: number;
  overdue: number;
}

/** What the shell's stream says when an item the person can see changes. */
export interface InboxChange {
  id: string;
  change: 'added' | 'changed' | 'closed';
}

/** The domain events published as people act on items, `{ item, app, key, by[, to] }`; on `ctx.bus` like any other `platform.*` event. */
export const INBOX_TOPICS = {
  taken: 'platform.inbox.taken',
  released: 'platform.inbox.released',
  declined: 'platform.inbox.declined',
  handedOn: 'platform.inbox.handed-on',
  done: 'platform.inbox.done',
} as const;
