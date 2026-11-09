/**
 * Where each subscribing app has got to (contract 3, spec 8.6): one row per app with the last event
 * delivered to its part, how its delivery is going, and since when it has been failing. The events service
 * owns the table; the deliverer (deliver.ts) moves the rows. One instance at a time drives an app, under a
 * short lease the row holds, so a part sees each event once and in order even with several events instances.
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
  /** Events passed over after a day of failures, and when the last was. */
  dropped: number;
  droppedAt: string | null;
}

/** What moving the cursor past an event means for the row. */
export type Outcome = 'sent' | 'skipped' | 'dropped';

export interface DeliveryStore {
  list(): Promise<Delivery[]>;
  /** The app's row, made at the latest event when it has none: a new subscriber starts from now, not from the beginning. */
  ensure(app: string): Promise<Delivery>;
  /** Takes the app's lease for `seconds` when nobody holds it; false when another instance is driving the app. */
  claim(app: string, seconds: number): Promise<boolean>;
  /** Gives the lease back. */
  release(app: string): Promise<void>;
  /** Moves the cursor from `from` to `to` after an event was sent, skipped or dropped; false when another instance moved it first. */
  advance(app: string, from: string, to: string, outcome: Outcome): Promise<boolean>;
  /** Records a failed attempt at the event above `cursor`; nothing when the cursor has moved since. */
  failed(app: string, cursor: string, error: string, nextAt: Date, failingSince: Date): Promise<boolean>;
  forget(app: string): Promise<void>;
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
}

const COLUMNS = 'app, cursor::text as cursor, failures, next_at, last_error, failing_since, delivered_at, dropped, dropped_at';

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
});

export class PgDeliveryStore implements DeliveryStore {
  constructor(private readonly pool: pg.Pool) {}

  async list() {
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS} from events.deliveries order by app`);
    return rows.map(fromRow);
  }

  async ensure(app: string) {
    // The latest seq is read only when the row is new, so an existing row costs one select.
    await this.pool.query(
      `insert into events.deliveries (app, cursor) values ($1, coalesce((select max(seq) from events.domain_events), 0)) on conflict (app) do nothing`,
      [app],
    );
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS} from events.deliveries where app = $1`, [app]);
    return fromRow(rows[0]!);
  }

  async claim(app: string, seconds: number) {
    const { rowCount } = await this.pool.query(
      `update events.deliveries set lease_until = now() + make_interval(secs => $2) where app = $1 and (lease_until is null or lease_until < now())`,
      [app, seconds],
    );
    return (rowCount ?? 0) > 0;
  }

  async release(app: string) {
    await this.pool.query('update events.deliveries set lease_until = null where app = $1', [app]);
  }

  async advance(app: string, from: string, to: string, outcome: Outcome) {
    const { rowCount } = await this.pool.query(
      `update events.deliveries set cursor = $3, failures = 0, next_at = null, last_error = null, failing_since = null, updated_at = now(),
         delivered_at = case when $4 = 'sent' then now() else delivered_at end,
         dropped = dropped + case when $4 = 'dropped' then 1 else 0 end,
         dropped_at = case when $4 = 'dropped' then now() else dropped_at end
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

  async forget(app: string) {
    await this.pool.query('delete from events.deliveries where app = $1', [app]);
  }
}
