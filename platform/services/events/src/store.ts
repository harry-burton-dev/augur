import { EventEmitter } from 'node:events';
import pg from 'pg';
import type { NewAuditEntry, NewNotification, NotificationAction, NotificationLevel } from '@augur/service-kit';

/** The floor something happened on, with its path from the root as it stood then, so it stays right after a team moves. */
export interface EventFloor {
  id: string;
  path: string[];
}

/** One notification for one person. */
export interface Notification {
  id: string;
  recipient: string;
  app: string;
  level: NotificationLevel;
  title: string;
  detail?: string;
  link?: string;
  /** Up to two buttons, each raising an intent in the person's browser. */
  actions?: NotificationAction[];
  createdAt: string;
  readAt?: string;
  /** The floor it's from; none for one about the platform as a whole. */
  workspace?: EventFloor;
}

export interface AuditEntry extends NewAuditEntry {
  id: string;
  at: string;
  workspace?: EventFloor;
}

export interface AuditFilter {
  app?: string;
  actor?: string;
  /** Only entries at or after this time, and before this one. */
  since?: string;
  until?: string;
  /** The id of the oldest entry already shown: only entries older than it, for the next page. */
  before?: string;
  /** Only entries on this floor or a floor below it, as they stood when written. */
  workspace?: string;
  limit: number;
}

export type Listener = (n: Notification) => void;

/**
 * Something that happened in a service, told to whichever services follow its
 * topic: "folio.document.published", "platform.team.archived". Unlike a
 * notification it is for services, not people, and carries ids, not content.
 */
export interface DomainEvent {
  /** Its place in the one order every follower reads in; pass the last one seen as `after`. */
  seq: string;
  topic: string;
  /** The publisher's own id for it, so sending it twice keeps one. */
  id: string;
  /** The app or platform service that published it. */
  publisher: string;
  at: string;
  workspace?: EventFloor;
  payload: unknown;
}

export interface NewDomainEvent {
  topic: string;
  id: string;
  payload: unknown;
  floor?: EventFloor;
}

export interface EventsQuery {
  /** Topic names, or a family such as "folio.*". */
  topics: string[];
  /** Only events after this `seq`. */
  after?: string;
  limit: number;
}

/** Whether a topic is one of those asked for: an exact name, or under a "family.*". */
export const topicMatches = (topic: string, wanted: string[]) =>
  wanted.some((w) => (w.endsWith('.*') ? topic.startsWith(w.slice(0, -1)) : topic === w));

export interface EventStore {
  /** Adds one notification per recipient and tells every listener, on every instance. */
  addNotifications(n: NewNotification, floor?: EventFloor): Promise<Notification[]>;
  /** A person's unread notifications, newest first. */
  unread(recipient: string, limit: number): Promise<Notification[]>;
  /** Marks a person's notification read or unread; false when they have no such notification. */
  setRead(recipient: string, id: string, read: boolean): Promise<boolean>;
  appendAudit(entry: NewAuditEntry, floor?: EventFloor): Promise<AuditEntry>;
  /** Newest first. */
  audit(filter: AuditFilter): Promise<AuditEntry[]>;
  subscribe(listener: Listener): () => void;
  /** Whether a team has turned team notices on. */
  teamNotices(workspace: string): Promise<boolean>;
  setTeamNotices(workspace: string, on: boolean, by: string): Promise<void>;
  /** Adds events, all or none; one the publisher already sent (same id) is skipped. */
  publish(publisher: string, events: NewDomainEvent[]): Promise<{ added: number; repeated: number }>;
  /** Events on these topics in publishing order, never leaving a gap a later read would fill. */
  readEvents(query: EventsQuery): Promise<DomainEvent[]>;
  /** Forgets events older than this many days; returns how many went. */
  pruneEvents(keepDays: number): Promise<number>;
}

const fromInput = (n: NewNotification, recipient: string, id: string, createdAt: string, floor?: EventFloor): Notification => ({
  id,
  recipient,
  app: n.app,
  level: n.level,
  title: n.title,
  ...(n.detail ? { detail: n.detail } : {}),
  ...(n.link ? { link: n.link } : {}),
  ...(n.actions?.length ? { actions: n.actions } : {}),
  createdAt,
  ...(floor ? { workspace: floor } : {}),
});

const under = (floor: EventFloor | undefined, workspace: string) => !!floor?.path.includes(workspace);

/** For tests, and for running locally without Postgres. Forgets everything on restart. */
export class MemoryEventStore implements EventStore {
  private notifications: Notification[] = [];
  private entries: AuditEntry[] = [];
  private emitter = new EventEmitter().setMaxListeners(0);
  private seq = 0;
  private teams = new Set<string>();

  async addNotifications(n: NewNotification, floor?: EventFloor) {
    const now = new Date().toISOString();
    const added = n.recipients.map((r) => fromInput(n, r, String(++this.seq), now, floor));
    this.notifications.push(...added);
    for (const a of added) this.emitter.emit('notification', a);
    return added;
  }

  async unread(recipient: string, limit: number) {
    return this.notifications
      .filter((n) => n.recipient === recipient && !n.readAt)
      .reverse()
      .slice(0, limit);
  }

  async setRead(recipient: string, id: string, read: boolean) {
    const n = this.notifications.find((x) => x.id === id && x.recipient === recipient);
    if (!n) return false;
    if (read) n.readAt ??= new Date().toISOString();
    else delete n.readAt;
    return true;
  }

  async appendAudit(entry: NewAuditEntry, floor?: EventFloor) {
    const e = { ...entry, id: String(++this.seq), at: new Date().toISOString(), ...(floor ? { workspace: floor } : {}) };
    this.entries.push(e);
    return e;
  }

  async audit({ app, actor, since, until, before, workspace, limit }: AuditFilter) {
    const cursor = before === undefined ? this.entries.length : this.entries.findIndex((e) => e.id === before);
    return this.entries
      .slice(0, cursor < 0 ? 0 : cursor)
      .filter((e) => (!app || e.app === app) && (!actor || e.actor.id === actor) && (!since || e.at >= since) && (!until || e.at < until) && (!workspace || under(e.workspace, workspace)))
      .reverse()
      .slice(0, limit);
  }

  subscribe(listener: Listener) {
    this.emitter.on('notification', listener);
    return () => void this.emitter.off('notification', listener);
  }

  async teamNotices(workspace: string) {
    return this.teams.has(workspace);
  }

  async setTeamNotices(workspace: string, on: boolean) {
    if (on) this.teams.add(workspace);
    else this.teams.delete(workspace);
  }

  private domainEvents: DomainEvent[] = [];
  private eventSeq = 0;

  async publish(publisher: string, events: NewDomainEvent[]) {
    let added = 0;
    const at = new Date().toISOString();
    for (const e of events) {
      if (this.domainEvents.some((d) => d.publisher === publisher && d.id === e.id)) continue;
      this.domainEvents.push({ seq: String(++this.eventSeq), topic: e.topic, id: e.id, publisher, at, ...(e.floor ? { workspace: e.floor } : {}), payload: e.payload });
      added++;
    }
    return { added, repeated: events.length - added };
  }

  async readEvents({ topics, after, limit }: EventsQuery) {
    return this.domainEvents.filter((e) => Number(e.seq) > Number(after ?? 0) && topicMatches(e.topic, topics)).slice(0, limit);
  }

  async pruneEvents(keepDays: number) {
    const cutoff = new Date(Date.now() - keepDays * 86_400_000).toISOString();
    const before = this.domainEvents.length;
    this.domainEvents = this.domainEvents.filter((e) => e.at >= cutoff);
    return before - this.domainEvents.length;
  }
}

/** Schema changes, applied in order and recorded so each runs once. The events service owns the `events` schema. */
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_notifications_and_audit',
    sql: `
      create table events.notifications (
        id uuid primary key default gen_random_uuid(),
        recipient text not null,
        app text not null,
        level text not null,
        title text not null,
        detail text,
        link text,
        created_at timestamptz not null default now(),
        read_at timestamptz
      );
      create index notifications_unread on events.notifications (recipient, created_at desc) where read_at is null;

      -- Append-only: nothing in the service updates or deletes audit entries.
      create table events.audit (
        id bigint generated always as identity primary key,
        at timestamptz not null default now(),
        actor_id text not null,
        actor_kind text not null,
        app text not null,
        action text not null,
        target text,
        detail jsonb
      );
      create index audit_app on events.audit (app, at desc);
      create index audit_actor on events.audit (actor_id, at desc);`,
  },
  {
    id: '002_floors',
    sql: `
      -- The floor each one happened on, and its path from the root as it stood then.
      alter table events.notifications add column workspace_id text, add column workspace_path text[];
      alter table events.audit add column workspace_id text, add column workspace_path text[];
      create index audit_workspace_path on events.audit using gin (workspace_path);
      -- Teams that have turned team notices on.
      create table events.team_notices (
        workspace_id text primary key,
        set_by text not null,
        set_at timestamptz not null default now()
      );`,
  },
  {
    id: '003_actions',
    sql: `
      -- Up to two buttons on a notification, each an intent the shell raises.
      alter table events.notifications add column actions jsonb;`,
  },
  {
    id: '004_domain_events',
    sql: `
      -- What services tell each other, read by followers in seq order. xid is the inserting
      -- transaction, so a read never returns a seq while a lower one could still commit.
      create table events.domain_events (
        seq bigint generated always as identity primary key,
        topic text not null,
        id text not null,
        publisher text not null,
        at timestamptz not null default now(),
        workspace_id text,
        workspace_path text[],
        payload jsonb not null,
        xid xid8 not null default pg_current_xact_id(),
        unique (publisher, id)
      );
      create index domain_events_topic on events.domain_events (topic, seq);
      create index domain_events_at on events.domain_events (at);`,
  },
];

const CHANNEL = 'events_notification';
const NOTIFY_BYTES = 7900;

type NotificationRow = {
  id: string;
  recipient: string;
  app: string;
  level: NotificationLevel;
  title: string;
  detail: string | null;
  link: string | null;
  actions: NotificationAction[] | null;
  created_at: Date;
  read_at: Date | null;
  workspace_id: string | null;
  workspace_path: string[] | null;
};

const floorFrom = (id: string | null, path: string[] | null) => (id ? { workspace: { id, path: path ?? [id] } } : {});

const fromRow = (r: NotificationRow): Notification => ({
  id: r.id,
  recipient: r.recipient,
  app: r.app,
  level: r.level,
  title: r.title,
  ...(r.detail ? { detail: r.detail } : {}),
  ...(r.link ? { link: r.link } : {}),
  ...(r.actions?.length ? { actions: r.actions } : {}),
  createdAt: r.created_at.toISOString(),
  ...(r.read_at ? { readAt: r.read_at.toISOString() } : {}),
  ...floorFrom(r.workspace_id, r.workspace_path),
});

type AuditRow = {
  id: string;
  at: Date;
  actor_id: string;
  actor_kind: 'user' | 'service';
  app: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  workspace_id: string | null;
  workspace_path: string[] | null;
};

const fromAuditRow = (r: AuditRow): AuditEntry => ({
  id: String(r.id),
  at: r.at.toISOString(),
  actor: { id: r.actor_id, kind: r.actor_kind },
  app: r.app,
  action: r.action,
  ...(r.target ? { target: r.target } : {}),
  ...(r.detail ? { detail: r.detail } : {}),
  ...floorFrom(r.workspace_id, r.workspace_path),
});

/**
 * Notifications and the audit log in Postgres. New notifications are announced
 * with LISTEN/NOTIFY, so whichever instance holds a person's stream sees them.
 */
export class PgEventStore implements EventStore {
  private emitter = new EventEmitter().setMaxListeners(0);
  private listening?: pg.PoolClient;

  constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string) {
    const store = new PgEventStore(new pg.Pool({ connectionString }));
    await store.migrate();
    await store.listen();
    return store;
  }

  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('events.migrate'))");
      await client.query('create schema if not exists events');
      await client.query('create table if not exists events.migrations (id text primary key, applied_at timestamptz not null default now())');
      const { rows } = await client.query<{ id: string }>('select id from events.migrations');
      const applied = new Set(rows.map((r) => r.id));
      for (const m of migrations.filter((m) => !applied.has(m.id))) {
        await client.query(m.sql);
        await client.query('insert into events.migrations (id) values ($1)', [m.id]);
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Holds one connection open to hear about notifications added by any instance. */
  async listen() {
    this.listening = await this.pool.connect();
    this.listening.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      const sent = JSON.parse(msg.payload) as Notification | { ref: string };
      if (!('ref' in sent)) return void this.emitter.emit('notification', sent);
      // Too big to travel whole: read it back.
      void this.pool
        .query<NotificationRow>('select * from events.notifications where id = $1', [sent.ref])
        .then(({ rows }) => rows[0] && this.emitter.emit('notification', fromRow(rows[0])))
        .catch(() => undefined);
    });
    await this.listening.query(`listen ${CHANNEL}`);
  }

  async addNotifications(n: NewNotification, floor?: EventFloor) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<NotificationRow>(
        `insert into events.notifications (recipient, app, level, title, detail, link, workspace_id, workspace_path, actions)
         select r, $2, $3, $4, $5, $6, $7, $8, $9 from unnest($1::text[]) as r
         returning *`,
        [n.recipients, n.app, n.level, n.title, n.detail ?? null, n.link ?? null, floor?.id ?? null, floor?.path ?? null, n.actions?.length ? JSON.stringify(n.actions) : null],
      );
      const added = rows.map(fromRow);
      // Delivered when the transaction commits. Postgres caps a payload at 8000 bytes; a bigger one goes by id.
      for (const a of added) {
        const whole = JSON.stringify(a);
        await client.query('select pg_notify($1, $2)', [CHANNEL, Buffer.byteLength(whole) < NOTIFY_BYTES ? whole : JSON.stringify({ ref: a.id })]);
      }
      await client.query('commit');
      return added;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async unread(recipient: string, limit: number) {
    const { rows } = await this.pool.query<NotificationRow>(
      'select * from events.notifications where recipient = $1 and read_at is null order by created_at desc, id limit $2',
      [recipient, limit],
    );
    return rows.map(fromRow);
  }

  async setRead(recipient: string, id: string, read: boolean) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
    const { rowCount } = await this.pool.query(
      read
        ? 'update events.notifications set read_at = coalesce(read_at, now()) where id = $1 and recipient = $2'
        : 'update events.notifications set read_at = null where id = $1 and recipient = $2',
      [id, recipient],
    );
    return rowCount === 1;
  }

  async appendAudit(e: NewAuditEntry, floor?: EventFloor) {
    const { rows } = await this.pool.query<AuditRow>(
      `insert into events.audit (actor_id, actor_kind, app, action, target, detail, workspace_id, workspace_path) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [e.actor.id, e.actor.kind, e.app, e.action, e.target ?? null, e.detail ?? null, floor?.id ?? null, floor?.path ?? null],
    );
    return fromAuditRow(rows[0]);
  }

  async audit({ app, actor, since, until, before, workspace, limit }: AuditFilter) {
    // The cursor is an entry's id; a page continues from that entry's place in (at, id) order.
    const { rows } = await this.pool.query<AuditRow>(
      `select * from events.audit
       where ($1::text is null or app = $1) and ($2::text is null or actor_id = $2)
         and ($3::timestamptz is null or at >= $3) and ($4::timestamptz is null or at < $4)
         and ($5::bigint is null or (at, id) < (select at, id from events.audit where id = $5))
         and ($7::text is null or workspace_path @> array[$7::text])
       order by at desc, id desc limit $6`,
      [app ?? null, actor ?? null, since ?? null, until ?? null, before ?? null, limit, workspace ?? null],
    );
    return rows.map(fromAuditRow);
  }

  subscribe(listener: Listener) {
    this.emitter.on('notification', listener);
    return () => void this.emitter.off('notification', listener);
  }

  async teamNotices(workspace: string) {
    const { rowCount } = await this.pool.query('select 1 from events.team_notices where workspace_id = $1', [workspace]);
    return !!rowCount;
  }

  async setTeamNotices(workspace: string, on: boolean, by: string) {
    await this.pool.query(
      on ? 'insert into events.team_notices (workspace_id, set_by) values ($1, $2) on conflict do nothing' : 'delete from events.team_notices where workspace_id = $1',
      on ? [workspace, by] : [workspace],
    );
  }

  async publish(publisher: string, events: NewDomainEvent[]) {
    const { rowCount } = await this.pool.query(
      `insert into events.domain_events (topic, id, publisher, workspace_id, workspace_path, payload)
       select e.topic, e.id, $1, e.workspace_id, e.workspace_path, coalesce(e.payload, 'null'::jsonb)
       from jsonb_to_recordset($2::jsonb) as e(topic text, id text, workspace_id text, workspace_path text[], payload jsonb)
       on conflict (publisher, id) do nothing`,
      [publisher, JSON.stringify(events.map((e) => ({ topic: e.topic, id: e.id, workspace_id: e.floor?.id ?? null, workspace_path: e.floor?.path ?? null, payload: e.payload ?? null })))],
    );
    return { added: rowCount ?? 0, repeated: events.length - (rowCount ?? 0) };
  }

  async readEvents({ topics, after, limit }: EventsQuery) {
    const exact = topics.filter((t) => !t.endsWith('.*'));
    const families = topics.filter((t) => t.endsWith('.*')).map((t) => `${t.slice(0, -1)}%`);
    // Only what every earlier transaction has settled: a seq handed out to a transaction still
    // running would otherwise commit below the follower's cursor and never be read.
    const { rows } = await this.pool.query<{ seq: string; topic: string; id: string; publisher: string; at: Date; workspace_id: string | null; workspace_path: string[] | null; payload: unknown }>(
      `select seq, topic, id, publisher, at, workspace_id, workspace_path, payload from events.domain_events
       where seq > $1 and (topic = any($2::text[]) or topic like any($3::text[]))
         and xid < pg_snapshot_xmin(pg_current_snapshot())
       order by seq limit $4`,
      [after ?? '0', exact, families, limit],
    );
    return rows.map((r) => ({ seq: String(r.seq), topic: r.topic, id: r.id, publisher: r.publisher, at: r.at.toISOString(), ...floorFrom(r.workspace_id, r.workspace_path), payload: r.payload }));
  }

  async pruneEvents(keepDays: number) {
    const { rowCount } = await this.pool.query(`delete from events.domain_events where at < now() - make_interval(days => $1)`, [keepDays]);
    return rowCount ?? 0;
  }

  async close() {
    this.listening?.release();
    await this.pool.end();
  }
}
