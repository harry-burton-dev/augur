import { WORKSPACE_HEADER, type AppManifestEntry, type InboxCounts, type InboxItem, type Workspace } from '@augur/mfe-sdk';
import type { HomeNeed } from './home.js';
import { incompatibility } from './manifest.js';

/**
 * The Inbox (ADR 0026): work that waits on the person or their teams. The events service keeps
 * the items; the shell lists them, keeps the count in the Inbox function's label, and lets the
 * person take, give back, decline, hand on, mark done or open each one. Every word about an
 * item comes from the item (the app wrote it), the app's manifest (its name, the kind's label)
 * or the directory (people's and teams' names); nothing here names an app.
 */

export type InboxTab = 'you' | 'teams' | 'done';
export type InboxVerb = 'take' | 'release' | 'decline' | 'hand-on' | 'done';

/** The Inbox's place among the shell's functions, after Find. */
export const INBOX_FUNCTION = { id: 'inbox', label: 'Inbox', icon: 'inbox' } as const;

/** What the function says: "Inbox", "Inbox 3", "Inbox 99+" (D7: the label carries the count until the chrome has a badge). */
export const inboxLabel = (counts?: InboxCounts) => {
  const n = counts ? counts.you + counts.teams : 0;
  return n ? `Inbox ${n > 99 ? '99+' : n}` : 'Inbox';
};

/** The Inbox's functions: placed after Find, with its count. */
export const withInbox = <F extends { id: string; label: string; icon: string }>(functions: F[], counts?: InboxCounts): { id: string; label: string; icon: string }[] => {
  const at = functions.findIndex((f) => f.id === 'find');
  const inbox = { ...INBOX_FUNCTION, label: inboxLabel(counts) };
  return [...functions.slice(0, at + 1), inbox, ...functions.slice(at + 1)];
};

/** The events service's refusal, as its sentence. */
export class InboxError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** For a take that lost the race: who took it. */
    readonly takenBy?: string,
  ) {
    super(message);
  }
}

export const UNREACHABLE = 'Your inbox can’t be reached right now. Trying again.';

/** Talks to the events service's person API, through the gateway, as the person, on the floor they stand on. */
export class InboxClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly opts: { getToken(): Promise<string>; floor(): string | undefined; fetchImpl?: typeof fetch; baseUrl?: string },
  ) {
    const f = opts.fetchImpl ?? fetch;
    this.fetchImpl = (...args) => f(...args);
  }

  private get base() {
    return this.opts.baseUrl ?? '/api/events/v1';
  }

  private async call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const floor = this.opts.floor();
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          authorization: `Bearer ${await this.opts.getToken()}`,
          accept: 'application/json',
          ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
          // A lead sees a leads-only item whole only while standing on that team.
          ...(floor ? { [WORKSPACE_HEADER]: encodeURIComponent(floor) } : {}),
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
    } catch {
      throw new InboxError(UNREACHABLE, 0);
    }
    const body = (await res.json().catch(() => ({}))) as T & { detail?: string; message?: string; takenBy?: string };
    if (!res.ok) throw new InboxError(res.status >= 500 ? UNREACHABLE : (body.detail ?? body.message ?? `The inbox answered ${res.status}.`), res.status, body.takenBy);
    return body;
  }

  list(tab: InboxTab) {
    return this.call<InboxItem[]>(`/inbox?tab=${tab}`);
  }

  counts() {
    return this.call<InboxCounts>('/inbox/counts');
  }

  act(id: string, verb: InboxVerb, body?: { note?: string; to?: string }) {
    return this.call<InboxItem>(`/inbox/${encodeURIComponent(id)}/${verb}`, { method: 'POST', ...(body ? { body } : {}) });
  }
}

/** Overdue first, then newest first: how For you is ordered. */
export const ordered = (items: InboxItem[]) => [...items].sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue) || Date.parse(b.createdAt) - Date.parse(a.createdAt));

/** What to call the app an item is from: its name from the catalogue, or its id when this floor's catalogue doesn't have it. */
export const appNameOf = (item: Pick<InboxItem, 'app'>, manifest: AppManifestEntry[]) => manifest.find((a) => a.id === item.app)?.name ?? item.app;

/** The label of the item's kind, as the app's manifest gives it; none when it doesn't say. */
export const kindOf = (item: Pick<InboxItem, 'app' | 'kind'>, manifest: AppManifestEntry[]) => manifest.find((a) => a.id === item.app)?.inbox?.kinds.find((k) => k.id === item.kind);

const floorName = (f: Workspace) => (f.kind === 'personal' ? 'your own floor' : f.name);

/**
 * Why Open can't be pressed, or undefined when it can. An item on another floor opens there, so
 * only this floor's catalogue is checked: the app off or removed here, or made for another SDK.
 */
export const openProblem = (item: InboxItem, { manifest, floors, here }: { manifest: AppManifestEntry[]; floors: Workspace[]; here: string }): string | undefined => {
  if (item.redacted) return 'This is for the team’s leads.';
  const on = item.workspace?.id ?? here;
  if (on !== here) return floors.some((f) => f.id === on) ? undefined : 'It’s on a floor you’re no longer on.';
  const app = manifest.find((a) => a.id === item.app);
  const there = floors.find((f) => f.id === here);
  if (!app) return `${item.app} is turned off${there ? ` on ${floorName(there)}` : ''}, or was removed. An admin can turn it on in Admin, Apps.`;
  return incompatibility(app);
};

/** When it's due, in a few words, and whether that's past. */
export const dueLine = (item: Pick<InboxItem, 'due' | 'overdue'>, now = Date.now()): { text: string; late: boolean } | undefined => {
  if (!item.due) return undefined;
  const due = Date.parse(item.due);
  const days = Math.round(Math.abs(now - due) / 86_400_000);
  if (item.overdue || due < now) return { text: days < 1 ? 'Overdue' : `Overdue by ${days} day${days === 1 ? '' : 's'}`, late: true };
  return { text: `Due ${new Date(due).toLocaleDateString(undefined, { weekday: days < 7 ? 'long' : undefined, day: 'numeric', month: 'short' })}`, late: false };
};

/** One entry of an item's menu: what the person can do, and why not when they can't (explain, never hide). */
export interface InboxMenuEntry {
  id: InboxVerb;
  label: string;
  disabled?: boolean;
  reason?: string;
}

/** The menu for an item, for this person: an action the app doesn't allow stays, disabled, saying why. */
export const menuFor = (item: InboxItem, me: string, appName: string): InboxMenuEntry[] => {
  if (item.state !== 'open') return [];
  if (item.redacted) return [{ id: 'take', label: 'Take it', disabled: true, reason: 'Only the team’s leads take this. Stand on the team as a lead to see it.' }];
  const team = item.owner.kind === 'team';
  const mine = team ? item.takenBy === me : true;
  const entries: InboxMenuEntry[] = [];
  if (team && !item.takenBy) entries.push({ id: 'take', label: 'Take it' });
  if (team && item.takenBy === me) entries.push({ id: 'release', label: 'Give it back to the team' });
  const notYet = team && !item.takenBy ? undefined : mine ? undefined : 'Someone else on the team took this.';
  entries.push(
    item.allow.handOn ? { id: 'hand-on', label: 'Hand on…', ...(notYet ? { disabled: true, reason: notYet } : {}) } : { id: 'hand-on', label: 'Hand on…', disabled: true, reason: `${appName} doesn’t let this be handed on.` },
    item.allow.decline ? { id: 'decline', label: 'Decline…', ...(notYet ? { disabled: true, reason: notYet } : {}) } : { id: 'decline', label: 'Decline…', disabled: true, reason: `${appName} doesn’t let this be declined.` },
  );
  entries.push(
    item.allow.selfComplete
      ? { id: 'done', label: 'Mark done', ...(notYet ? { disabled: true, reason: notYet } : {}) }
      : { id: 'done', label: 'Mark done', disabled: true, reason: `${appName} closes this itself when the work is done. Open it to do the work.` },
  );
  return entries;
};

/** What the item is about, in the words its reference carries: a Ref's or EntityRef's label, a document's title, a unit's name. */
export const subjectLabel = (item: Pick<InboxItem, 'subject'>): string | undefined => {
  const s = item.subject as { label?: string; title?: string; name?: string } | undefined;
  return s?.label ?? s?.title ?? s?.name;
};

/** How many open items Home lists before "{n} more in your Inbox". */
export const HOME_ITEMS = 5;
/** The id of Home's row that opens the Inbox. */
export const INBOX_MORE = 'inbox:more';
const NEED_PREFIX = 'inbox:';

/** The id Home's row for an item carries, and the item's id back from it. */
export const needId = (item: Pick<InboxItem, 'id'>) => `${NEED_PREFIX}${item.id}`;
export const itemOfNeed = (id: string) => (id.startsWith(NEED_PREFIX) && id !== INBOX_MORE ? id.slice(NEED_PREFIX.length) : undefined);

/**
 * Home's "Needs you" rows for the Inbox, above its notifications: open items on this floor that are the
 * person's or untaken for their teams, at most five, then one row that opens the Inbox for the rest. Home
 * shows them as it shows any need, so an older Home works unchanged.
 */
export const inboxNeeds = (items: InboxItem[], { manifest, here, total }: { manifest: AppManifestEntry[]; here: string; total: number }): HomeNeed[] => {
  const onFloor = ordered(items).filter((i) => i.state === 'open' && !i.redacted && (i.workspace?.id ?? here) === here);
  const rows: HomeNeed[] = onFloor.slice(0, HOME_ITEMS).map((i) => ({
    id: needId(i),
    app: i.app,
    appName: kindOf(i, manifest)?.label ?? appNameOf(i, manifest),
    title: i.title ?? '',
    ...(i.detail ? { detail: i.detail } : {}),
    time: Date.parse(i.createdAt),
    actions: [],
  }));
  const more = total - rows.length;
  if (more > 0) rows.push({ id: INBOX_MORE, app: 'inbox', appName: 'Inbox', title: `${more} more in your Inbox`, time: Date.now(), actions: [] });
  return rows;
};
