import pg from 'pg';
import type { AppEntry } from './manifest.ts';

/** Another app took the route first (two registrations racing). */
export class RouteTakenError extends Error {}

/** A registered app with what the catalogue knows about it beyond its manifest. */
export interface AppRecord {
  entry: AppEntry;
  /** False when an admin has turned it off: it stays registered but nobody is offered it. */
  enabled: boolean;
  registeredBy: string;
  registeredAt: string;
  updatedAt: string;
}

/** Where registered apps are kept. */
export interface AppStore {
  list(): Promise<AppEntry[]>;
  /** Every registered app with its state, by id. */
  records(): Promise<AppRecord[]>;
  /** Turns an app on or off. Re-registering doesn't change it. False when there is no such app. */
  setEnabled(id: string, enabled: boolean): Promise<boolean>;
  /** Adds or replaces an app; true when it was new. */
  put(entry: AppEntry, registeredBy: string): Promise<boolean>;
  /** Removes an app; false when there was none. */
  remove(id: string): Promise<boolean>;
}

/** For tests, and for running the registry locally without Postgres. Forgets everything on restart. */
export class MemoryAppStore implements AppStore {
  private apps = new Map<string, AppRecord>();

  async list() {
    return (await this.records()).map((r) => r.entry);
  }

  async records() {
    return [...this.apps.values()].sort((a, b) => a.entry.id.localeCompare(b.entry.id)).map((r) => structuredClone(r));
  }

  async put(entry: AppEntry, registeredBy: string) {
    const now = new Date().toISOString();
    const before = this.apps.get(entry.id);
    this.apps.set(entry.id, { entry, enabled: before?.enabled ?? true, registeredBy, registeredAt: before?.registeredAt ?? now, updatedAt: now });
    return !before;
  }

  async setEnabled(id: string, enabled: boolean) {
    const record = this.apps.get(id);
    if (record) record.enabled = enabled;
    return Boolean(record);
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
  {
    id: '002_enabled',
    sql: 'alter table registry.apps add column enabled boolean not null default true;',
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

  async records() {
    const { rows } = await this.pool.query<{ manifest: AppEntry; enabled: boolean; registered_by: string; registered_at: Date; updated_at: Date }>(
      'select manifest, enabled, registered_by, registered_at, updated_at from registry.apps order by id',
    );
    return rows.map((r) => ({
      entry: r.manifest,
      enabled: r.enabled,
      registeredBy: r.registered_by,
      registeredAt: r.registered_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async setEnabled(id: string, enabled: boolean) {
    const { rowCount } = await this.pool.query('update registry.apps set enabled = $2 where id = $1', [id, enabled]);
    return rowCount === 1;
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
