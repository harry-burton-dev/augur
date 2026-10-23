import pg from 'pg';
import type { Scope } from '@augur/service-kit';
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
  /** Set when an admin has held the app at this version: registering again records the new version but doesn't serve it. */
  pinnedVersion?: string;
  /**
   * The scopes an admin has let the app use. Its first registration grants
   * what it asks for (an admin already gave it a sign-in); a later version that
   * asks for more is served, but gets the extra only once an admin grants it.
   */
  grantedScopes: Scope[];
  /** Set when an admin has lowered how much the app may be sent in one request, in MB. */
  uploadLimitMb?: number;
}

/**
 * What one floor says about one app. `on` and `off` install it there or take
 * it away, and carry on to the teams below unless one of them says otherwise
 * (or `carriesOn` is false). `blocked` is the guardrail layer: off there and on
 * every floor below, whatever those floors say.
 */
export interface FloorRule {
  app: string;
  workspace: string;
  state: 'on' | 'off' | 'blocked';
  carriesOn: boolean;
  setBy: string;
  setAt: string;
}

/** One version of an app as it registered, kept so an admin can go back to it. */
export interface AppVersion {
  version: string;
  entry: AppEntry;
  registeredBy: string;
  registeredAt: string;
}

/** How many versions of each app are kept. A pinned version is kept even when older. */
export const KEPT_VERSIONS = 5;

/** The admin asked for a version the registry doesn't have. */
export class UnknownVersionError extends Error {}

/** An origin an admin has allowed apps to load from. */
export interface AllowedOrigin {
  origin: string;
  addedBy: string;
  addedAt: string;
}

/** The steps an updater takes, in order; `roll-back` only when one fails. */
export const UPGRADE_STEPS = ['preflight', 'backup', 'pull', 'roll-forward', 'verify', 'roll-back'] as const;
export type UpgradeStep = (typeof UPGRADE_STEPS)[number];

/** Where one step of an upgrade stands. */
export interface UpgradeStepState {
  step: UpgradeStep;
  state: 'running' | 'done' | 'failed';
  at: string;
  message?: string;
}

/**
 * An upgrade an admin asked for. It waits (`requested`) until the deployment's updater picks it
 * up (`running`), and ends `done`, `rolled-back` (back on the old version), `failed` (it needs a
 * person) or `cancelled` (an admin took it back before it started).
 */
export interface Upgrade {
  id: string;
  from: string;
  version: string;
  /** Each part's image by digest, from the release file: all the updater will run. */
  images: Record<string, string>;
  requestedBy: string;
  requestedAt: string;
  state: 'requested' | 'running' | 'done' | 'rolled-back' | 'failed' | 'cancelled';
  steps: UpgradeStepState[];
  message?: string;
  finishedAt?: string;
}

export type UpgradeOutcome = 'done' | 'rolled-back' | 'failed';

/** Where registered apps are kept. */
export interface AppStore {
  /** Origins apps may load their entry from, besides the platform itself. */
  origins(): Promise<AllowedOrigin[]>;
  /** Allows an origin; false when it already was. */
  allowOrigin(origin: string, addedBy: string): Promise<boolean>;
  /** Stops allowing an origin; false when it wasn't. */
  removeOrigin(origin: string): Promise<boolean>;
  list(): Promise<AppEntry[]>;
  /** Every registered app with its state, by id. */
  records(): Promise<AppRecord[]>;
  /** Turns an app on or off. Re-registering doesn't change it. False when there is no such app. */
  setEnabled(id: string, enabled: boolean): Promise<boolean>;
  /**
   * Adds or replaces an app and records the version in its history; true when it was new.
   * A pinned app keeps serving its pinned version.
   */
  put(entry: AppEntry, registeredBy: string): Promise<boolean>;
  /** An app's kept versions, newest first. */
  versions(id: string): Promise<AppVersion[]>;
  /**
   * Serves one of an app's kept versions and holds it there, or with `null` lets go and serves
   * the newest. Undefined when there is no such app; UnknownVersionError when it has no such version.
   */
  pin(id: string, version: string | null): Promise<AppRecord | undefined>;
  /** Removes an app, with its versions and floor rules; false when there was none. */
  remove(id: string): Promise<boolean>;
  /** Lets an app use these scopes. Undefined when there is no such app. */
  grant(id: string, scopes: Scope[]): Promise<AppRecord | undefined>;
  /** Lowers how much the app may be sent in one request, in MB, or with `null` goes back to what its manifest asks. Undefined when there is no such app. */
  limitUploads(id: string, mb: number | null): Promise<AppRecord | undefined>;
  /** What floors say about apps: one app's, or every app's. */
  rules(app?: string): Promise<FloorRule[]>;
  /** Sets what one floor says about an app, replacing what it said before. */
  setRule(rule: Omit<FloorRule, 'setAt'>): Promise<FloorRule>;
  /** Takes a floor's rule away, so the app does what the floors above say; false when there was none. */
  clearRule(app: string, workspace: string): Promise<boolean>;
  /** The latest upgrade asked for, whatever its state. */
  upgrade(): Promise<Upgrade | undefined>;
  /** Records an upgrade to run; false when one is already waiting or under way. */
  requestUpgrade(upgrade: Pick<Upgrade, 'id' | 'from' | 'version' | 'images' | 'requestedBy'>): Promise<boolean>;
  /**
   * Records a step of the open upgrade `id`, which starts it, and with `outcome` ends it.
   * Undefined when `id` isn't the open upgrade.
   */
  progressUpgrade(id: string, step: Omit<UpgradeStepState, 'at'>, outcome?: { state: UpgradeOutcome; message?: string }): Promise<Upgrade | undefined>;
  /** Takes back an upgrade nothing has started yet; false when there is none waiting. */
  cancelUpgrade(id: string): Promise<boolean>;
}

/** A step's new state replaces its last one, so each step shows once. */
const withStep = (steps: UpgradeStepState[], step: UpgradeStepState) => [...steps.filter((s) => s.step !== step.step), step];
const isOpen = (u?: Upgrade) => u?.state === 'requested' || u?.state === 'running';

/** For tests, and for running the registry locally without Postgres. Forgets everything on restart. */
export class MemoryAppStore implements AppStore {
  private apps = new Map<string, AppRecord>();
  private history = new Map<string, AppVersion[]>();
  private allowed = new Map<string, AllowedOrigin>();
  private floorRules: FloorRule[] = [];
  private upgrades: Upgrade[] = [];

  async upgrade() {
    const last = this.upgrades.at(-1);
    return last && structuredClone(last);
  }

  async requestUpgrade(u: Pick<Upgrade, 'id' | 'from' | 'version' | 'images' | 'requestedBy'>) {
    if (isOpen(this.upgrades.at(-1))) return false;
    this.upgrades.push({ ...u, requestedAt: new Date().toISOString(), state: 'requested', steps: [] });
    return true;
  }

  async progressUpgrade(id: string, step: Omit<UpgradeStepState, 'at'>, outcome?: { state: UpgradeOutcome; message?: string }) {
    const u = this.upgrades.at(-1);
    if (!u || u.id !== id || !isOpen(u)) return undefined;
    const at = new Date().toISOString();
    u.steps = withStep(u.steps, { ...step, at });
    u.state = outcome?.state ?? 'running';
    if (outcome) {
      u.finishedAt = at;
      if (outcome.message) u.message = outcome.message;
    }
    return structuredClone(u);
  }

  async cancelUpgrade(id: string) {
    const u = this.upgrades.at(-1);
    if (!u || u.id !== id || u.state !== 'requested') return false;
    u.state = 'cancelled';
    u.finishedAt = new Date().toISOString();
    return true;
  }

  async origins() {
    return [...this.allowed.values()].sort((a, b) => a.origin.localeCompare(b.origin)).map((o) => ({ ...o }));
  }

  async allowOrigin(origin: string, addedBy: string) {
    if (this.allowed.has(origin)) return false;
    this.allowed.set(origin, { origin, addedBy, addedAt: new Date().toISOString() });
    return true;
  }

  async removeOrigin(origin: string) {
    return this.allowed.delete(origin);
  }

  async list() {
    return (await this.records()).map((r) => r.entry);
  }

  async records() {
    return [...this.apps.values()].sort((a, b) => a.entry.id.localeCompare(b.entry.id)).map((r) => structuredClone(r));
  }

  async put(entry: AppEntry, registeredBy: string) {
    const now = new Date().toISOString();
    const before = this.apps.get(entry.id);
    const kept = (this.history.get(entry.id) ?? []).filter((v) => v.version !== entry.version);
    kept.unshift({ version: entry.version, entry, registeredBy, registeredAt: now });
    this.history.set(entry.id, trim(kept, before?.pinnedVersion));
    if (before?.pinnedVersion) return false;
    this.apps.set(entry.id, {
      entry,
      enabled: before?.enabled ?? true,
      registeredBy,
      registeredAt: before?.registeredAt ?? now,
      updatedAt: now,
      grantedScopes: before?.grantedScopes ?? [...(entry.scopes ?? [])],
      ...(before?.uploadLimitMb !== undefined ? { uploadLimitMb: before.uploadLimitMb } : {}),
    });
    return !before;
  }

  async versions(id: string) {
    return structuredClone(this.history.get(id) ?? []);
  }

  async pin(id: string, version: string | null) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    const kept = this.history.get(id) ?? [];
    const target = version === null ? kept[0] : kept.find((v) => v.version === version);
    if (!target) throw new UnknownVersionError(`${record.entry.name} has no version ${version} kept.`);
    record.entry = target.entry;
    record.updatedAt = new Date().toISOString();
    if (version === null) delete record.pinnedVersion;
    else record.pinnedVersion = version;
    return structuredClone(record);
  }

  async setEnabled(id: string, enabled: boolean) {
    const record = this.apps.get(id);
    if (record) record.enabled = enabled;
    return Boolean(record);
  }

  async remove(id: string) {
    this.history.delete(id);
    this.floorRules = this.floorRules.filter((r) => r.app !== id);
    return this.apps.delete(id);
  }

  async grant(id: string, scopes: Scope[]) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    record.grantedScopes = [...scopes];
    return structuredClone(record);
  }

  async limitUploads(id: string, mb: number | null) {
    const record = this.apps.get(id);
    if (!record) return undefined;
    if (mb === null) delete record.uploadLimitMb;
    else record.uploadLimitMb = mb;
    return structuredClone(record);
  }

  async rules(app?: string) {
    return this.floorRules.filter((r) => !app || r.app === app).map((r) => ({ ...r }));
  }

  async setRule(rule: Omit<FloorRule, 'setAt'>) {
    const set = { ...rule, carriesOn: rule.state === 'blocked' || rule.carriesOn, setAt: new Date().toISOString() };
    this.floorRules = [...this.floorRules.filter((r) => !(r.app === rule.app && r.workspace === rule.workspace)), set];
    return { ...set };
  }

  async clearRule(app: string, workspace: string) {
    const before = this.floorRules.length;
    this.floorRules = this.floorRules.filter((r) => !(r.app === app && r.workspace === workspace));
    return this.floorRules.length < before;
  }
}

/** Newest first, the newest KEPT_VERSIONS plus the pinned one wherever it is. */
const trim = (versions: AppVersion[], pinned?: string) =>
  versions.filter((v, i) => i < KEPT_VERSIONS || v.version === pinned);

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
  {
    id: '003_versions',
    sql: `
      alter table registry.apps add column pinned_version text;
      create table registry.app_versions (
        app_id text not null references registry.apps (id) on delete cascade,
        version text not null,
        manifest jsonb not null,
        registered_by text not null,
        registered_at timestamptz not null default now(),
        primary key (app_id, version)
      );
      -- Every app already registered starts its history with the version it serves.
      insert into registry.app_versions (app_id, version, manifest, registered_by, registered_at)
        select id, manifest->>'version', manifest, registered_by, updated_at from registry.apps;`,
  },
  {
    id: '004_origins',
    sql: `
      create table registry.allowed_origins (
        origin text primary key,
        added_by text not null,
        added_at timestamptz not null default now()
      );`,
  },
  {
    id: '005_floors',
    sql: `
      alter table registry.apps add column granted_scopes text[] not null default '{}';
      -- Apps already registered keep what they could do.
      update registry.apps set granted_scopes = array(select jsonb_array_elements_text(coalesce(manifest->'scopes', '[]'::jsonb)));
      -- Installs: an app on or off on a floor, and whether that carries on to the teams below.
      create table registry.installs (
        app_id text not null references registry.apps (id) on delete cascade,
        workspace_id text not null,
        enabled boolean not null,
        carries_on boolean not null default true,
        set_by text not null,
        set_at timestamptz not null default now(),
        primary key (app_id, workspace_id)
      );
      -- Guardrails: a floor that blocks an app for itself and every floor below.
      create table registry.guardrails (
        app_id text not null references registry.apps (id) on delete cascade,
        workspace_id text not null,
        set_by text not null,
        set_at timestamptz not null default now(),
        primary key (app_id, workspace_id)
      );`,
  },
  {
    id: '006_upgrades',
    sql: `
      -- Upgrades admins asked for, and how the deployment's updater got on with each.
      create table registry.upgrades (
        id text primary key,
        from_version text not null,
        version text not null,
        images jsonb not null,
        requested_by text not null,
        requested_at timestamptz not null default now(),
        state text not null default 'requested',
        steps jsonb not null default '[]',
        message text,
        finished_at timestamptz
      );
      -- At most one waiting or under way, however many admins press Upgrade at once.
      create unique index upgrades_one_open on registry.upgrades ((true)) where state in ('requested', 'running');`,
  },
  {
    id: '007_upload_limit',
    sql: `
      -- An admin's lower limit on what an app may be sent in one request, in MB; null keeps its manifest's.
      alter table registry.apps add column upload_limit_mb integer;`,
  },
];

type AppRow = {
  manifest: AppEntry;
  enabled: boolean;
  registered_by: string;
  registered_at: Date;
  updated_at: Date;
  pinned_version: string | null;
  granted_scopes: Scope[];
  upload_limit_mb: number | null;
};

const fromAppRow = (r: AppRow): AppRecord => ({
  entry: r.manifest,
  enabled: r.enabled,
  registeredBy: r.registered_by,
  registeredAt: r.registered_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  ...(r.pinned_version ? { pinnedVersion: r.pinned_version } : {}),
  grantedScopes: r.granted_scopes,
  ...(r.upload_limit_mb !== null ? { uploadLimitMb: r.upload_limit_mb } : {}),
});

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

  async origins() {
    const { rows } = await this.pool.query<{ origin: string; added_by: string; added_at: Date }>('select * from registry.allowed_origins order by origin');
    return rows.map((r) => ({ origin: r.origin, addedBy: r.added_by, addedAt: r.added_at.toISOString() }));
  }

  async allowOrigin(origin: string, addedBy: string) {
    const { rowCount } = await this.pool.query('insert into registry.allowed_origins (origin, added_by) values ($1, $2) on conflict do nothing', [origin, addedBy]);
    return rowCount === 1;
  }

  async removeOrigin(origin: string) {
    const { rowCount } = await this.pool.query('delete from registry.allowed_origins where origin = $1', [origin]);
    return rowCount === 1;
  }

  async list() {
    const { rows } = await this.pool.query<{ manifest: AppEntry }>('select manifest from registry.apps order by id');
    return rows.map((r) => r.manifest);
  }

  async records() {
    const { rows } = await this.pool.query<AppRow>('select * from registry.apps order by id');
    return rows.map(fromAppRow);
  }

  async setEnabled(id: string, enabled: boolean) {
    const { rowCount } = await this.pool.query('update registry.apps set enabled = $2 where id = $1', [id, enabled]);
    return rowCount === 1;
  }

  async put(entry: AppEntry, registeredBy: string) {
    return this.transaction(async (client) => {
      // A pinned app keeps what it serves; only its history learns the new version.
      const { rows } = await client
        .query<{ created: boolean; pinned_version: string | null }>(
          `insert into registry.apps (id, route, manifest, registered_by, granted_scopes) values ($1, $2, $3, $4, $5)
           on conflict (id) do update set
             route = case when registry.apps.pinned_version is null then excluded.route else registry.apps.route end,
             manifest = case when registry.apps.pinned_version is null then excluded.manifest else registry.apps.manifest end,
             registered_by = case when registry.apps.pinned_version is null then excluded.registered_by else registry.apps.registered_by end,
             updated_at = case when registry.apps.pinned_version is null then now() else registry.apps.updated_at end
           returning (xmax = 0) as created, pinned_version`,
          [entry.id, entry.route, entry, registeredBy, entry.scopes ?? []],
        )
        .catch((err: { code?: string }) => {
          throw err.code === '23505' ? new RouteTakenError(`Another app already lives at ${entry.route}.`) : err;
        });
      await client.query(
        `insert into registry.app_versions (app_id, version, manifest, registered_by) values ($1, $2, $3, $4)
         on conflict (app_id, version) do update set manifest = excluded.manifest, registered_by = excluded.registered_by, registered_at = now()`,
        [entry.id, entry.version, entry, registeredBy],
      );
      await client.query(
        `delete from registry.app_versions v where v.app_id = $1
           and v.version is distinct from (select pinned_version from registry.apps where id = $1)
           and v.version not in (select version from registry.app_versions where app_id = $1 order by registered_at desc, version desc limit $2)`,
        [entry.id, KEPT_VERSIONS],
      );
      return rows[0].created;
    });
  }

  async versions(id: string) {
    const { rows } = await this.pool.query<{ version: string; manifest: AppEntry; registered_by: string; registered_at: Date }>(
      'select version, manifest, registered_by, registered_at from registry.app_versions where app_id = $1 order by registered_at desc, version desc',
      [id],
    );
    return rows.map((r) => ({ version: r.version, entry: r.manifest, registeredBy: r.registered_by, registeredAt: r.registered_at.toISOString() }));
  }

  async pin(id: string, version: string | null) {
    return this.transaction(async (client) => {
      const { rows: apps } = await client.query<AppRow>('select * from registry.apps where id = $1 for update', [id]);
      if (!apps.length) return undefined;
      const { rows } = await client.query<{ manifest: AppEntry }>(
        version === null
          ? 'select manifest from registry.app_versions where app_id = $1 order by registered_at desc, version desc limit 1'
          : 'select manifest from registry.app_versions where app_id = $1 and version = $2',
        version === null ? [id] : [id, version],
      );
      if (!rows.length) throw new UnknownVersionError(`${apps[0].manifest.name} has no version ${version} kept.`);
      const { rows: updated } = await client
        .query<AppRow>('update registry.apps set manifest = $2, route = $3, pinned_version = $4, updated_at = now() where id = $1 returning *', [
          id,
          rows[0].manifest,
          rows[0].manifest.route,
          version,
        ])
        .catch((err: { code?: string }) => {
          throw err.code === '23505' ? new RouteTakenError(`Another app now lives at ${rows[0].manifest.route}.`) : err;
        });
      return fromAppRow(updated[0]);
    });
  }

  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async remove(id: string) {
    const { rowCount } = await this.pool.query('delete from registry.apps where id = $1', [id]);
    return rowCount === 1;
  }

  async grant(id: string, scopes: Scope[]) {
    const { rows } = await this.pool.query<AppRow>('update registry.apps set granted_scopes = $2 where id = $1 returning *', [id, scopes]);
    return rows[0] && fromAppRow(rows[0]);
  }

  async limitUploads(id: string, mb: number | null) {
    const { rows } = await this.pool.query<AppRow>('update registry.apps set upload_limit_mb = $2 where id = $1 returning *', [id, mb]);
    return rows[0] && fromAppRow(rows[0]);
  }

  async rules(app?: string) {
    const { rows } = await this.pool.query<{ app_id: string; workspace_id: string; state: FloorRule['state']; carries_on: boolean; set_by: string; set_at: Date }>(
      `select app_id, workspace_id, case when enabled then 'on' else 'off' end as state, carries_on, set_by, set_at from registry.installs where $1::text is null or app_id = $1
       union all
       select app_id, workspace_id, 'blocked', true, set_by, set_at from registry.guardrails where $1::text is null or app_id = $1
       order by app_id, set_at`,
      [app ?? null],
    );
    return rows.map((r) => ({ app: r.app_id, workspace: r.workspace_id, state: r.state, carriesOn: r.carries_on, setBy: r.set_by, setAt: r.set_at.toISOString() }));
  }

  async setRule(rule: Omit<FloorRule, 'setAt'>) {
    return this.transaction(async (client) => {
      await client.query('delete from registry.installs where app_id = $1 and workspace_id = $2', [rule.app, rule.workspace]);
      await client.query('delete from registry.guardrails where app_id = $1 and workspace_id = $2', [rule.app, rule.workspace]);
      const { rows } = await client.query<{ set_at: Date }>(
        rule.state === 'blocked'
          ? 'insert into registry.guardrails (app_id, workspace_id, set_by) values ($1, $2, $3) returning set_at'
          : 'insert into registry.installs (app_id, workspace_id, set_by, enabled, carries_on) values ($1, $2, $3, $4, $5) returning set_at',
        rule.state === 'blocked' ? [rule.app, rule.workspace, rule.setBy] : [rule.app, rule.workspace, rule.setBy, rule.state === 'on', rule.carriesOn],
      );
      return { ...rule, ...(rule.state === 'blocked' ? { carriesOn: true } : {}), setAt: rows[0].set_at.toISOString() };
    });
  }

  async clearRule(app: string, workspace: string) {
    return this.transaction(async (client) => {
      const a = await client.query('delete from registry.installs where app_id = $1 and workspace_id = $2', [app, workspace]);
      const b = await client.query('delete from registry.guardrails where app_id = $1 and workspace_id = $2', [app, workspace]);
      return (a.rowCount ?? 0) + (b.rowCount ?? 0) > 0;
    });
  }

  async upgrade() {
    const { rows } = await this.pool.query<UpgradeRow>('select * from registry.upgrades order by requested_at desc limit 1');
    return rows[0] && fromUpgradeRow(rows[0]);
  }

  async requestUpgrade(u: Pick<Upgrade, 'id' | 'from' | 'version' | 'images' | 'requestedBy'>) {
    const { rowCount } = await this.pool.query(
      'insert into registry.upgrades (id, from_version, version, images, requested_by) values ($1, $2, $3, $4, $5) on conflict do nothing',
      [u.id, u.from, u.version, JSON.stringify(u.images), u.requestedBy],
    );
    return rowCount === 1;
  }

  async progressUpgrade(id: string, step: Omit<UpgradeStepState, 'at'>, outcome?: { state: UpgradeOutcome; message?: string }) {
    return this.transaction(async (client) => {
      const { rows } = await client.query<UpgradeRow>("select * from registry.upgrades where id = $1 and state in ('requested', 'running') for update", [id]);
      if (!rows[0]) return undefined;
      const at = new Date().toISOString();
      const steps = withStep(fromUpgradeRow(rows[0]).steps, { ...step, at });
      const { rows: updated } = await client.query<UpgradeRow>(
        `update registry.upgrades set steps = $2, state = $3, message = coalesce($4, message), finished_at = case when $5 then now() else finished_at end
         where id = $1 returning *`,
        [id, JSON.stringify(steps), outcome?.state ?? 'running', outcome?.message ?? null, Boolean(outcome)],
      );
      return fromUpgradeRow(updated[0]);
    });
  }

  async cancelUpgrade(id: string) {
    const { rowCount } = await this.pool.query("update registry.upgrades set state = 'cancelled', finished_at = now() where id = $1 and state = 'requested'", [id]);
    return rowCount === 1;
  }

  close() {
    return this.pool.end();
  }
}

type UpgradeRow = {
  id: string;
  from_version: string;
  version: string;
  images: Record<string, string>;
  requested_by: string;
  requested_at: Date;
  state: Upgrade['state'];
  steps: UpgradeStepState[];
  message: string | null;
  finished_at: Date | null;
};

const fromUpgradeRow = (r: UpgradeRow): Upgrade => ({
  id: r.id,
  from: r.from_version,
  version: r.version,
  images: r.images,
  requestedBy: r.requested_by,
  requestedAt: r.requested_at.toISOString(),
  state: r.state,
  steps: r.steps,
  ...(r.message ? { message: r.message } : {}),
  ...(r.finished_at ? { finishedAt: r.finished_at.toISOString() } : {}),
});
