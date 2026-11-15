/**
 * Where each subscribing app has got to (contract 3, spec 8.6): one row per app with the last event
 * delivered to its part, how its delivery is going, and since when it has been failing. The events service
 * owns the table; the deliverer (deliver.ts) moves the rows. One instance at a time drives an app, under a
 * short lease the row holds, so a part sees each event once and in order even with several events instances.
 *
 * An event a part answers but can't take is held beside the line (`delivery_held`), so the app's cursor goes on to
 * other topics: it is tried again a few times, with the later events on its topic waiting behind it, and then set
 * aside, kept with why, for an admin to see (PER-462).
 */
import type pg from 'pg';
import type { Migration } from '@augur/service-kit';

export interface Delivery {
  app: string;
  /** The seq of the last event delivered (or passed over); events above it are still to go. */
  cursor: string;
  /** Attempts at the event above the cursor that failed in a row. */
  failures: number;
  /** When the next attempt may be made, after a failure; null when nothing holds it. */
  nextAt: string | null;
  /** What went wrong last time, in words. */
  lastError: string | null;
  /** When the current run of failures began; null while deliveries are getting through. */
  failingSince: string | null;
  /** When the part last took an event. */
  deliveredAt: string | null;
  /** Events passed over after a day of failures, and when the last was, before such events were set aside instead. */
  dropped: number;
  droppedAt: string | null;
  /** Events beside the line, being tried again or waiting behind one that is on their topic. */
  retrying: number;
  /** Events set aside, kept for an admin to see. */
  setAside: number;
}

/** An event held beside an app's line: being tried again, waiting behind one on its topic, or set aside. */
export interface HeldEvent {
  app: string;
  seq: string;
  /** The publisher's id for the event. */
  id: string;
  topic: string;
  /** Tries that failed; 0 for one that waits behind another on its topic. */
  attempts: number;
  /** When it may be tried again; null when it can go as soon as it is first on its topic. */
  nextAt: string | null;
  lastError: string | null;
  firstFailedAt: string | null;
  /** When it was set aside; null while it is still to be tried. */
  setAsideAt: string | null;
}

/** How an event goes beside the line: tried `attempts` times so far (0: waiting behind another), or set aside at once. */
export interface HoldHow {
  attempts: number;
  nextAt?: Date;
  lastError?: string;
  firstFailedAt?: Date;
  setAside?: boolean;
}

/** What moving the cursor past an event means for the row. */
export type Outcome = 'sent' | 'skipped';

export interface DeliveryStore {
  list(): Promise<Delivery[]>;
  /** The app's row, made at the latest event when it has none: a new subscriber starts from now, not from the beginning. */
  ensure(app: string): Promise<Delivery>;
  /** Takes the app's lease for `seconds` when nobody holds it; false when another instance is driving the app. */
  claim(app: string, seconds: number): Promise<boolean>;
  /** Extends a lease this instance holds by `seconds` from now, while it goes on driving the app. */
  renew(app: string, seconds: number): Promise<void>;
  /** Gives the lease back. */
  release(app: string): Promise<void>;
  /** Moves the cursor from `from` to `to` after an event was sent or skipped; false when another instance moved it first. */
  advance(app: string, from: string, to: string, outcome: Outcome): Promise<boolean>;
  /** Records a failed attempt at the event above `cursor`; nothing when the cursor has moved since. */
  failed(app: string, cursor: string, error: string, nextAt: Date, failingSince: Date): Promise<boolean>;
  /** Forgets the app's place and what it still had to try again; what was set aside is kept. */
  forget(app: string): Promise<void>;
  /**
   * Puts the event above `from` beside the app's line and moves the cursor to it, in one transaction; false, and
   * nothing done, when another instance moved the cursor first.
   */
  holdAndAdvance(app: string, from: string, event: { seq: string; id: string; topic: string }, how: HoldHow): Promise<boolean>;
  /** The topics on which the app has an event still to try again. */
  heldTopics(app: string): Promise<Set<string>>;
  /** The first event still to try on the app's topic, or on each of its topics without one. */
  heldFirst(app: string, topic?: string): Promise<HeldEvent[]>;
  /** A held event goes: delivered (the app's part is taking events), or no longer for the app. */
  unhold(app: string, seq: string, delivered: boolean): Promise<void>;
  /** A held event failed again at `at`: it waits until `nextAt`, or is set aside. */
  retried(app: string, seq: string, how: { attempts: number; lastError: string; at: Date; nextAt?: Date; setAside?: boolean }): Promise<void>;
  /** What was set aside, newest first; one app's with `app`. */
  setAside(query?: { app?: string; limit?: number }): Promise<HeldEvent[]>;
}

export const deliveriesMigration: Migration = {
  id: '015_deliveries',
  sql: `
    create table if not exists events.deliveries (
      app text primary key,
      cursor bigint not null default 0,
      failures integer not null default 0,
      next_at timestamptz,
      last_error text,
      failing_since timestamptz,
      delivered_at timestamptz,
      dropped integer not null default 0,
      dropped_at timestamptz,
      lease_until timestamptz,
      updated_at timestamptz not null default now()
    );
  `,
};

export const heldMigration: Migration = {
  id: '018_delivery_held',
  sql: `
    -- Events a part answered but couldn't take, held beside its app's line so other topics go on: tried again a few
    -- times, with later events on the same topic waiting behind, then set aside and kept for an admin (PER-462).
    create table events.delivery_held (
      app text not null,
      seq bigint not null,
      event_id text not null,
      topic text not null,
      attempts integer not null default 0,
      next_at timestamptz,
      last_error text,
      first_failed_at timestamptz,
      set_aside_at timestamptz,
      held_at timestamptz not null default now(),
      primary key (app, seq)
    );
    create index delivery_held_waiting on events.delivery_held (app, topic, seq) where set_aside_at is null;
  `,
};

interface Row {
  app: string;
  cursor: string;
  failures: number;
  next_at: Date | null;
  last_error: string | null;
  failing_since: Date | null;
  delivered_at: Date | null;
  dropped: number;
  dropped_at: Date | null;
  retrying: number;
  set_aside: number;
}

const COLUMNS = `d.app, d.cursor::text as cursor, d.failures, d.next_at, d.last_error, d.failing_since, d.delivered_at, d.dropped, d.dropped_at,
  (select count(*)::int from events.delivery_held h where h.app = d.app and h.set_aside_at is null) as retrying,
  (select count(*)::int from events.delivery_held h where h.app = d.app and h.set_aside_at is not null) as set_aside`;

interface HeldRow {
  app: string;
  seq: string;
  event_id: string;
  topic: string;
  attempts: number;
  next_at: Date | null;
  last_error: string | null;
  first_failed_at: Date | null;
  set_aside_at: Date | null;
}

const HELD_COLUMNS = 'app, seq::text as seq, event_id, topic, attempts, next_at, last_error, first_failed_at, set_aside_at';

const fromHeld = (r: HeldRow): HeldEvent => ({
  app: r.app,
  seq: r.seq,
  id: r.event_id,
  topic: r.topic,
  attempts: r.attempts,
  nextAt: r.next_at?.toISOString() ?? null,
  lastError: r.last_error,
  firstFailedAt: r.first_failed_at?.toISOString() ?? null,
  setAsideAt: r.set_aside_at?.toISOString() ?? null,
});

const fromRow = (r: Row): Delivery => ({
  app: r.app,
  cursor: r.cursor,
  failures: r.failures,
  nextAt: r.next_at?.toISOString() ?? null,
  lastError: r.last_error,
  failingSince: r.failing_since?.toISOString() ?? null,
  deliveredAt: r.delivered_at?.toISOString() ?? null,
  dropped: r.dropped,
  droppedAt: r.dropped_at?.toISOString() ?? null,
  retrying: r.retrying,
  setAside: r.set_aside,
});

export class PgDeliveryStore implements DeliveryStore {
  constructor(private readonly pool: pg.Pool) {}

  async list() {
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS} from events.deliveries d order by d.app`);
    return rows.map(fromRow);
  }

  async ensure(app: string) {
    // The latest seq is read only when the row is new, so an existing row costs one select.
    await this.pool.query(
      `insert into events.deliveries (app, cursor) values ($1, coalesce((select max(seq) from events.domain_events), (select up_to from events.domain_events_pruned), 0)) on conflict (app) do nothing`,
      [app],
    );
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS} from events.deliveries d where d.app = $1`, [app]);
    return fromRow(rows[0]!);
  }

  async claim(app: string, seconds: number) {
    const { rowCount } = await this.pool.query(
      `update events.deliveries set lease_until = now() + make_interval(secs => $2) where app = $1 and (lease_until is null or lease_until < now())`,
      [app, seconds],
    );
    return (rowCount ?? 0) > 0;
  }

  async renew(app: string, seconds: number) {
    await this.pool.query(`update events.deliveries set lease_until = now() + make_interval(secs => $2) where app = $1 and lease_until is not null`, [app, seconds]);
  }

  async release(app: string) {
    await this.pool.query('update events.deliveries set lease_until = null where app = $1', [app]);
  }

  async advance(app: string, from: string, to: string, outcome: Outcome) {
    const { rowCount } = await this.pool.query(
      `update events.deliveries set cursor = $3, failures = 0, next_at = null, last_error = null, failing_since = null, updated_at = now(),
         delivered_at = case when $4 = 'sent' then now() else delivered_at end
       where app = $1 and cursor = $2`,
      [app, from, to, outcome],
    );
    return (rowCount ?? 0) > 0;
  }

  async failed(app: string, cursor: string, error: string, nextAt: Date, failingSince: Date) {
    const { rowCount } = await this.pool.query(
      `update events.deliveries set failures = failures + 1, next_at = $4, last_error = $3, failing_since = coalesce(failing_since, $5), updated_at = now()
       where app = $1 and cursor = $2`,
      [app, cursor, error.slice(0, 1000), nextAt, failingSince],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Runs `fn` in one transaction on one connection. */
  private async inTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async forget(app: string) {
    // The place and what was still to be tried go together, so a later grant can't be sent events from before.
    await this.inTransaction(async (client) => {
      await client.query('delete from events.deliveries where app = $1', [app]);
      await client.query('delete from events.delivery_held where app = $1 and set_aside_at is null', [app]);
    });
  }

  async holdAndAdvance(app: string, from: string, event: { seq: string; id: string; topic: string }, how: HoldHow) {
    return this.inTransaction(async (client) => {
      const { rowCount } = await client.query(
        `update events.deliveries set cursor = $3, failures = 0, next_at = null, last_error = null, failing_since = null, updated_at = now() where app = $1 and cursor = $2`,
        [app, from, event.seq],
      );
      if (!rowCount) return false;
      await client.query(
        `insert into events.delivery_held (app, seq, event_id, topic, attempts, next_at, last_error, first_failed_at, set_aside_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, case when $9::boolean then now() end) on conflict (app, seq) do nothing`,
        [app, event.seq, event.id, event.topic, how.attempts, how.nextAt ?? null, how.lastError?.slice(0, 1000) ?? null, how.firstFailedAt ?? null, how.setAside ?? false],
      );
      return true;
    });
  }

  async heldTopics(app: string) {
    const { rows } = await this.pool.query<{ topic: string }>('select distinct topic from events.delivery_held where app = $1 and set_aside_at is null', [app]);
    return new Set(rows.map((r) => r.topic));
  }

  async heldFirst(app: string, topic?: string) {
    const { rows } = await this.pool.query<HeldRow>(
      `select distinct on (topic) ${HELD_COLUMNS} from events.delivery_held
       where app = $1 and set_aside_at is null and ($2::text is null or topic = $2) order by topic, seq`,
      [app, topic ?? null],
    );
    return rows.map(fromHeld);
  }

  async unhold(app: string, seq: string, delivered: boolean) {
    await this.pool.query('delete from events.delivery_held where app = $1 and seq = $2', [app, seq]);
    if (!delivered) return;
    await this.pool.query(
      `update events.deliveries set failures = 0, next_at = null, last_error = null, failing_since = null, delivered_at = now(), updated_at = now() where app = $1`,
      [app],
    );
  }

  async retried(app: string, seq: string, how: { attempts: number; lastError: string; at: Date; nextAt?: Date; setAside?: boolean }) {
    await this.pool.query(
      `update events.delivery_held set attempts = $3, last_error = $4, next_at = $5, first_failed_at = coalesce(first_failed_at, $7),
         set_aside_at = case when $6::boolean then now() end
       where app = $1 and seq = $2`,
      [app, seq, how.attempts, how.lastError.slice(0, 1000), how.nextAt ?? null, how.setAside ?? false, how.at],
    );
  }

  async setAside({ app, limit = 100 }: { app?: string; limit?: number } = {}) {
    const { rows } = await this.pool.query<HeldRow>(
      `select ${HELD_COLUMNS} from events.delivery_held where set_aside_at is not null and ($1::text is null or app = $1)
       order by set_aside_at desc, seq desc limit $2`,
      [app ?? null, limit],
    );
    return rows.map(fromHeld);
  }
}
