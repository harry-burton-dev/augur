import pg from 'pg';
import type { AppEntry } from './manifest.ts';

/** Another app took the route first (two registrations racing). */
export class RouteTakenError extends Error {}

/** Where registered apps are kept. */
export interface AppStore {
  list(): Promise<AppEntry[]>;
  /** Adds or replaces an app; true when it was new. */
  put(entry: AppEntry, registeredBy: string): Promise<boolean>;
  /** Removes an app; false when there was none. */
  remove(id: string): Promise<boolean>;
}

/** For tests, and for running the registry locally without Postgres. Forgets everything on restart. */
export class MemoryAppStore implements AppStore {
  private apps = new Map<string, AppEntry>();

  async list() {
    return [...this.apps.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  async put(entry: AppEntry) {
    const created = !this.apps.has(entry.id);
    this.apps.set(entry.id, entry);
    return created;
  }

  async remove(id: string) {
    return this.apps.delete(id);
  }
}

/**
 * Schema changes, applied in order and recorded so each runs once. The registry
 * owns the `registry` schema; no other service reads or writes it.
 */
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_apps',
    sql: `
      create table registry.apps (
        id text primary key,
        route text not null unique,
        manifest jsonb not null,
        registered_by text not null,
        registered_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
  },
];

export class PgAppStore implements AppStore {
  constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string) {
    const store = new PgAppStore(new pg.Pool({ connectionString }));
    await store.migrate();
    return store;
  }

  /** Brings the schema up to date. Safe to run from several instances at once. */
  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('registry.migrate'))");
      await client.query('create schema if not exists registry');
      await client.query('create table if not exists registry.migrations (id text primary key, applied_at timestamptz not null default now())');
      const { rows } = await client.query<{ id: string }>('select id from registry.migrations');
      const applied = new Set(rows.map((r) => r.id));
      for (const m of migrations.filter((m) => !applied.has(m.id))) {
        await client.query(m.sql);
        await client.query('insert into registry.migrations (id) values ($1)', [m.id]);
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async list() {
    const { rows } = await this.pool.query<{ manifest: AppEntry }>('select manifest from registry.apps order by id');
    return rows.map((r) => r.manifest);
  }

  async put(entry: AppEntry, registeredBy: string) {
    const { rows } = await this.pool
      .query<{ created: boolean }>(
        `insert into registry.apps (id, route, manifest, registered_by) values ($1, $2, $3, $4)
         on conflict (id) do update set route = excluded.route, manifest = excluded.manifest,
           registered_by = excluded.registered_by, updated_at = now()
         returning (xmax = 0) as created`,
        [entry.id, entry.route, entry, registeredBy],
      )
      .catch((err: { code?: string }) => {
        throw err.code === '23505' ? new RouteTakenError(`Another app already lives at ${entry.route}.`) : err;
      });
    return rows[0].created;
  }

  async remove(id: string) {
    const { rowCount } = await this.pool.query('delete from registry.apps where id = $1', [id]);
    return rowCount === 1;
  }

  close() {
    return this.pool.end();
  }
}
