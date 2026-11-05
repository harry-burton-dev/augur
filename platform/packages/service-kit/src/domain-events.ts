import { callService, serviceHeaders, ServiceCallError, type ServiceCredentials } from './service.js';
import { withDeadline } from './deadline.js';

/**
 * Domain events: what one service tells others has happened ("folio.document.published"),
 * through the events service. A publisher sends ids and a little context, never content
 * a follower might not be allowed to see; a follower that needs more asks the publisher's
 * API, as the person or as itself. See docs/domain-events.md.
 */
export interface NewDomainEvent {
  /** The publisher's id, then what happened, dotted: "folio.document.published". */
  topic: string;
  /** The publisher's own id for this event; sending it again keeps one copy. */
  id: string;
  payload: unknown;
  /** The floor it happened on, if any. */
  workspace?: string;
}

/** One event as followers read it. */
export interface DomainEvent {
  /** Its place in the order every follower reads in; keep the last one handled as your cursor. */
  seq: string;
  topic: string;
  id: string;
  publisher: string;
  at: string;
  workspace?: { id: string; path: string[] };
  payload: unknown;
}

interface EventsAddress {
  /** The events service's internal address, e.g. http://events:8084. */
  eventsUrl: string;
  credentials: ServiceCredentials;
  fetchImpl?: typeof fetch;
}

/** Publishes events straight away. Needs the `events:publish` scope. Prefer the outbox when the event goes with a database change. */
export async function publishEvents({ eventsUrl, credentials, fetchImpl, events }: EventsAddress & { events: NewDomainEvent[] }): Promise<void> {
  await callService({
    method: 'POST',
    url: `${eventsUrl.replace(/\/$/, '')}/v1/domain-events`,
    credentials,
    body: { events },
    what: `publish ${events.length} event${events.length === 1 ? '' : 's'}`,
    attempts: 3,
    fetchImpl,
  });
}

/** What the outbox needs from a database connection; `pg`'s clients and pools fit. */
export interface Queryable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches pg's own Pool.query, so any pool fits
  query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}
export interface ConnectionPool {
  connect(): Promise<Queryable & { release(): void }>;
}

/**
 * The outbox table, for an app's own migrations. An event written to it in the same
 * transaction as the change it describes is sent if and only if the change commits.
 */
export const OUTBOX_TABLE_SQL = `
  create table if not exists outbox (
    id bigint generated always as identity primary key,
    event_id text not null unique default gen_random_uuid()::text,
    topic text not null,
    workspace_id text,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    sent_at timestamptz
  );
  create index if not exists outbox_unsent on outbox (id) where sent_at is null;`;

/** Adds an event to the outbox. Call it inside the transaction that makes the change. */
export async function addToOutbox(db: Queryable, event: Omit<NewDomainEvent, 'id'> & { id?: string }): Promise<void> {
  await db.query(
    event.id
      ? 'insert into outbox (topic, workspace_id, payload, event_id) values ($1, $2, $3, $4)'
      : 'insert into outbox (topic, workspace_id, payload) values ($1, $2, $3)',
    [event.topic, event.workspace ?? null, JSON.stringify(event.payload ?? null), ...(event.id ? [event.id] : [])],
  );
}

/**
 * Sends what's waiting in the outbox to the events service, oldest first, and marks it
 * sent. Several instances can run at once: each takes rows the others haven't locked.
 * Until the events service takes them, rows stay and are tried again.
 */
export const outboxRelay = ({ pool, eventsUrl, credentials, fetchImpl, batch = 100, intervalMs = 1000, onError }: EventsAddress & {
  pool: ConnectionPool;
  batch?: number;
  intervalMs?: number;
  onError?: (err: unknown) => void;
}) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Sends one batch; returns how many went. */
  const flush = async (): Promise<number> => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        'select id, event_id, topic, workspace_id, payload from outbox where sent_at is null order by id limit $1 for update skip locked',
        [batch],
      );
      if (rows.length) {
        await publishEvents({
          eventsUrl,
          credentials,
          fetchImpl,
          events: rows.map((r) => ({ topic: r.topic, id: r.event_id, payload: r.payload, ...(r.workspace_id ? { workspace: r.workspace_id } : {}) })),
        });
        await client.query('update outbox set sent_at = now() where id = any($1::bigint[])', [rows.map((r) => r.id)]);
      }
      await client.query('commit');
      return rows.length;
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };
  const tick = async () => {
    try {
      // A full batch means there may be more: go again at once.
      while ((await flush()) === batch);
    } catch (err) {
      onError?.(err);
    }
    if (timer !== undefined) timer = setTimeout(tick, intervalMs);
  };
  return {
    flush,
    start() {
      if (timer === undefined) timer = setTimeout(tick, 0);
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
};

/**
 * Follows topics: reads new events in order and hands each to `handle`, saving the cursor
 * after each one. If `handle` throws, the same event comes again next time, so handle each
 * one so that doing it twice does no harm. Needs the `events:subscribe` scope.
 */
export const followEvents = ({ eventsUrl, credentials, fetchImpl = fetch, topics, cursor, handle, batch = 100, intervalMs = 2000, onError }: EventsAddress & {
  /** Topic names, or families such as "platform.team.*". */
  topics: string[];
  cursor: { load(): Promise<string | undefined>; save(seq: string): Promise<void> };
  handle(event: DomainEvent): Promise<void>;
  batch?: number;
  intervalMs?: number;
  onError?: (err: unknown) => void;
}) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Reads and handles one batch; returns how many were handled. */
  const poll = async (): Promise<number> => {
    const after = await cursor.load();
    const query = new URLSearchParams({ topics: topics.join(','), limit: String(batch), ...(after ? { after } : {}) });
    const res = await withDeadline(fetchImpl)(`${eventsUrl.replace(/\/$/, '')}/v1/domain-events?${query}`, { headers: await serviceHeaders(credentials) });
    const reply = (await res.json().catch(() => ({}))) as { events?: DomainEvent[]; message?: string };
    if (!res.ok) throw new ServiceCallError(`Couldn't read events (${topics.join(', ')}): it answered ${res.status}${reply.message ? `: ${reply.message}` : ''}.`);
    for (const event of reply.events ?? []) {
      await handle(event);
      await cursor.save(event.seq);
    }
    return reply.events?.length ?? 0;
  };
  const tick = async () => {
    try {
      while ((await poll()) === batch);
    } catch (err) {
      onError?.(err);
    }
    if (timer !== undefined) timer = setTimeout(tick, intervalMs);
  };
  return {
    poll,
    start() {
      if (timer === undefined) timer = setTimeout(tick, 0);
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
};

/**
 * The platform's own topics, which any follower may read. The events service publishes
 * them as identity and the registry record the change, with the audit entry's floor.
 * Payloads: `{ person }`, `{ person, changed }` (some of `name`, `email`, `roles`, `teams`), `{ person, handOverTo? }`
 * (a leaver, and who takes on what they own), `{ team, name? }`,
 * `{ team, person }`, `{ app }`.
 */
export const PLATFORM_TOPICS = {
  personJoined: 'platform.person.joined',
  personChanged: 'platform.person.changed',
  personDisabled: 'platform.person.disabled',
  personEnabled: 'platform.person.enabled',
  personLeft: 'platform.person.left',
  teamCreated: 'platform.team.created',
  teamRenamed: 'platform.team.renamed',
  memberAdded: 'platform.team.member-added',
  memberRemoved: 'platform.team.member-removed',
  appTurnedOff: 'platform.app.turned-off',
  appTurnedOn: 'platform.app.turned-on',
  appRemoved: 'platform.app.removed',
  appBlocked: 'platform.app.blocked',
  appRuleCleared: 'platform.app.rule-cleared',
} as const;
