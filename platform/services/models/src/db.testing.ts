// The model gateway's tests run on real Postgres (PER-271): the store they use is the one it runs on, so a
// query that only an in-memory copy got right can't pass here. CI starts a Postgres for the test job; locally,
// point DATABASE_URL at a database of their own (README, "Working on it"): each file drops the models schema.
import pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { PgModelStore } from './store.ts';

/** Where the tests' Postgres is. Without it, the tests that need one are skipped, saying so. */
export const DATABASE_URL = process.env.DATABASE_URL;

/** The models store on a fresh `models` schema for this file, emptied before each test. Read `db.store` inside tests. */
export const modelsDb = () => {
  const db = {} as { pool: pg.Pool; store: PgModelStore };
  if (!DATABASE_URL) return db;

  beforeAll(async () => {
    db.pool = new pg.Pool({ connectionString: DATABASE_URL });
    await db.pool.query('drop schema if exists models cascade');
    db.store = await PgModelStore.connect(DATABASE_URL);
  });
  beforeEach(async () => {
    const { rows } = await db.pool.query<{ name: string }>(`select tablename as name from pg_tables where schemaname = 'models' and tablename <> 'migrations'`);
    if (rows.length) await db.pool.query(`truncate ${rows.map((r) => `models.${r.name}`).join(', ')}`);
  });
  afterAll(async () => {
    await db.store?.close();
    await db.pool?.end();
  });
  return db;
};
