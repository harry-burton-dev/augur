// The registry's tests run on real Postgres (PER-271): the store they use is the one it runs on, so a query
// that only an in-memory copy got right can't pass here. CI starts a Postgres for the test job; locally, point
// DATABASE_URL at a database of their own (README, "Working on it"): each file drops the registry schema.
import pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { buildApp, type RegistryOptions } from './app.ts';
import { PgAppStore } from './store.ts';

/** Where the tests' Postgres is. Without it, the tests that need one are skipped, saying so. */
export const DATABASE_URL = process.env.DATABASE_URL;

/**
 * The registry's store on a fresh `registry` schema for this file, emptied before each test. Call it at the
 * top of a test file; read `db.store` inside tests, after `beforeAll` has made it.
 */
export const registryDb = () => {
  const db = {} as {
    pool: pg.Pool;
    store: PgAppStore;
    /** Empties the store, for a test that needs a fresh registry part way through. */
    reset: () => Promise<void>;
    /** The registry on this store; `opts` adds to it. */
    app: (opts?: Partial<RegistryOptions>) => ReturnType<typeof buildApp>;
  };
  if (!DATABASE_URL) return db;

  const reset = async () => {
    const { rows } = await db.pool.query<{ name: string }>(`select tablename as name from pg_tables where schemaname = 'registry' and tablename <> 'migrations'`);
    if (rows.length) await db.pool.query(`truncate ${rows.map((r) => `registry.${r.name}`).join(', ')}`);
  };

  beforeAll(async () => {
    const pool = new pg.Pool({ connectionString: DATABASE_URL });
    await pool.query('drop schema if exists registry cascade');
    const store = await PgAppStore.connect(DATABASE_URL);
    Object.assign(db, { pool, store, reset, app: (opts: Partial<RegistryOptions> = {}) => buildApp({ store, ...opts }) });
  });
  beforeEach(reset);
  afterAll(async () => {
    await db.store?.close();
    await db.pool?.end();
  });
  return db;
};
