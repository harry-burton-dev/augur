// The events service's tests run on real Postgres (PER-271): the store they use is the one it runs on, so a
// query that only an in-memory copy got right can't pass here. CI starts a Postgres for the test job; locally,
// point DATABASE_URL at a database of their own (README, "Working on it"): each file drops the events schema.
import pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { buildApp, type EventsOptions } from './app.ts';
import { PgEventStore } from './store.ts';

/** Where the tests' Postgres is. Without it, the tests that need one are skipped, saying so. */
export const DATABASE_URL = process.env.DATABASE_URL;

/**
 * The events store on a fresh `events` schema for this file, emptied before each test. Call it at the top of
 * a test file; read `db.store` inside tests, after `beforeAll` has made it.
 */
export const eventsDb = () => {
  const db = {} as {
    pool: pg.Pool;
    store: PgEventStore;
    /** The events service on this store; `opts` adds to it. */
    app: (opts?: Partial<EventsOptions>) => ReturnType<typeof buildApp>;
  };
  if (!DATABASE_URL) return db;

  beforeAll(async () => {
    const pool = new pg.Pool({ connectionString: DATABASE_URL });
    await pool.query('drop schema if exists events cascade');
    const store = await PgEventStore.connect(DATABASE_URL);
    Object.assign(db, { pool, store, app: (opts: Partial<EventsOptions> = {}) => buildApp({ store, ...opts }) });
  });
  beforeEach(async () => {
    const { rows } = await db.pool.query<{ name: string }>(`select tablename as name from pg_tables where schemaname = 'events' and tablename <> 'migrations'`);
    if (rows.length) await db.pool.query(`truncate ${rows.map((r) => `events.${r.name}`).join(', ')}`);
  });
  afterAll(async () => {
    await db.store?.close();
    await db.pool?.end();
  });
  return db;
};
