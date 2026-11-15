// A retired or removed app's data, in two steps (ADR 0103). First it is set aside: its schemas renamed retired_<app>,
// its login renamed and unable to sign in, its bucket moved to the name retired-<app>. Nothing reads it, and an app
// installed later under the same id starts afresh. It stays through the AUGUR release that set it aside, and is dropped
// on a later one, only behind a good backup (apps' files included) taken since it was set aside.
import pg from 'pg';
import { backupProblem } from './backup-marker.ts';
import { jobsSchemaFor, roleFor, schemaFor, type Sql } from './postgres.ts';

/** Where a set-aside app's tables wait: "team-notes" → retired_team_notes (and retired_team_notes_jobs). */
export const retiredSchemaFor = (app: string) => `retired_${schemaFor(app)}`;
/** Its login, renamed: retired_app_team_notes. */
export const retiredRoleFor = (app: string) => `retired_${roleFor(app)}`;
/** Its bucket's name while it waits: retired-team-notes. No app may take an id starting retired- (service kit). */
export const retiredBucketFor = (app: string) => `retired-${app}`;

/** The object store's part: moving an app's bucket to its set-aside name, and taking that away. Each says whether there was one. */
export interface Buckets {
  setAside(app: string): Promise<boolean>;
  drop(app: string): Promise<boolean>;
}

const RELEASE = /^(\d+)\.(\d+)\.(\d+)/;

/** Whether `now` is a later AUGUR release than `then`: a later version, not another beta or dev build of the same one. */
export function laterRelease(now: string | undefined, then: string | null | undefined): boolean {
  const a = RELEASE.exec(now ?? '');
  const b = RELEASE.exec(then ?? '');
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i++) if (Number(a[i]) !== Number(b[i])) return Number(a[i]) > Number(b[i]);
  return false;
}

/** The storage job's note of each retired or removed app: removed (gone), kept (APP_STORAGE still names it) or renamed (waiting). */
export async function retirements(sql: Sql): Promise<{ app: string; outcome: string; at: Date; renamed_in: string | null }[]> {
  await sql.query('create table if not exists public.storage_retired_apps (app text primary key, outcome text not null, at timestamptz not null default now())');
  await sql.query('alter table public.storage_retired_apps add column if not exists renamed_in text');
  return (await sql.query<{ app: string; outcome: string; at: Date; renamed_in: string | null }>('select app, outcome, at, renamed_in from public.storage_retired_apps')).rows;
}

const exists = async (sql: Sql, kind: 'schema' | 'role', name: string) =>
  (await sql.query(kind === 'schema' ? 'select 1 from pg_namespace where nspname = $1' : 'select 1 from pg_roles where rolname = $1', [name])).rowCount === 1;

/**
 * Sets an app's data aside, noted with the release that did it. Each step is skipped when it was done already, so a
 * try that stopped partway goes on. An earlier copy of the same id still waiting stops it: that one goes first.
 */
export async function setAside({ sql, buckets, app, release, again = false }: { sql: Sql; buckets?: Buckets; app: string; release: string; again?: boolean }): Promise<void> {
  const waiting = (await retirements(sql)).find((r) => r.app === app && r.outcome === 'renamed');
  const pairs: [string, string][] = [
    [schemaFor(app), retiredSchemaFor(app)],
    [jobsSchemaFor(app), `${retiredSchemaFor(app)}_jobs`],
  ];
  if (waiting && again && ((await exists(sql, 'schema', schemaFor(app))) || (await exists(sql, 'role', roleFor(app)))))
    throw new Error(`an earlier copy of ${app}’s data, set aside in ${waiting.renamed_in ?? 'an earlier release'}, waits to be dropped with a later AUGUR release; this one is set aside after that.`);
  for (const [from, to] of pairs) {
    if (!(await exists(sql, 'schema', from))) continue;
    if (await exists(sql, 'schema', to)) throw new Error(`schema ${to} is there already, so ${from} can’t be set aside.`);
    await sql.query(`alter schema ${pg.escapeIdentifier(from)} rename to ${pg.escapeIdentifier(to)}`);
  }
  if (await exists(sql, 'role', roleFor(app))) {
    if (await exists(sql, 'role', retiredRoleFor(app))) throw new Error(`login ${retiredRoleFor(app)} is there already, so ${roleFor(app)} can’t be set aside.`);
    await sql.query(`alter role ${pg.escapeIdentifier(roleFor(app))} with nologin`);
    await sql.query(`alter role ${pg.escapeIdentifier(roleFor(app))} rename to ${pg.escapeIdentifier(retiredRoleFor(app))}`);
  }
  await buckets?.setAside(app);
  await sql.query(
    `insert into public.storage_retired_apps (app, outcome, renamed_in) values ($1, 'renamed', $2)
     on conflict (app) do ${again ? "update set outcome = 'renamed', renamed_in = excluded.renamed_in, at = now()" : 'nothing'}`,
    [app, release],
  );
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
      await sql.query(`drop schema if exists ${pg.escapeIdentifier(retiredSchemaFor(r.app))} cascade`);
      await sql.query(`drop schema if exists ${pg.escapeIdentifier(`${retiredSchemaFor(r.app)}_jobs`)} cascade`);
      if (await exists(sql, 'role', retiredRoleFor(r.app))) {
        await sql.query(`drop owned by ${pg.escapeIdentifier(retiredRoleFor(r.app))}`);
        await sql.query(`drop role ${pg.escapeIdentifier(retiredRoleFor(r.app))}`);
      }
      await buckets?.drop(r.app);
      await sql.query("update public.storage_retired_apps set outcome = 'removed', at = now() where app = $1 and outcome = 'renamed'", [r.app]);
      log.info(`${r.app}’s data, set aside in ${r.renamed_in}, is gone: its schemas, login and bucket.`);
    } catch (err) {
      log.warn(`${r.app}’s data, set aside in ${r.renamed_in}, couldn’t all be dropped; it’s tried again next time: ${(err as Error).message}`);
    }
  }
}
