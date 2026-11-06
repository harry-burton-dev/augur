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
    sent_at timestamptz,
    refused_at timestamptz,
    refused_why text
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
 * Whether the events service turned events down for what they are, so sending them again won't help:
 * 400 for a topic, floor or payload it won't take, 413 for a batch too big to read. A 403 is about the
 * publisher (a scope not granted yet), so it doesn't count: every row would go.
 */
const refusedEvents = (err: unknown) => err instanceof ServiceCallError && /it answered (400|413)\b/.test(err.message);

/**
 * Sends what's waiting in the outbox to the events service, oldest first, and marks it
 * sent. Several instances can run at once: each takes rows the others haven't locked.
 * Until the events service takes them, rows stay and are tried again. A batch it refuses goes
 * again one row at a time, so one bad row doesn't hold up the rest: a row refused alone is set
 * aside, left in the table marked sent, with `refused_at` and `refused_why` so it can be told from one
 * delivered, and goes to `onError` (else the console). To send one again, clear `sent_at` and `refused_at`.
 * What fails in the relay itself goes the same way.
 */
export const outboxRelay = ({ pool, eventsUrl, credentials, fetchImpl, batch = 100, intervalMs = 1000, onError }: EventsAddress & {
  pool: ConnectionPool;
  batch?: number;
  intervalMs?: number;
  onError?: (err: unknown) => void;
}) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Sends one batch; returns how many rows it dealt with, sent or set aside. */
  const flush = async (): Promise<number> => {
    const client = await pool.connect();
    const setAside: { id: unknown; err: ServiceCallError }[] = [];
    try {
      await client.query('begin');
      const { rows } = await client.query(
        'select id, event_id, topic, workspace_id, payload from outbox where sent_at is null order by id limit $1 for update skip locked',
        [batch],
      );
      if (rows.length) {
        const events: (NewDomainEvent & { row: unknown })[] = rows.map((r) => ({ row: r.id, topic: r.topic, id: r.event_id, payload: r.payload, ...(r.workspace_id ? { workspace: r.workspace_id } : {}) }));
        const bare = (list: typeof events) => list.map(({ row: _, ...event }) => event);
        await publishEvents({ eventsUrl, credentials, fetchImpl, events: bare(events) }).catch(async (err) => {
          if (!refusedEvents(err)) throw err;
          for (const event of events) {
            await publishEvents({ eventsUrl, credentials, fetchImpl, events: bare([event]) }).catch((one) => {
              if (!refusedEvents(one)) throw one;
              setAside.push({ id: event.row, err: new ServiceCallError(`Set aside outbox event ${event.id} (${event.topic}): ${(one as Error).message}`) });
            });
          }
        });
        if (setAside.length) {
          // An outbox made before these columns has them added here, the first time a row needs them.
          await client.query('alter table outbox add column if not exists refused_at timestamptz, add column if not exists refused_why text');
          for (const { id, err } of setAside) await client.query('update outbox set refused_at = now(), refused_why = $2 where id = $1', [id, err.message]);
        }
        await client.query('update outbox set sent_at = now() where id = any($1::bigint[])', [rows.map((r) => r.id)]);
      }
      await client.query('commit');
      for (const { err } of setAside) (onError ?? console.error)(err);
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
      (onError ?? console.error)(err);
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

/** Where a follower keeps its place, for an app's own migrations. One row per follower. */
export const EVENT_CURSOR_TABLE_SQL = `
  create table if not exists event_followers (
    follower text primary key,
    seq text not null
  );`;

/** A cursor for `followEvents` in the table `EVENT_CURSOR_TABLE_SQL` makes. `follower` tells apart several in one service. */
export const eventCursor = (db: Queryable, follower = 'default') => ({
  load: async (): Promise<string | undefined> => (await db.query('select seq from event_followers where follower = $1', [follower])).rows[0]?.seq,
  save: async (seq: string): Promise<void> => {
    await db.query('insert into event_followers (follower, seq) values ($1, $2) on conflict (follower) do update set seq = excluded.seq', [follower, seq]);
  },
});

/** The payload of `platform.person.left`. Hand on what they own to `handOverTo`; without one, keep it for an admin or a lead to hand on. */
export interface PersonLeft {
  person: string;
  handOverTo?: string;
}

/** The payload of `platform.person.deleted`: remove their names and personal details, keeping only this id. It's the last event about them. */
export interface PersonDeleted {
  person: string;
}

/** A `platform.person.left` event's payload, or undefined for any other event. */
export const readPersonLeft = (event: Pick<DomainEvent, 'topic' | 'payload'>): PersonLeft | undefined => {
  if (event.topic !== PLATFORM_TOPICS.personLeft) return undefined;
  const { person, handOverTo } = (event.payload ?? {}) as { person?: unknown; handOverTo?: unknown };
  return typeof person === 'string' ? { person, ...(typeof handOverTo === 'string' ? { handOverTo } : {}) } : undefined;
};

/** A `platform.person.deleted` event's payload, or undefined for any other event. */
export const readPersonDeleted = (event: Pick<DomainEvent, 'topic' | 'payload'>): PersonDeleted | undefined => {
  if (event.topic !== PLATFORM_TOPICS.personDeleted) return undefined;
  const { person } = (event.payload ?? {}) as { person?: unknown };
  return typeof person === 'string' ? { person } : undefined;
};

/**
 * Follows people leaving and being deleted, as `followEvents` does: each handler may run twice for one event, so
 * doing it twice must do no harm. Give `left` to hand on what a leaver owns, `deleted` to forget them. Needs the
 * `events:subscribe` scope.
 */
export const followLeavers = ({ left, deleted, ...follow }: Omit<Parameters<typeof followEvents>[0], 'topics' | 'handle'> & {
  left?: (leaver: PersonLeft, event: DomainEvent) => Promise<void>;
  deleted?: (person: PersonDeleted, event: DomainEvent) => Promise<void>;
}) =>
  followEvents({
    ...follow,
    topics: [...(left ? [PLATFORM_TOPICS.personLeft] : []), ...(deleted ? [PLATFORM_TOPICS.personDeleted] : [])],
    handle: async (event) => {
      const leaver = readPersonLeft(event);
      if (leaver) await left?.(leaver, event);
      const gone = readPersonDeleted(event);
      if (gone) await deleted?.(gone, event);
    },
  });

/**
 * The platform's own topics, which any follower may read. The events service publishes
 * them as identity and the registry record the change, with the audit entry's floor.
 * Payloads: `{ person }`, `{ person, changed }` (some of `name`, `email`, `roles`, `teams`), `{ person, handOverTo? }`
 * (a leaver, and who takes on what they own), `{ person }` for a deleted account (forget what you keep about
 * them; their id may stay, as it does in Activity), `{ team, name? }`,
 * `{ team, person }`, `{ app }`.
 */
export const PLATFORM_TOPICS = {
  personJoined: 'platform.person.joined',
  personChanged: 'platform.person.changed',
  personDisabled: 'platform.person.disabled',
  personEnabled: 'platform.person.enabled',
  personLeft: 'platform.person.left',
  personDeleted: 'platform.person.deleted',
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
