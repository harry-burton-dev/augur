// Identity's tests run on real Postgres (PER-271): the stores they use are the ones identity runs on, so a
// query that only an in-memory copy got right can't pass here. CI starts a Postgres for the test job; locally,
// point DATABASE_URL at a database of their own (README, "Working on it"): each file drops identity's schema.
import pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { buildApp, type IdentityOptions } from './app.ts';
import { PgLifecycleStore } from './lifecycle.ts';
import { PgOrganisationStore, type OrganisationStore } from './organisation.ts';
import { PgPreferenceStore } from './store.ts';
import { PgWorkspaceStore, type OrgSettings } from './workspaces.ts';

/** Where the tests' Postgres is. Without it, the tests that need one are skipped, saying so. */
export const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Identity's stores on a fresh `identity` schema for this file, emptied before each test. Call it at the top
 * of a `describe.runIf(DATABASE_URL)`; read the stores inside tests, after `beforeAll` has made them.
 */
export const identityDb = (settings: OrgSettings = {}) => {
  let pool: pg.Pool;
  const db = {} as {
    pool: pg.Pool;
    store: PgPreferenceStore;
    workspaces: PgWorkspaceStore;
    organisation: OrganisationStore;
    lifecycle: PgLifecycleStore;
    reset: () => Promise<void>;
    /** Identity's app on these stores; `opts` adds to them or replaces one. */
    app: (opts?: Partial<IdentityOptions>) => ReturnType<typeof buildApp>;
  };
  if (!DATABASE_URL) return db;

  const reset = async () => {
    const { rows } = await pool.query<{ name: string }>(`select tablename as name from pg_tables where schemaname = 'identity' and tablename <> 'migrations'`);
    if (rows.length) await pool.query(`truncate ${rows.map((r) => `identity.${r.name}`).join(', ')}`);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    await pool.query('drop schema if exists identity cascade');
    const store = new PgPreferenceStore(pool);
    await store.migrate();
    const stores = { store, workspaces: new PgWorkspaceStore(pool, settings), organisation: new PgOrganisationStore(pool), lifecycle: new PgLifecycleStore(pool) };
    Object.assign(db, { pool, ...stores, reset, app: (opts: Partial<IdentityOptions> = {}) => buildApp({ ...stores, ...opts }) });
  });
  beforeEach(reset);
  afterAll(() => pool?.end());
  return db;
};
