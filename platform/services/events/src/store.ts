import { EventEmitter } from 'node:events';
import pg from 'pg';
import { deliveriesMigration, PgDeliveryStore, type DeliveryStore } from './deliveries.ts';
import { digestMigration, PgDigestStore, type DigestStore } from './digests.ts';
import { emailMigration, PgEmailOutbox, type EmailOutbox } from './email-outbox.ts';
import { INBOX_CHANNEL, inboxMigration, PgInboxStore, type InboxStore } from './inbox.ts';
import { EVENT_CHANNEL, floorFrom, fromAuditRow, insertAudit, insertEvents, oneAtATime, refIn, type AuditRow } from './writes.ts';
import { leaveNoticeKey, PERSONAL_DETAIL_KEYS, REMOVED, runMigrations, steadyPool, type Migration, type NewAuditEntry, type NewNotification, type NotificationAction, type NotificationLevel } from '@augur/service-kit';

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
  /** The sender's name for this news: a person has at most one per app and key. */
  key?: string;
  /** One of the app's `notifications.kinds`. */
  kind?: string;
  /** Platform news that stops work (ADR 0044 D3): the shell may letterbox it. Only platform services send it. */
  urgent?: boolean;
  createdAt: string;
  readAt?: string;
  /** The floor it's from; none for one about the platform as a whole. */
  workspace?: EventFloor;
}

export interface AuditEntry extends NewAuditEntry {
  id: string;
  at: string;
  workspace?: EventFloor;
  /**
   * The service that wrote the entry, from its signed token: an app's id or a platform
   * service's name. `actor` is what that service says; this is who said it. Missing on
   * entries written before it was kept.
   */
  recordedBy?: string;
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
  /** Only entries about this target. */
  target?: string;
  /** Only entries by, about or naming this person: the actor, the target or `detail.person`. */
  person?: string;
  /** Sign-ins (`detail.kind` is `sign-in`, copied from the sign-in service) or every other change. */
  kind?: 'change' | 'sign-in';
  limit: number;
}

/** What redacting one person removed. */
export interface Redacted {
  entries: number;
  notifications: number;
}

const PERSONAL = new Set<string>(PERSONAL_DETAIL_KEYS);

/**
 * A detail with every personal value replaced (ADR 0040): values under PERSONAL_DETAIL_KEYS, at any depth, and both
 * sides of a `{ from, to }` change under one. Undefined when nothing changed.
 */
export const redactDetail = (detail: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  let changed = false;
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        if (!PERSONAL.has(k)) return [k, walk(v)];
        if (v === REMOVED) return [k, v];
        if (v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v)) {
          const pair = v as Record<string, unknown>;
          const out = { ...('from' in pair ? { from: REMOVED } : {}), ...('to' in pair ? { to: REMOVED } : {}) };
          if (Object.entries(pair).some(([side, x]) => out[side as 'from' | 'to'] !== x)) changed = true;
          return [k, out];
        }
        changed = true;
        return [k, REMOVED];
      }),
    );
  };
  const out = walk(detail) as Record<string, unknown> | undefined;
  return changed ? out : undefined;
};

export type Listener = (n: Notification) => void;
/** Hears each domain event as it is published, on any instance: a live hint, not the record (read that with `readEvents`). */
export type EventListener = (e: DomainEvent) => void;

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
  /** Topic names, or a family such as "folio.*"; "*" alone is every topic (the deliverer's read). */
  topics: string[];
  /** Only events after this `seq`. */
  after?: string;
  /** Only events up to this `seq`. */
  upTo?: string;
  limit: number;
}

/** Whether a topic is one of those asked for: an exact name, or under a "family.*". */
export const topicMatches = (topic: string, wanted: string[]) =>
  wanted.some((w) => (w.endsWith('.*') ? topic.startsWith(w.slice(0, -1)) : topic === w));

/** A leaver's team items still to give back: those of one team, or of every team when `team` is left out. */
export interface InboxRelease {
  person: string;
  team?: string;
}

/** What goes in the same transaction as an audit entry: all of it is kept, or none. */
export interface AuditWith {
  /** The sender's name for this entry: sent again, the first entry is answered and nothing else is written. */
  key?: string;
  /** The domain event that says the same thing, once the entry has its id. */
  event?: (entry: AuditEntry) => { publisher: string; event: NewDomainEvent };
  /** Team items to give back, kept until `releaseDone` says they went. */
  release?: InboxRelease;
}

export interface EventStore {
  /** The Inbox's items (ADR 0026), in the same database. */
  readonly inbox: InboxStore;
  /** The notifications waiting to be emailed (ADR 0044, D7). */
  readonly emails: EmailOutbox;
  /** Each person's last daily and weekly digest. */
  readonly digests: DigestStore;
  /** Where each subscribing app has got to in the events pushed to its part (contract 3, spec 8.6). */
  readonly deliveries: DeliveryStore;
  /**
   * Adds one notification per recipient and tells every listener, on every instance.
   * With a key, skips anyone who already has one from that app with that key.
   */
  addNotifications(n: NewNotification, floor?: EventFloor): Promise<Notification[]>;
  /** A person's unread notifications, newest first. */
  unread(recipient: string, limit: number): Promise<Notification[]>;
  /** One of a person's notifications, read or not; undefined when they have no such one. */
  notification(recipient: string, id: string): Promise<Notification | undefined>;
  /** Every notification a person has, read or not, newest first: for a copy of their data. */
  notificationsOf(recipient: string, limit: number): Promise<Notification[]>;
  /** Marks a person's notification read or unread; false when they have no such notification. */
  setRead(recipient: string, id: string, read: boolean): Promise<boolean>;
  /**
   * Entries are never edited, except redaction of a deleted person's personal values; they're removed only by the
   * retention period. Both are recorded in Activity.
   */
  appendAudit(entry: NewAuditEntry, floor?: EventFloor, recordedBy?: string, also?: AuditWith): Promise<AuditEntry>;
  /** Newest first. */
  audit(filter: AuditFilter): Promise<AuditEntry[]>;
  subscribe(listener: Listener): () => void;
  /**
   * Tells the listener of each domain event as it is published, on every instance. At most once and
   * only while listening: for a browser to refresh what it shows, never for a service to keep up.
   */
  onEvent(listener: EventListener): () => void;
  /** Whether a team has turned team notices on. */
  teamNotices(workspace: string): Promise<boolean>;
  /** Turns them on or off and, when that changed anything, records it in Activity on `floor`, all or none. */
  setTeamNotices(workspace: string, on: boolean, by: string, floor?: EventFloor): Promise<void>;
  /** Adds events, all or none; one the publisher already sent (same id) is skipped. */
  publish(publisher: string, events: NewDomainEvent[]): Promise<{ added: number; repeated: number }>;
  /** Events on these topics in the order they committed, which is seq order: a later read can't fill a gap. */
  readEvents(query: EventsQuery): Promise<DomainEvent[]>;
  /** The highest seq committed, of any topic; undefined with no events kept. */
  lastSeq(): Promise<string | undefined>;
  /** Forgets events older than this many days; returns how many went. */
  pruneEvents(keepDays: number): Promise<number>;
  /** Removes Activity entries older than this many days (the retention period, ADR 0040); returns how many went. */
  pruneAudit(keepDays: number): Promise<number>;
  /**
   * Forgets a deleted person (ADR 0040): replaces the personal values in every Activity entry by, about or naming
   * them, deletes their notifications and the notice that they asked to leave, blanks the notes they left on
   * inbox items and withdraws the open items that were theirs. Their id stays, now pseudonymous.
   */
  redactPerson(person: string): Promise<Redacted>;
  /** Team items still to give back, oldest first: a release that failed part way is carried on from these. */
  releasesDue(): Promise<InboxRelease[]>;
  releaseDone(release: InboxRelease): Promise<void>;
}

/** Schema changes, applied in order and recorded so each runs once. The events service owns the `events` schema. */
export const migrations: Migration[] = [
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
  {
    id: '005_audit_recorded_by',
    sql: `
      -- The service that wrote each entry, from its signed token, beside the actor it named.
      alter table events.audit add column recorded_by text;`,
  },
  {
    id: '006_notification_keys',
    sql: `
      -- The sender's name for a piece of news (ADR 0044): a person is told it once per app.
      alter table events.notifications add column key text;
      create unique index notifications_once on events.notifications (recipient, app, key) where key is not null;`,
  },
  inboxMigration,
  {
    id: '008_notification_kinds',
    sql: `
      -- Which of the app's declared kinds a notification is (ADR 0036): people choose how each kind reaches them.
      alter table events.notifications add column kind text;`,
  },
  {
    id: '009_audit_by_person',
    sql: `
      -- A person's Activity (ADR 0040): entries about them, and entries naming them in their detail.
      create index audit_target on events.audit (target, at desc);
      create index audit_detail_person on events.audit ((detail->>'person'));`,
  },
  emailMigration,
  digestMigration,
  {
    id: '012_urgent_notifications',
    sql: `
      -- Platform news that stops work (ADR 0044 D3): the shell may letterbox it.
      alter table events.notifications add column urgent boolean not null default false;`,
  },
  {
    id: '013_one_write_each',
    sql: `
      -- A sender's name for an entry, so sending it again keeps one.
      alter table events.audit add column idempotency_key text;
      create unique index audit_once on events.audit (recorded_by, idempotency_key) where idempotency_key is not null;
      -- Whose turn it is to publish, as a lock on this table: seq order is commit order. It holds no rows.
      create table events.publish_turn ();
      -- A leaver's team items still to give back ('' for every team), until every one has gone.
      create table events.inbox_releases (
        person text not null,
        team text not null default '',
        asked_at timestamptz not null default now(),
        primary key (person, team)
      );
      -- Who hears of each change to an item, so a NOTIFY needs to carry only the history line's id.
      alter table events.inbox_history add column signal jsonb;`,
  },
  {
    id: '014_forget_notes',
    sql: `
      -- A leaver's note is a personal value now. Those already redacted lose it here, as redaction would have done.
      update events.audit a set detail = jsonb_set(a.detail, '{note}', '"${REMOVED}"')
      where a.action in ('person.left', 'account.leave-requested') and a.detail ? 'note'
        and exists (select 1 from events.audit r where r.action = 'audit.redacted' and r.detail->>'person' in (a.target, a.actor_id));
      -- Only the notices naming someone already deleted, which nothing should show.
      -- squawk-ignore augur-delete-rows
      delete from events.notifications n
      where exists (select 1 from events.audit r where r.action = 'audit.redacted' and starts_with(n.key, 'leave:' || (r.detail->>'person') || ':'));`,
  },
  deliveriesMigration,
];

/** Each new notification, by id. The channels carry ids only: see `refIn`. */
const CHANNEL = 'events_notification';
const NOTIFICATION_ID = /^[0-9a-f-]{36}$/i;
const SEQ = /^[0-9]{1,19}$/;

type NotificationRow = {
  id: string;
  recipient: string;
  app: string;
  level: NotificationLevel;
  title: string;
  detail: string | null;
  link: string | null;
  actions: NotificationAction[] | null;
  key: string | null;
  kind: string | null;
  urgent: boolean | null;
  created_at: Date;
  read_at: Date | null;
  workspace_id: string | null;
  workspace_path: string[] | null;
};

type DomainEventRow = { seq: string; topic: string; id: string; publisher: string; at: Date; workspace_id: string | null; workspace_path: string[] | null; payload: unknown };

const fromEventRow = (r: DomainEventRow): DomainEvent => ({
  seq: r.seq,
  topic: r.topic,
  id: r.id,
  publisher: r.publisher,
  at: r.at.toISOString(),
  ...floorFrom(r.workspace_id, r.workspace_path),
  payload: r.payload,
});

const fromRow = (r: NotificationRow): Notification => ({
  id: r.id,
  recipient: r.recipient,
  app: r.app,
  level: r.level,
  title: r.title,
  ...(r.detail ? { detail: r.detail } : {}),
  ...(r.link ? { link: r.link } : {}),
  ...(r.actions?.length ? { actions: r.actions } : {}),
  ...(r.key ? { key: r.key } : {}),
  ...(r.kind ? { kind: r.kind } : {}),
  ...(r.urgent ? { urgent: true } : {}),
  createdAt: r.created_at.toISOString(),
  ...(r.read_at ? { readAt: r.read_at.toISOString() } : {}),
  ...floorFrom(r.workspace_id, r.workspace_path),
});

/**
 * Notifications and the audit log in Postgres. New notifications are announced
 * with LISTEN/NOTIFY, so whichever instance holds a person's stream sees them.
 */
export class PgEventStore implements EventStore {
  private emitter = new EventEmitter().setMaxListeners(0);
  private readBack = oneAtATime();
  private listening?: pg.PoolClient;
  private closed = false;
  readonly inbox: PgInboxStore;
  readonly emails: PgEmailOutbox;
  readonly digests: PgDigestStore;
  readonly deliveries: PgDeliveryStore;

  constructor(
    private readonly pool: pg.Pool,
    options: { inboxDoneDays?: number } = {},
  ) {
    this.inbox = new PgInboxStore(pool, options.inboxDoneDays);
    this.emails = new PgEmailOutbox(pool);
    this.digests = new PgDigestStore(pool);
    this.deliveries = new PgDeliveryStore(pool);
  }

  static async connect(connectionString: string, options: { inboxDoneDays?: number } = {}) {
    const store = new PgEventStore(steadyPool(new pg.Pool({ connectionString })), options);
    await store.migrate();
    await store.listen();
    return store;
  }

  async migrate() {
    await runMigrations(this.pool, { schema: 'events', migrations });
  }

  /**
   * Holds one connection open to hear about notifications added by any instance. When Postgres
   * restarts or drops it, it listens again on a new one, waiting a little longer each try, so open
   * streams don't go quiet for good. What was sent while it was gone is kept, and shows on the next load.
   */
  async listen(retryMs = 1000) {
    const client = await this.pool.connect();
    this.listening = client;
    let lost = false;
    const again = (why: string) => {
      if (lost || this.closed) return;
      lost = true;
      console.error(`The notification stream lost its database connection (${why}); listening again.`);
      if (this.listening === client) this.listening = undefined;
      client.release(true);
      const retry = (ms: number) =>
        setTimeout(() => {
          if (!this.closed) this.listen(retryMs).catch(() => retry(Math.min(ms * 2, 30_000)));
        }, ms).unref();
      retry(retryMs);
    };
    client.on('error', (err) => again(err.message));
    client.on('end', () => again('it ended'));
    client.on('notification', (msg) => {
      if (msg.channel === EVENT_CHANNEL && msg.payload) return void this.heardEvent(msg.payload);
      if (msg.channel === INBOX_CHANNEL && msg.payload) return void this.inbox.heard(msg.payload);
      if (msg.channel === CHANNEL && msg.payload) return void this.heardNotification(msg.payload);
    });
    await client.query(`listen ${CHANNEL}`);
    await client.query(`listen ${EVENT_CHANNEL}`);
    await client.query(`listen ${INBOX_CHANNEL}`);
  }

  private heardNotification(payload: string) {
    const ref = refIn(payload, NOTIFICATION_ID);
    if (!ref || !this.emitter.listenerCount('notification')) return;
    this.readBack(async () => {
      const { rows } = await this.pool.query<NotificationRow>('select * from events.notifications where id = $1', [ref]);
      if (rows[0]) this.emitter.emit('notification', fromRow(rows[0]));
    });
  }

  private heardEvent(payload: string) {
    const ref = refIn(payload, SEQ);
    if (!ref || !this.emitter.listenerCount('domain-event')) return;
    this.readBack(async () => {
      const { rows } = await this.pool.query<DomainEventRow>('select seq, topic, id, publisher, at, workspace_id, workspace_path, payload from events.domain_events where seq = $1', [ref]);
      if (rows[0]) this.emitter.emit('domain-event', fromEventRow(rows[0]));
    });
  }

  /** Runs `work` in one transaction on its own connection. */
  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const done = await work(client);
      await client.query('commit');
      return done;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  onEvent(listener: EventListener) {
    this.emitter.on('domain-event', listener);
    return () => void this.emitter.off('domain-event', listener);
  }

  async addNotifications(n: NewNotification, floor?: EventFloor) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<NotificationRow>(
        // One that needs someone is due to be emailed at once; the notice-emails job decides whether, and when.
        `insert into events.notifications (recipient, app, level, title, detail, link, workspace_id, workspace_path, actions, key, kind, email_due, urgent)
         select r, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, case when $3 = 'needs' then now() end, $12 from unnest($1::text[]) as r
         on conflict (recipient, app, key) where key is not null do nothing
         returning *`,
        [n.recipients, n.app, n.level, n.title, n.detail ?? null, n.link ?? null, floor?.id ?? null, floor?.path ?? null, n.actions?.length ? JSON.stringify(n.actions) : null, n.key ?? null, n.kind ?? null, !!n.urgent],
      );
      const added = rows.map(fromRow);
      // Delivered when the transaction commits.
      for (const a of added) await client.query('select pg_notify($1, $2)', [CHANNEL, JSON.stringify({ ref: a.id })]);
      await client.query('commit');
      return added;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async notification(recipient: string, id: string) {
    // Ids are uuids; anything else is no notification of theirs, not an error.
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    const { rows } = await this.pool.query<NotificationRow>('select * from events.notifications where id = $1 and recipient = $2', [id, recipient]);
    return rows[0] ? fromRow(rows[0]) : undefined;
  }

  async unread(recipient: string, limit: number) {
    const { rows } = await this.pool.query<NotificationRow>(
      'select * from events.notifications where recipient = $1 and read_at is null order by created_at desc, id limit $2',
      [recipient, limit],
    );
    return rows.map(fromRow);
  }

  async notificationsOf(recipient: string, limit: number) {
    const { rows } = await this.pool.query<NotificationRow>('select * from events.notifications where recipient = $1 order by created_at desc, id limit $2', [recipient, limit]);
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

  async appendAudit(e: NewAuditEntry, floor?: EventFloor, recordedBy?: string, also: AuditWith = {}) {
    return this.transaction(async (client) => {
      const { entry, added } = await insertAudit(client, e, floor, recordedBy, also.key);
      if (!added) return entry;
      if (also.release) {
        await client.query('insert into events.inbox_releases (person, team) values ($1, $2) on conflict do nothing', [also.release.person, also.release.team ?? '']);
      }
      if (also.event) {
        const { publisher, event } = also.event(entry);
        await insertEvents(client, publisher, [event]);
      }
      return entry;
    });
  }

  async audit({ app, actor, since, until, before, workspace, target, person, kind, limit }: AuditFilter) {
    // The cursor is an entry's id; a page continues from that entry's place in (at, id) order.
    const { rows } = await this.pool.query<AuditRow>(
      `select * from events.audit
       where ($1::text is null or app = $1) and ($2::text is null or actor_id = $2)
         and ($3::timestamptz is null or at >= $3) and ($4::timestamptz is null or at < $4)
         and ($5::bigint is null or (at, id) < (select at, id from events.audit where id = $5))
         and ($7::text is null or workspace_path @> array[$7::text])
         and ($8::text is null or target = $8)
         and ($9::text is null or actor_id = $9 or target = $9 or detail->>'person' = $9)
         and ($10::text is null or (($10 = 'sign-in') = coalesce(detail->>'kind' = 'sign-in', false)))
       order by at desc, id desc limit $6`,
      [app ?? null, actor ?? null, since ?? null, until ?? null, before ?? null, limit, workspace ?? null, target ?? null, person ?? null, kind ?? null],
    );
    return rows.map(fromAuditRow);
  }

  async pruneAudit(keepDays: number) {
    const { rowCount } = await this.pool.query('delete from events.audit where at < now() - make_interval(days => $1)', [keepDays]);
    return rowCount ?? 0;
  }

  async redactPerson(person: string) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<{ id: string; detail: Record<string, unknown> | null }>(
        `select id, detail from events.audit where detail is not null and (actor_id = $1 or target = $1 or detail->>'person' = $1) for update`,
        [person],
      );
      let entries = 0;
      for (const r of rows) {
        const detail = redactDetail(r.detail ?? undefined);
        if (!detail) continue;
        await client.query('update events.audit set detail = $2 where id = $1', [r.id, detail]);
        entries++;
      }
      const { rowCount } = await client.query('delete from events.notifications where recipient = $1 or starts_with(key, $2)', [person, leaveNoticeKey(person)]);
      await client.query('update events.inbox_history set note = null where by = $1 and note is not null', [person]);
      await client.query('update events.inbox_items set close_note = null where closed_by = $1 and close_note is not null', [person]);
      // Nobody can act on what was theirs now, and an open item would otherwise be kept for ever.
      await client.query(
        `with gone as (
           update events.inbox_items set state = 'withdrawn', closed_at = now(), updated_at = now()
           where state = 'open' and owner_kind = 'person' and owner_id = $1 returning id
         )
         insert into events.inbox_history (item_id, action) select id, 'withdrawn' from gone`,
        [person],
      );
      await client.query('commit');
      return { entries, notifications: rowCount ?? 0 };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async releasesDue() {
    const { rows } = await this.pool.query<{ person: string; team: string }>('select person, team from events.inbox_releases order by asked_at');
    return rows.map((r) => ({ person: r.person, ...(r.team ? { team: r.team } : {}) }));
  }

  async releaseDone({ person, team }: InboxRelease) {
    await this.pool.query('delete from events.inbox_releases where person = $1 and team = $2', [person, team ?? '']);
  }

  subscribe(listener: Listener) {
    this.emitter.on('notification', listener);
    return () => void this.emitter.off('notification', listener);
  }

  async teamNotices(workspace: string) {
    const { rowCount } = await this.pool.query('select 1 from events.team_notices where workspace_id = $1', [workspace]);
    return !!rowCount;
  }

  async setTeamNotices(workspace: string, on: boolean, by: string, floor?: EventFloor) {
    await this.transaction(async (client) => {
      const { rowCount } = await client.query(
        on ? 'insert into events.team_notices (workspace_id, set_by) values ($1, $2) on conflict do nothing' : 'delete from events.team_notices where workspace_id = $1',
        on ? [workspace, by] : [workspace],
      );
      if (rowCount) await insertAudit(client, { actor: { id: by, kind: 'user' }, app: 'events', action: on ? 'team-notices.on' : 'team-notices.off', target: workspace }, floor, 'events');
    });
  }

  async publish(publisher: string, events: NewDomainEvent[]) {
    return this.transaction((client) => insertEvents(client, publisher, events));
  }

  async lastSeq() {
    const { rows } = await this.pool.query<{ seq: string | null }>('select max(seq) as seq from events.domain_events');
    return rows[0]?.seq ?? undefined;
  }

  async readEvents({ topics, after, upTo, limit }: EventsQuery) {
    const every = topics.includes('*');
    const exact = topics.filter((t) => !t.endsWith('.*'));
    const families = topics.filter((t) => t.endsWith('.*')).map((t) => `${t.slice(0, -1)}%`);
    // Seq order is commit order (`insertEvents`), so a seq not visible yet can only ever land above these. Waiting
    // on the transactions still running isn't needed, and would let any login on the database stall every follower.
    const { rows } = await this.pool.query<DomainEventRow>(
      `select seq, topic, id, publisher, at, workspace_id, workspace_path, payload from events.domain_events
       where seq > $1 and ($5::bigint is null or seq <= $5) and ($6 or topic = any($2::text[]) or topic like any($3::text[]))
       order by seq limit $4`,
      [after ?? '0', exact, families, limit, upTo ?? null, every],
    );
    return rows.map(fromEventRow);
  }

  async pruneEvents(keepDays: number) {
    const { rowCount } = await this.pool.query(`delete from events.domain_events where at < now() - make_interval(days => $1)`, [keepDays]);
    return rowCount ?? 0;
  }

  async close() {
    this.closed = true;
    this.listening?.release();
    await this.pool.end();
  }
}
