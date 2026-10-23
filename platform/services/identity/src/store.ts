import pg from 'pg';
import { workspaceMigrations } from './workspaces.ts';

/** What someone has chosen for the shell. Every field is optional: what's missing takes the shell's default. */
export interface Preferences {
  reduceMotion?: boolean;
  density?: 'comfortable' | 'compact';
  away?: boolean;
  /** App ids, most recent first. */
  recent?: string[];
  /** App ids whose notifications land in the stream silently and never on Home. */
  muted?: string[];
}

/** Where each person's preferences are kept. */
export interface PreferenceStore {
  /** A person's preferences; empty when they have chosen nothing. */
  get(person: string): Promise<Preferences>;
  /** Replaces a person's preferences. */
  put(person: string, prefs: Preferences): Promise<void>;
}

/** For tests, and for running identity locally without Postgres. Forgets everything on restart. */
export class MemoryPreferenceStore implements PreferenceStore {
  private prefs = new Map<string, Preferences>();

  async get(person: string) {
    return structuredClone(this.prefs.get(person) ?? {});
  }

  async put(person: string, prefs: Preferences) {
    this.prefs.set(person, structuredClone(prefs));
  }
}

/**
 * Schema changes, applied in order and recorded so each runs once. Identity
 * owns the `identity` schema; no other service reads or writes it.
 */
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_preferences',
    sql: `
      create table identity.preferences (
        person text primary key,
        prefs jsonb not null,
        updated_at timestamptz not null default now()
      );`,
  },
  ...workspaceMigrations,
];

export class PgPreferenceStore implements PreferenceStore {
  constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string) {
    const store = new PgPreferenceStore(new pg.Pool({ connectionString }));
    await store.migrate();
    return store;
  }

  /** Brings the schema up to date. Safe to run from several instances at once. */
  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('identity.migrate'))");
      await client.query('create schema if not exists identity');
      await client.query('create table if not exists identity.migrations (id text primary key, applied_at timestamptz not null default now())');
      const { rows } = await client.query<{ id: string }>('select id from identity.migrations');
      const applied = new Set(rows.map((r) => r.id));
      for (const m of migrations.filter((m) => !applied.has(m.id))) {
        await client.query(m.sql);
        await client.query('insert into identity.migrations (id) values ($1)', [m.id]);
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async get(person: string) {
    const { rows } = await this.pool.query<{ prefs: Preferences }>('select prefs from identity.preferences where person = $1', [person]);
    return rows[0]?.prefs ?? {};
  }

  async put(person: string, prefs: Preferences) {
    await this.pool.query(
      `insert into identity.preferences (person, prefs) values ($1, $2)
       on conflict (person) do update set prefs = excluded.prefs, updated_at = now()`,
      [person, prefs],
    );
  }

  close() {
    return this.pool.end();
  }
}
