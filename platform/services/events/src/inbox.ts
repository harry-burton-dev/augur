import { EventEmitter } from 'node:events';
import type pg from 'pg';
import type { InboxAllow, InboxChange, InboxHistory, InboxItem, InboxOwner, InboxRef, NewInboxItem } from '@augur/service-kit';
import type { EventFloor } from './store.ts';

/**
 * The Inbox's items (ADR 0026): work that waits on a person or a team. Apps put and close
 * items by their own key; people take, release, decline, hand on and mark done. Every change
 * is kept in the item's history, and announced so the shell's open streams can refresh.
 */

/** Who may hear of a change: `person:<id>` and `team:<id>`, as the owner and taker stood before and after it. */
export interface InboxSignal {
  id: string;
  change: 'added' | 'changed' | 'closed';
  principals: string[];
}
export type InboxListener = (s: InboxSignal) => void;

export type InboxTab = 'you' | 'teams' | 'done';

export interface InboxQuery {
  person: string;
  /** The teams the person is on (`team:<id>` principals without the prefix). */
  teams: string[];
  tab: InboxTab;
  /** Only items on this floor. */
  floor?: string;
  /** The id of the last item already shown. */
  before?: string;
  limit: number;
}

export interface InboxCounts {
  you: number;
  teams: number;
  overdue: number;
}

/** A person's action on an item, and the rule it must still meet when it's applied. */
export type InboxAction =
  | { action: 'taken'; by: string }
  | { action: 'released'; by: string }
  | { action: 'declined'; by: string; note: string }
  | { action: 'handed-on'; by: string; to: InboxOwner; note?: string }
  | { action: 'done'; by: string };

/** What came of a step: the item now and the history line's id; or why it didn't happen. */
export type StepResult = { item: InboxItem; step: string } | { missing: true } | { closed: InboxItem } | { takenBy: string };

export type PutResult = { item: InboxItem; step: string; created: boolean } | { closed: InboxItem };

/** How long Done keeps showing a closed item. */
export const DONE_DAYS = 30;

const DEFAULT_ALLOW: Required<InboxAllow> = { decline: true, handOn: true, selfComplete: false };

export const ownerPrincipal = (o: InboxOwner) => `${o.kind}:${o.id}`;

/** Who sees an item now: its owner and whoever took it. */
const principalsOf = (item: InboxItem) => [ownerPrincipal(item.owner), ...(item.takenBy ? [`person:${item.takenBy}`] : [])];

const closedState = { declined: 'declined', done: 'done' } as const;

export interface InboxStore {
  /** Adds an item, or changes the open one with the same app and key. A closed one is reopened only with `reopen`. */
  put(app: string, key: string, input: NewInboxItem, floor?: EventFloor): Promise<PutResult>;
  /** The app's change to its own item. */
  patch(app: string, key: string, change: InboxChange): Promise<StepResult>;
  byKey(app: string, key: string): Promise<InboxItem | undefined>;
  get(id: string): Promise<InboxItem | undefined>;
  history(id: string): Promise<InboxHistory[]>;
  /** Applies a person's action if the item is still open (and, to take it, untaken). */
  act(id: string, a: InboxAction): Promise<StepResult>;
  list(q: InboxQuery): Promise<InboxItem[]>;
  /** `leadTeams`: the teams whose leads-only items count, those the person stands on as a lead. */
  counts(person: string, teams: string[], leadTeams: string[]): Promise<InboxCounts>;
  /** Forgets items closed more than this many days ago, with their history; returns how many went. */
  prune(keepDays: number): Promise<number>;
  /** Hears each change on any instance, for open streams. */
  onChange(listener: InboxListener): () => void;
}

const overdue = (item: InboxItem, now = Date.now()) => !!item.due && Date.parse(item.due) < now;

/** Without the fields left unset, as Postgres hands back nulls left out. */
const tidy = <T extends object>(o: T): T => {
  const copy = structuredClone(o) as Record<string, unknown>;
  for (const k of Object.keys(copy)) if (copy[k] === undefined || copy[k] === null) delete copy[k];
  return copy as T;
};

// ---- Postgres ----

/** The inbox's tables; added to the events service's migrations. */
export const inboxMigration = {
  id: '007_inbox',
  sql: `
    -- Work that waits on someone (ADR 0026). Apps put and close items; people act on them in the shell.
    create table events.inbox_items (
      id uuid primary key default gen_random_uuid(),
      app text not null,
      key text not null,
      kind text not null,
      owner_kind text not null check (owner_kind in ('person', 'team')),
      owner_id text not null,
      team_role text check (team_role in ('lead')),
      taken_by text,
      taken_at timestamptz,
      state text not null default 'open' check (state in ('open', 'done', 'declined', 'handed-on', 'withdrawn')),
      title text not null,
      detail text,
      subject jsonb not null,
      refs jsonb,
      open_intent jsonb,
      path text,
      due_at timestamptz,
      allow jsonb not null default '{"decline": true, "handOn": true, "selfComplete": false}',
      created_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      closed_at timestamptz,
      closed_by text,
      close_note text,
      workspace_id text,
      workspace_path text[],
      unique (app, key)
    );
    create index inbox_open_person on events.inbox_items (owner_id, created_at desc) where state = 'open' and owner_kind = 'person';
    create index inbox_open_team on events.inbox_items (owner_id, created_at desc) where state = 'open' and owner_kind = 'team';
    create index inbox_taken on events.inbox_items (taken_by) where state = 'open' and taken_by is not null;
    create index inbox_closed on events.inbox_items (closed_at) where closed_at is not null;

    -- Every change to an item, for its trail on screen. The audit log records each one too.
    create table events.inbox_history (
      id bigint generated always as identity primary key,
      item_id uuid not null references events.inbox_items (id) on delete cascade,
      at timestamptz not null default now(),
      by text,
      action text not null,
      from_owner text,
      to_owner text,
      note text
    );
    create index inbox_history_item on events.inbox_history (item_id, at);
    create index inbox_history_by on events.inbox_history (by) where by is not null;`,
};

/** Changes to items, announced as each commits so every instance's open streams hear them. */
export const INBOX_CHANNEL = 'events_inbox';

type ItemRow = {
  id: string;
  app: string;
  key: string;
  kind: string;
  owner_kind: 'person' | 'team';
  owner_id: string;
  team_role: 'lead' | null;
  taken_by: string | null;
  taken_at: Date | null;
  state: InboxItem['state'];
  title: string;
  detail: string | null;
  subject: InboxRef;
  refs: InboxRef[] | null;
  open_intent: InboxItem['open'] | null;
  path: string | null;
  due_at: Date | null;
  allow: Required<InboxAllow>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
  closed_by: string | null;
  close_note: string | null;
  workspace_id: string | null;
  workspace_path: string[] | null;
};

const fromItemRow = (r: ItemRow): InboxItem =>
  tidy({
    id: r.id,
    app: r.app,
    key: r.key,
    kind: r.kind,
    owner: { kind: r.owner_kind, id: r.owner_id, ...(r.team_role ? { role: r.team_role } : {}) },
    takenBy: r.taken_by,
    takenAt: r.taken_at?.toISOString(),
    state: r.state,
    title: r.title,
    detail: r.detail,
    subject: r.subject,
    refs: r.refs,
    open: r.open_intent,
    path: r.path,
    due: r.due_at?.toISOString(),
    allow: { ...DEFAULT_ALLOW, ...r.allow },
    from: r.created_by,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    closedAt: r.closed_at?.toISOString(),
    closedBy: r.closed_by,
    closeNote: r.close_note,
    ...(r.workspace_id ? { workspace: { id: r.workspace_id, path: r.workspace_path ?? [r.workspace_id] } } : {}),
  } as unknown as InboxItem);

type HistoryRow = { id: string; at: Date; by: string | null; action: InboxHistory['action']; from_owner: string | null; to_owner: string | null; note: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Items in Postgres. Each step is one transaction: the change, its history line and its
 * NOTIFY commit together. Taking a team item is a single conditional update, so of two
 * people taking it at once one wins and the other is told who.
 */
export class PgInboxStore implements InboxStore {
  private emitter = new EventEmitter().setMaxListeners(0);

  constructor(private readonly pool: pg.Pool) {}

  /** What the events store's listening connection hears on INBOX_CHANNEL. */
  heard(payload: string) {
    try {
      this.emitter.emit('change', JSON.parse(payload) as InboxSignal);
    } catch {
      // Not ours to read.
    }
  }

  onChange(listener: InboxListener) {
    this.emitter.on('change', listener);
    return () => void this.emitter.off('change', listener);
  }

  /** Runs one step in a transaction; `apply` returns the row changed (or a reason it wasn't) and the history line. */
  private async step(
    apply: (c: pg.PoolClient) => Promise<{ row: ItemRow; before: string[]; line: Omit<InboxHistory, 'at'>; change: InboxSignal['change']; created?: boolean } | Exclude<StepResult, { item: InboxItem }>>,
  ): Promise<(StepResult & { created?: boolean })> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const done = await apply(client);
      if (!('row' in done)) {
        await client.query('rollback');
        return done;
      }
      const { rows } = await client.query<{ id: string }>(
        'insert into events.inbox_history (item_id, by, action, from_owner, to_owner, note) values ($1, $2, $3, $4, $5, $6) returning id',
        [done.row.id, done.line.by ?? null, done.line.action, done.line.from ?? null, done.line.to ?? null, done.line.note ?? null],
      );
      const item = fromItemRow(done.row);
      const signal: InboxSignal = { id: item.id, change: done.change, principals: [...new Set([...done.before, ...principalsOf(item)])] };
      await client.query('select pg_notify($1, $2)', [INBOX_CHANNEL, JSON.stringify(signal)]);
      await client.query('commit');
      return { item, step: String(rows[0].id), ...(done.created !== undefined ? { created: done.created } : {}) };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async put(app: string, key: string, input: NewInboxItem, floor?: EventFloor): Promise<PutResult> {
    const allow = JSON.stringify({ ...DEFAULT_ALLOW, ...input.allow });
    const values = [
      app, key, input.kind, input.owner.kind, input.owner.id, input.owner.role ?? null, input.title, input.detail ?? null,
      JSON.stringify(input.subject), input.refs ? JSON.stringify(input.refs) : null, input.open ? JSON.stringify(input.open) : null,
      input.path ?? null, input.due ?? null, allow, input.from ?? null, floor?.id ?? null, floor?.path ?? null,
    ];
    const result = await this.step(async (c) => {
      const { rows: found } = await c.query<ItemRow>('select * from events.inbox_items where app = $1 and key = $2 for update', [app, key]);
      const was = found[0];
      if (!was) {
        const { rows } = await c.query<ItemRow>(
          `insert into events.inbox_items (app, key, kind, owner_kind, owner_id, team_role, title, detail, subject, refs, open_intent, path, due_at, allow, created_by, workspace_id, workspace_path)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) returning *`,
          values,
        );
        return { row: rows[0], before: [], line: { action: 'created', by: input.from, to: ownerPrincipal(input.owner) }, change: 'added', created: true };
      }
      const before = principalsOf(fromItemRow(was));
      const reopened = was.state !== 'open';
      if (reopened && !input.reopen) return { closed: fromItemRow(was) };
      const moved = `${was.owner_kind}:${was.owner_id}` !== ownerPrincipal(input.owner);
      const { rows } = await c.query<ItemRow>(
        `update events.inbox_items set kind = $3, owner_kind = $4, owner_id = $5, team_role = $6, title = $7, detail = $8, subject = $9, refs = $10,
           open_intent = $11, path = $12, due_at = $13, allow = $14, created_by = $15,
           workspace_id = coalesce($16, workspace_id), workspace_path = coalesce($17, workspace_path), updated_at = now(),
           taken_by = case when $18 then null else taken_by end, taken_at = case when $18 then null else taken_at end,
           state = 'open', closed_at = null, closed_by = null, close_note = null
         where app = $1 and key = $2 returning *`,
        [...values, moved || reopened],
      );
      return { row: rows[0], before, line: { action: reopened ? 'reopened' : 'updated', ...(moved ? { from: before[0], to: ownerPrincipal(input.owner) } : {}) }, change: reopened ? 'added' : 'changed', created: false };
    });
    if ('closed' in result) return result;
    if (!('item' in result)) throw new Error('An inbox put ended without an item.');
    return { item: result.item, step: result.step, created: !!result.created };
  }

  async patch(app: string, key: string, change: InboxChange): Promise<StepResult> {
    return this.step(async (c) => {
      const { rows: found } = await c.query<ItemRow>('select * from events.inbox_items where app = $1 and key = $2 for update', [app, key]);
      const was = found[0];
      if (!was) return { missing: true };
      if (was.state !== 'open') return { closed: fromItemRow(was) };
      const { rows } = await c.query<ItemRow>(
        `update events.inbox_items set title = coalesce($2, title), detail = coalesce($3, detail), due_at = coalesce($4, due_at), refs = coalesce($5, refs),
           state = coalesce($6, state), closed_at = case when $6::text is null then null else now() end, close_note = $7, updated_at = now()
         where id = $1 returning *`,
        [was.id, change.title ?? null, change.detail ?? null, change.due ?? null, change.refs ? JSON.stringify(change.refs) : null, change.state ?? null, change.state ? (change.note ?? null) : null],
      );
      return { row: rows[0], before: principalsOf(fromItemRow(was)), line: { action: change.state ?? 'updated', ...(change.note ? { note: change.note } : {}) }, change: change.state ? 'closed' : 'changed' };
    });
  }

  async byKey(app: string, key: string) {
    const { rows } = await this.pool.query<ItemRow>('select * from events.inbox_items where app = $1 and key = $2', [app, key]);
    return rows[0] && fromItemRow(rows[0]);
  }

  async get(id: string) {
    if (!UUID.test(id)) return undefined;
    const { rows } = await this.pool.query<ItemRow>('select * from events.inbox_items where id = $1', [id]);
    return rows[0] && fromItemRow(rows[0]);
  }

  async history(id: string) {
    if (!UUID.test(id)) return [];
    const { rows } = await this.pool.query<HistoryRow>('select * from events.inbox_history where item_id = $1 order by at, id', [id]);
    return rows.map((r) => tidy({ at: r.at.toISOString(), by: r.by, action: r.action, from: r.from_owner, to: r.to_owner, note: r.note } as InboxHistory));
  }

  async act(id: string, a: InboxAction): Promise<StepResult> {
    if (!UUID.test(id)) return { missing: true };
    return this.step(async (c) => {
      if (a.action === 'taken') {
        // The one statement that decides a race: only an untaken, open item is taken.
        const { rows } = await c.query<ItemRow>(
          `update events.inbox_items set taken_by = $2, taken_at = now(), updated_at = now() where id = $1 and state = 'open' and taken_by is null returning *`,
          [id, a.by],
        );
        if (rows[0]) return { row: rows[0], before: [`${rows[0].owner_kind}:${rows[0].owner_id}`], line: { action: 'taken', by: a.by }, change: 'changed' };
        const { rows: now } = await c.query<ItemRow>('select * from events.inbox_items where id = $1', [id]);
        if (!now[0]) return { missing: true };
        if (now[0].state !== 'open') return { closed: fromItemRow(now[0]) };
        return { takenBy: now[0].taken_by! };
      }
      const { rows: found } = await c.query<ItemRow>('select * from events.inbox_items where id = $1 for update', [id]);
      const was = found[0];
      if (!was) return { missing: true };
      if (was.state !== 'open') return { closed: fromItemRow(was) };
      const before = principalsOf(fromItemRow(was));
      if (a.action === 'released') {
        const { rows } = await c.query<ItemRow>('update events.inbox_items set taken_by = null, taken_at = null, updated_at = now() where id = $1 returning *', [id]);
        return { row: rows[0], before, line: { action: 'released', by: a.by }, change: 'changed' };
      }
      if (a.action === 'handed-on') {
        const { rows } = await c.query<ItemRow>(
          'update events.inbox_items set owner_kind = $2, owner_id = $3, team_role = null, taken_by = null, taken_at = null, updated_at = now() where id = $1 returning *',
          [id, a.to.kind, a.to.id],
        );
        return { row: rows[0], before, line: { action: 'handed-on', by: a.by, from: `${was.owner_kind}:${was.owner_id}`, to: ownerPrincipal(a.to), ...(a.note ? { note: a.note } : {}) }, change: 'changed' };
      }
      const note = a.action === 'declined' ? a.note : null;
      const { rows } = await c.query<ItemRow>(
        'update events.inbox_items set state = $2, closed_at = now(), closed_by = $3, close_note = $4, updated_at = now() where id = $1 returning *',
        [id, closedState[a.action], a.by, note],
      );
      return { row: rows[0], before, line: { action: a.action, by: a.by, ...(note ? { note } : {}) }, change: 'closed' };
    });
  }

  async list({ person, teams, tab, floor, before, limit }: InboxQuery) {
    // A cursor that names no item continues from nowhere: an empty page, not the first one again.
    if (before !== undefined && !UUID.test(before)) return [];
    const where = {
      you: `state = 'open' and ((owner_kind = 'person' and owner_id = $1) or taken_by = $1)`,
      teams: `state = 'open' and owner_kind = 'team' and owner_id = any($2::text[]) and taken_by is null`,
      done: `state <> 'open' and closed_at >= now() - make_interval(days => ${DONE_DAYS})
             and ((owner_kind = 'person' and owner_id = $1) or taken_by = $1 or closed_by = $1
                  or exists (select 1 from events.inbox_history h where h.item_id = i.id and h.by = $1 and h.action <> 'created'))`,
    }[tab];
    const order = tab === 'done' ? 'closed_at' : 'created_at';
    const { rows } = await this.pool.query<ItemRow>(
      `select * from events.inbox_items i
       where $1::text is not null and $2::text[] is not null and ${where} and ($3::text is null or workspace_id = $3)
         and ($4::uuid is null or (${order}, id) < (select ${order}, id from events.inbox_items where id = $4))
       order by ${order} desc, id desc limit $5`,
      [person, teams, floor ?? null, before ?? null, limit],
    );
    return rows.map(fromItemRow);
  }

  async counts(person: string, teams: string[], leadTeams: string[]) {
    const { rows } = await this.pool.query<InboxCounts>(
      `select
         (select count(*) from events.inbox_items where state = 'open' and ((owner_kind = 'person' and owner_id = $1) or taken_by = $1))::int as you,
         (select count(*) from events.inbox_items where state = 'open' and ((owner_kind = 'person' and owner_id = $1) or taken_by = $1) and due_at < now())::int as overdue,
         (select count(*) from events.inbox_items where state = 'open' and owner_kind = 'team' and owner_id = any($2::text[]) and taken_by is null
            and (team_role is null or owner_id = any($3::text[])))::int as teams`,
      [person, teams, leadTeams],
    );
    return rows[0];
  }

  async prune(keepDays: number) {
    const { rowCount } = await this.pool.query('delete from events.inbox_items where closed_at < now() - make_interval(days => $1)', [keepDays]);
    return rowCount ?? 0;
  }
}

export { overdue };
