import pg from 'pg';
import { steadyPool } from '@augur/service-kit';

/** What admins set in Admin: whether models can be used at all, and how many calls each app gets a day. */
export interface ModelSettings {
  enabled: boolean;
  /** Calls per app per day (UTC). */
  dailyLimit: number;
  updatedBy?: string;
  updatedAt?: string;
}

/** One app's use of the model on one day. */
export interface Usage {
  /** The day in UTC, "2026-10-23". */
  day: string;
  app: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

/** Off until an admin turns it on: the first app to need models is the Library. */
export const DEFAULT_SETTINGS: ModelSettings = { enabled: false, dailyLimit: 500 };

export interface ModelStore {
  settings(): Promise<ModelSettings>;
  saveSettings(settings: Pick<ModelSettings, 'enabled' | 'dailyLimit'>, by: string): Promise<ModelSettings>;
  /** Counts one call for an app on a day, unless it has had `limit` already: false then, and nothing is counted. */
  take(app: string, day: string, limit: number): Promise<boolean>;
  /** Adds what a call used, once the model has answered. */
  addTokens(app: string, day: string, inputTokens: number, outputTokens: number): Promise<void>;
  /** Every app's use on each day from `since` on, newest day first. */
  usage(since: string): Promise<Usage[]>;
}

const byDayThenApp = (a: Usage, b: Usage) => b.day.localeCompare(a.day) || a.app.localeCompare(b.app);

/** For tests, and for running locally without Postgres. Forgets everything on restart. */
export class MemoryModelStore implements ModelStore {
  private current: ModelSettings = { ...DEFAULT_SETTINGS };
  private used = new Map<string, Usage>();

  async settings() {
    return { ...this.current };
  }

  async saveSettings({ enabled, dailyLimit }: Pick<ModelSettings, 'enabled' | 'dailyLimit'>, by: string) {
    this.current = { enabled, dailyLimit, updatedBy: by, updatedAt: new Date().toISOString() };
    return { ...this.current };
  }

  private row(app: string, day: string) {
    const key = `${day} ${app}`;
    let row = this.used.get(key);
    if (!row) this.used.set(key, (row = { day, app, calls: 0, inputTokens: 0, outputTokens: 0 }));
    return row;
  }

  async take(app: string, day: string, limit: number) {
    if ((this.used.get(`${day} ${app}`)?.calls ?? 0) >= limit) return false;
    this.row(app, day).calls++;
    return true;
  }

  async addTokens(app: string, day: string, inputTokens: number, outputTokens: number) {
    const row = this.row(app, day);
    row.inputTokens += inputTokens;
    row.outputTokens += outputTokens;
  }

  async usage(since: string) {
    return [...this.used.values()].filter((u) => u.day >= since).map((u) => ({ ...u })).sort(byDayThenApp);
  }
}

export const migrations: { id: string; sql: string }[] = [
  {
    id: '001-settings-and-usage',
    sql: `
      create table models.settings (
        id boolean primary key default true check (id),
        enabled boolean not null,
        daily_limit integer not null,
        updated_by text not null,
        updated_at timestamptz not null default now()
      );
      create table models.usage (
        day date not null,
        app text not null,
        calls integer not null default 0,
        input_tokens bigint not null default 0,
        output_tokens bigint not null default 0,
        primary key (day, app)
      );`,
  },
];

type SettingsRow = { enabled: boolean; daily_limit: number; updated_by: string; updated_at: Date };
type UsageRow = { day: string; app: string; calls: number; input_tokens: string; output_tokens: string };

const fromSettings = (r: SettingsRow | undefined): ModelSettings =>
  r ? { enabled: r.enabled, dailyLimit: r.daily_limit, updatedBy: r.updated_by, updatedAt: r.updated_at.toISOString() } : { ...DEFAULT_SETTINGS };

/** Settings and usage in the `models` schema. */
export class PgModelStore implements ModelStore {
  constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string) {
    const store = new PgModelStore(steadyPool(new pg.Pool({ connectionString })));
    await store.migrate();
    return store;
  }

  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select pg_advisory_xact_lock(hashtext('models.migrate'))");
      // On a server the storage job makes the schema for models's own login, which may not create schemas.
      const { rowCount: hasSchema } = await client.query("select 1 from pg_namespace where nspname = 'models'");
      if (!hasSchema) await client.query('create schema models');
      await client.query('create table if not exists models.migrations (id text primary key, applied_at timestamptz not null default now())');
      const { rows } = await client.query<{ id: string }>('select id from models.migrations');
      const applied = new Set(rows.map((r) => r.id));
      for (const m of migrations.filter((m) => !applied.has(m.id))) {
        await client.query(m.sql);
        await client.query('insert into models.migrations (id) values ($1)', [m.id]);
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async settings() {
    const { rows } = await this.pool.query<SettingsRow>('select * from models.settings');
    return fromSettings(rows[0]);
  }

  async saveSettings({ enabled, dailyLimit }: Pick<ModelSettings, 'enabled' | 'dailyLimit'>, by: string) {
    const { rows } = await this.pool.query<SettingsRow>(
      `insert into models.settings (enabled, daily_limit, updated_by) values ($1, $2, $3)
       on conflict (id) do update set enabled = $1, daily_limit = $2, updated_by = $3, updated_at = now()
       returning *`,
      [enabled, dailyLimit, by],
    );
    return fromSettings(rows[0]);
  }

  async take(app: string, day: string, limit: number) {
    // One statement, so two calls at once can't both take the last one.
    const { rowCount } = await this.pool.query(
      `insert into models.usage (day, app, calls) select $1, $2, 1 where $3 > 0
       on conflict (day, app) do update set calls = models.usage.calls + 1 where models.usage.calls < $3`,
      [day, app, limit],
    );
    return rowCount === 1;
  }

  async addTokens(app: string, day: string, inputTokens: number, outputTokens: number) {
    await this.pool.query(
      `insert into models.usage (day, app, input_tokens, output_tokens) values ($1, $2, $3, $4)
       on conflict (day, app) do update set input_tokens = models.usage.input_tokens + $3, output_tokens = models.usage.output_tokens + $4`,
      [day, app, inputTokens, outputTokens],
    );
  }

  async usage(since: string) {
    const { rows } = await this.pool.query<UsageRow>(
      "select to_char(day, 'YYYY-MM-DD') as day, app, calls, input_tokens, output_tokens from models.usage where day >= $1 order by day desc, app",
      [since],
    );
    return rows.map((r) => ({ day: r.day, app: r.app, calls: r.calls, inputTokens: Number(r.input_tokens), outputTokens: Number(r.output_tokens) }));
  }

  async close() {
    await this.pool.end();
  }
}
