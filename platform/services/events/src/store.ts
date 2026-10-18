import { EventEmitter } from 'node:events';
import pg from 'pg';
import type { NewAuditEntry, NewNotification, NotificationLevel } from '@platform/service-kit';

/** One notification for one person. */
export interface Notification {
  id: string;
  recipient: string;
  app: string;
  level: NotificationLevel;
  title: string;
  detail?: string;
  link?: string;
  createdAt: string;
  readAt?: string;
}

export interface AuditEntry extends NewAuditEntry {
  id: string;
  at: string;
}

export interface AuditFilter {
  app?: string;
  actor?: string;
  limit: number;
}

export type Listener = (n: Notification) => void;

export interface EventStore {
  /** Adds one notification per recipient and tells every listener, on every instance. */
  addNotifications(n: NewNotification): Promise<Notification[]>;
  /** A person's unread notifications, newest first. */
  unread(recipient: string, limit: number): Promise<Notification[]>;
  /** Marks a person's notification read or unread; false when they have no such notification. */
  setRead(recipient: string, id: string, read: boolean): Promise<boolean>;
  appendAudit(entry: NewAuditEntry): Promise<AuditEntry>;
  /** Newest first. */
  audit(filter: AuditFilter): Promise<AuditEntry[]>;
  subscribe(listener: Listener): () => void;
}

const fromInput = (n: NewNotification, recipient: string, id: string, createdAt: string): Notification => ({
  id,
  recipient,
  app: n.app,
  level: n.level,
  title: n.title,
  ...(n.detail ? { detail: n.detail } : {}),
  ...(n.link ? { link: n.link } : {}),
  createdAt,
});

/** For tests, and for running locally without Postgres. Forgets everything on restart. */
export class MemoryEventStore implements EventStore {
  private notifications: Notification[] = [];
  private entries: AuditEntry[] = [];
  private emitter = new EventEmitter().setMaxListeners(0);
  private seq = 0;

  async addNotifications(n: NewNotification) {
    const now = new Date().toISOString();
    const added = n.recipients.map((r) => fromInput(n, r, String(++this.seq), now));
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

  async appendAudit(entry: NewAuditEntry) {
    const e = { ...entry, id: String(++this.seq), at: new Date().toISOString() };
    this.entries.push(e);
    return e;
  }

  async audit({ app, actor, limit }: AuditFilter) {
    return this.entries
      .filter((e) => (!app || e.app === app) && (!actor || e.actor.id === actor))
      .reverse()
      .slice(0, limit);
  }

  subscribe(listener: Listener) {
    this.emitter.on('notification', listener);
    return () => void this.emitter.off('notification', listener);
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
];

const CHANNEL = 'events_notification';

type NotificationRow = {
  id: string;
  recipient: string;
  app: string;
  level: NotificationLevel;
  title: string;
  detail: string | null;
  link: string | null;
  created_at: Date;
  read_at: Date | null;
};

const fromRow = (r: NotificationRow): Notification => ({
  id: r.id,
  recipient: r.recipient,
  app: r.app,
  level: r.level,
  title: r.title,
  ...(r.detail ? { detail: r.detail } : {}),
  ...(r.link ? { link: r.link } : {}),
  createdAt: r.created_at.toISOString(),
  ...(r.read_at ? { readAt: r.read_at.toISOString() } : {}),
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
};

const fromAuditRow = (r: AuditRow): AuditEntry => ({
  id: String(r.id),
  at: r.at.toISOString(),
  actor: { id: r.actor_id, kind: r.actor_kind },
  app: r.app,
  action: r.action,
  ...(r.target ? { target: r.target } : {}),
  ...(r.detail ? { detail: r.detail } : {}),
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
      this.emitter.emit('notification', JSON.parse(msg.payload) as Notification);
    });
    await this.listening.query(`listen ${CHANNEL}`);
  }

  async addNotifications(n: NewNotification) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<NotificationRow>(
        `insert into events.notifications (recipient, app, level, title, detail, link)
         select r, $2, $3, $4, $5, $6 from unnest($1::text[]) as r
         returning *`,
        [n.recipients, n.app, n.level, n.title, n.detail ?? null, n.link ?? null],
      );
      const added = rows.map(fromRow);
      // Delivered when the transaction commits; validation keeps each well under the 8000-byte payload limit.
      for (const a of added) await client.query('select pg_notify($1, $2)', [CHANNEL, JSON.stringify(a)]);
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

  async appendAudit(e: NewAuditEntry) {
    const { rows } = await this.pool.query<AuditRow>(
      `insert into events.audit (actor_id, actor_kind, app, action, target, detail) values ($1, $2, $3, $4, $5, $6) returning *`,
      [e.actor.id, e.actor.kind, e.app, e.action, e.target ?? null, e.detail ?? null],
    );
    return fromAuditRow(rows[0]);
  }

  async audit({ app, actor, limit }: AuditFilter) {
    const { rows } = await this.pool.query<AuditRow>(
      `select * from events.audit where ($1::text is null or app = $1) and ($2::text is null or actor_id = $2)
       order by at desc, id desc limit $3`,
      [app ?? null, actor ?? null, limit],
    );
    return rows.map(fromAuditRow);
  }

  subscribe(listener: Listener) {
    this.emitter.on('notification', listener);
    return () => void this.emitter.off('notification', listener);
  }

  async close() {
    this.listening?.release();
    await this.pool.end();
  }
}
