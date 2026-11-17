// A retired or removed app's data, in two steps (ADR 0103). First it is set aside: its database renamed retired_app_<app>
// (or, installed before apps had their own, its schemas renamed retired_<app>),
// its login renamed and unable to sign in, its bucket moved to the name retired-<app> with no key let in. Nothing reads
// it, and an app installed later under the same id starts afresh. It stays through the AUGUR release that set it aside,
// and is dropped on a later one, only behind a good backup (apps' files included) taken since it was set aside.
import pg from 'pg';
import { backupProblem } from './backup-marker.ts';
import { databaseFor, dropSchemasAndRole, jobsSchemaFor, roleFor, schemaFor, type Sql } from './postgres.ts';

/** Where a set-aside app's tables wait: "team-notes" → retired_team_notes. No app may take an id retired or retired-… (service kit). */
export const retiredSchemaFor = (app: string) => `retired_${schemaFor(app)}`;
/** Where its jobs wait: retired_team_notes_jobs. */
export const retiredJobsSchemaFor = (app: string) => `retired_${jobsSchemaFor(app)}`;
/** Its login, renamed: retired_app_team_notes. */
export const retiredRoleFor = (app: string) => `retired_${roleFor(app)}`;
/** Its own database, renamed: retired_app_team_notes. */
export const retiredDatabaseFor = (app: string) => `retired_${databaseFor(app)}`;
/** Its bucket's name while it waits: retired-team-notes. */
export const retiredBucketFor = (app: string) => `retired-${app}`;

/** The object store's part: moving an app's bucket to its set-aside name, and taking that away. Each says whether there was one. */
export interface Buckets {
  /** Whether the app has a bucket under its own name. */
  has(app: string): Promise<boolean>;
  setAside(app: string): Promise<boolean>;
  drop(app: string): Promise<boolean>;
}

/** The storage job's note of a retired or removed app: removed (gone), kept (APP_STORAGE still names it) or renamed (set aside, waiting). */
export interface Retirement {
  app: string;
  outcome: 'removed' | 'kept' | 'renamed';
  at: Date;
  renamed_in: string | null;
}

const RELEASE = /^(\d+)\.(\d+)\.(\d+)/;

/**
 * Whether `now` is a later AUGUR release than `then`: a later version, not another beta or dev build of the same one.
 * Data set aside under a name that isn't a release (a build from source, `local`) waits for the first release after.
 */
export function laterRelease(now: string | undefined, then: string | null | undefined): boolean {
  const a = RELEASE.exec(now ?? '');
  if (!a) return false;
  const b = RELEASE.exec(then ?? '');
  if (!b) return now !== then;
  for (let i = 1; i <= 3; i++) if (Number(a[i]) !== Number(b[i])) return Number(a[i]) > Number(b[i]);
  return false;
}

/** Makes the storage job's note, or brings an older one up to date. Once a run. */
export async function prepareRetirements(sql: Sql): Promise<void> {
  await sql.query('create table if not exists public.storage_retired_apps (app text primary key, outcome text not null, at timestamptz not null default now())');
  await sql.query('alter table public.storage_retired_apps add column if not exists renamed_in text');
}

/** Every app noted, or just `app`. */
export async function retirements(sql: Sql, app?: string): Promise<Retirement[]> {
  const { rows } = await sql.query<Retirement>(`select app, outcome, at, renamed_in from public.storage_retired_apps${app ? ' where app = $1' : ''}`, app ? [app] : []);
  return rows;
}

/** Notes a retired app as kept, because APP_STORAGE still names it, once. */
export async function markKept(sql: Sql, app: string): Promise<void> {
  await sql.query("insert into public.storage_retired_apps (app, outcome) values ($1, 'kept') on conflict (app) do nothing", [app]);
}

const FIND = { schema: 'select 1 from pg_namespace where nspname = $1', role: 'select 1 from pg_roles where rolname = $1', database: 'select 1 from pg_database where datname = $1' };
const exists = async (sql: Sql, kind: keyof typeof FIND, name: string) => (await sql.query(FIND[kind], [name])).rowCount === 1;

/**
 * Sets an app's data aside, noted with the release that did it; data that isn't there is noted as gone. Each step is
 * skipped when it was done already, so a try that stopped partway goes on. An app removed from the server (`again`)
 * may be noted before: an earlier copy of the same id still waiting stops it, as that one goes first.
 */
export async function setAside({ sql, buckets, app, release, again = false }: { sql: Sql; buckets?: Buckets; app: string; release: string; again?: boolean }): Promise<'set aside' | 'nothing there'> {
  const pairs: [string, string][] = [
    [schemaFor(app), retiredSchemaFor(app)],
    [jobsSchemaFor(app), retiredJobsSchemaFor(app)],
  ];
  const [waiting] = (await retirements(sql, app)).filter((r) => r.outcome === 'renamed');
  if (waiting && again) {
    const more =
      (await exists(sql, 'schema', schemaFor(app))) ||
      (await exists(sql, 'schema', jobsSchemaFor(app))) ||
      (await exists(sql, 'database', databaseFor(app))) ||
      (await exists(sql, 'role', roleFor(app))) ||
      Boolean(await buckets?.has(app));
    if (more) throw new Error(`an earlier copy of ${app}’s data, set aside in ${waiting.renamed_in ?? 'an earlier release'}, waits to be dropped with a later AUGUR release; this one is set aside after that.`);
    // Nothing new to set aside: the earlier copy keeps its own release and time.
    return 'nothing there';
  }
  let found = false;
  for (const [from, to] of pairs) {
    if (!(await exists(sql, 'schema', from))) continue;
    if (await exists(sql, 'schema', to)) throw new Error(`schema ${to} is there already, so ${from} can’t be set aside.`);
    await sql.query(`alter schema ${pg.escapeIdentifier(from)} rename to ${pg.escapeIdentifier(to)}`);
    found = true;
  }
  if (await exists(sql, 'database', databaseFor(app))) {
    if (await exists(sql, 'database', retiredDatabaseFor(app))) throw new Error(`database ${retiredDatabaseFor(app)} is there already, so ${databaseFor(app)} can’t be set aside.`);
    // Its app is stopped by now. Its login stops signing in first, then whatever it left connected is let go, since a
    // database in use can't be renamed.
    if (await exists(sql, 'role', roleFor(app))) await sql.query(`alter role ${pg.escapeIdentifier(roleFor(app))} with nologin`);
    await sql.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()', [databaseFor(app)]);
    await sql.query(`alter database ${pg.escapeIdentifier(databaseFor(app))} rename to ${pg.escapeIdentifier(retiredDatabaseFor(app))}`);
    found = true;
  }
  if (await exists(sql, 'role', roleFor(app))) {
    if (await exists(sql, 'role', retiredRoleFor(app))) throw new Error(`login ${retiredRoleFor(app)} is there already, so ${roleFor(app)} can’t be set aside.`);
    await sql.query(`alter role ${pg.escapeIdentifier(roleFor(app))} with nologin`);
    await sql.query(`alter role ${pg.escapeIdentifier(roleFor(app))} rename to ${pg.escapeIdentifier(retiredRoleFor(app))}`);
    found = true;
  }
  if (await buckets?.setAside(app)) found = true;
  // A try that stopped after renaming finds nothing left to move, but its set-aside copies are there.
  if (!found) found = (await exists(sql, 'schema', retiredSchemaFor(app))) || (await exists(sql, 'database', retiredDatabaseFor(app))) || (await exists(sql, 'role', retiredRoleFor(app)));
  const outcome = found ? 'renamed' : 'removed';
  await sql.query(
    `insert into public.storage_retired_apps (app, outcome, renamed_in) values ($1, $2, $3)
     on conflict (app) do ${again ? 'update set outcome = excluded.outcome, renamed_in = excluded.renamed_in, at = now()' : 'nothing'}`,
    [app, outcome, found ? release : null],
  );
  return found ? 'set aside' : 'nothing there';
}

/**
 * Drops what was set aside in an earlier release than `release`, each only behind a good backup taken since it was
 * set aside (`marker`, the backup container's last note). What isn't due, or can't go yet, stays and says why.
 */
export async function dropDue({ sql, buckets, release, marker, objects, log }: { sql: Sql; buckets?: Buckets; release: string; marker: unknown; objects: boolean; log: { info(m: string): void; warn(m: string): void } }): Promise<void> {
  for (const r of await retirements(sql)) {
    if (r.outcome !== 'renamed' || !laterRelease(release, r.renamed_in)) continue;
    const refused = backupProblem(marker, { since: new Date(r.at) }, objects);
    if (refused) {
      log.warn(`${r.app}’s data, set aside in ${r.renamed_in}, stays for now: ${refused}`);
      continue;
    }
    try {
      await sql.query(`drop database if exists ${pg.escapeIdentifier(retiredDatabaseFor(r.app))} with (force)`);
      await dropSchemasAndRole(sql, [retiredSchemaFor(r.app), retiredJobsSchemaFor(r.app)], retiredRoleFor(r.app));
      await buckets?.drop(r.app);
      await sql.query("update public.storage_retired_apps set outcome = 'removed', at = now() where app = $1 and outcome = 'renamed'", [r.app]);
      log.info(`${r.app}’s data, set aside in ${r.renamed_in}, is gone: its database, schemas, login and bucket.`);
    } catch (err) {
      log.warn(`${r.app}’s data, set aside in ${r.renamed_in}, couldn’t all be dropped; it’s tried again next time: ${(err as Error).message}`);
    }
  }
}
