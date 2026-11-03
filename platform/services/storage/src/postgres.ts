import pg from 'pg';
import { reservedIdProblem } from '@augur/service-kit';

/** What the database work needs from a connection: one statement at a time. */
export interface Sql {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<R>>;
}

/** An app's database login: "folio" → app_folio. */
export const roleFor = (app: string) => `app_${app.replace(/-/g, '_')}`;
/** The schema an app owns: "folio" → folio, "team-notes" → team_notes. */
export const schemaFor = (app: string) => app.replace(/-/g, '_');

/**
 * Once per database, by an admin login: the extensions apps may use (pgvector, for
 * embeddings, and pg_trgm, for names spelt nearly alike), and nobody but the logins given it may connect or create in public.
 * A service login can't create extensions on a managed Postgres, so it happens here.
 */
export async function prepareDatabase(sql: Sql): Promise<void> {
  await sql.query('create extension if not exists vector');
  await sql.query('create extension if not exists pg_trgm');
  // Identity's floors are an ltree; its own login can't create the extension.
  await sql.query('create extension if not exists ltree');
  const { rows } = await sql.query<{ db: string }>('select current_database() as db');
  await sql.query(`revoke all on database ${pg.escapeIdentifier(rows[0].db)} from public`);
  await sql.query('revoke create on schema public from public');
}

/**
 * An app's own login and the one schema it owns, made or brought up to date: the
 * password is set every time, so changing it in .env and starting again changes it.
 * The login can't read any other schema: the platform's belong to the admin login.
 */
export async function provisionDatabase(sql: Sql, { app, password }: { app: string; password: string }): Promise<void> {
  // A schema named for a part of AUGUR (identity, registry, public…) would sit among the platform's own.
  const reserved = reservedIdProblem(app);
  if (reserved) throw new Error(`No schema was made for it: ${reserved}`);
  const role = pg.escapeIdentifier(roleFor(app));
  const schema = pg.escapeIdentifier(schemaFor(app));
  const exists = await sql.query('select 1 from pg_roles where rolname = $1', [roleFor(app)]);
  const options = `login nosuperuser nocreatedb nocreaterole noinherit password ${pg.escapeLiteral(password)}`;
  await sql.query(exists.rowCount ? `alter role ${role} with ${options}` : `create role ${role} with ${options}`);
  const { rows } = await sql.query<{ db: string }>('select current_database() as db');
  await sql.query(`grant connect on database ${pg.escapeIdentifier(rows[0].db)} to ${role}`);
  await sql.query(`create schema if not exists ${schema} authorization ${role}`);
  await sql.query(`alter schema ${schema} owner to ${role}`);
  await sql.query(`alter role ${role} set search_path = ${schema}, public`);
}

/** Takes a preview's login and schema away, with everything in the schema. Nothing happens when there's none. */
export async function dropDatabase(sql: Sql, app: string): Promise<void> {
  const reserved = reservedIdProblem(app);
  if (reserved) throw new Error(`Nothing was dropped: ${reserved}`);
  const role = pg.escapeIdentifier(roleFor(app));
  await sql.query(`drop schema if exists ${pg.escapeIdentifier(schemaFor(app))} cascade`);
  const exists = await sql.query('select 1 from pg_roles where rolname = $1', [roleFor(app)]);
  if (!exists.rowCount) return;
  await sql.query(`drop owned by ${role}`);
  await sql.query(`drop role ${role}`);
}

/** A platform service's database login: "identity" → platform_identity. Its schema is named after the service. */
export const serviceRoleFor = (service: string) => `platform_${service.replace(/-/g, '_')}`;

/**
 * Makes `role` the owner of everything in `schema` that isn't part of an extension: tables, views,
 * standalone sequences (a table's own sequences follow it), functions and types. A service that
 * ran as the admin login before has its objects owned by that login; this hands them over.
 */
export async function handOverSchema(sql: Sql, schema: string, role: string): Promise<number> {
  const { rows } = await sql.query<{ statement: string }>(
    `with mine as (select oid from pg_roles where rolname = $2),
     extension_parts as (select objid from pg_depend where deptype = 'e'),
     relations as (
       select format('alter %s %I.%I owner to %I',
                case c.relkind when 'v' then 'view' when 'm' then 'materialized view' when 'f' then 'foreign table' when 'S' then 'sequence' else 'table' end,
                n.nspname, c.relname, $2) as statement
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = $1 and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
         and c.relowner <> (select oid from mine)
         and c.oid not in (select objid from extension_parts)
         and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype in ('a', 'i'))
     ),
     routines as (
       select format('alter routine %I.%I(%s) owner to %I', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), $2) as statement
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = $1 and p.proowner <> (select oid from mine) and p.oid not in (select objid from extension_parts)
     ),
     types as (
       select format('alter type %I.%I owner to %I', n.nspname, t.typname, $2) as statement
       from pg_type t join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = $1 and t.typtype in ('e', 'd', 'r', 'm') and t.typowner <> (select oid from mine)
         and t.oid not in (select objid from extension_parts)
     )
     select statement from relations union all select statement from routines union all select statement from types`,
    [schema, role],
  );
  for (const { statement } of rows) await sql.query(statement);
  return rows.length;
}

/**
 * A platform service's own login, owning only its own schema, made or brought up to date, the way
 * an app's is: the password is set every time. Whatever the service made while it ran as the admin
 * login is handed over to it. It can't read any other service's schema, so a flaw in one service
 * can't read or rewrite another's tables, the audit log included (ADR 0005).
 */
export async function provisionServiceDatabase(sql: Sql, { service, password }: { service: string; password: string }): Promise<number> {
  const role = serviceRoleFor(service);
  const quoted = pg.escapeIdentifier(role);
  const schema = pg.escapeIdentifier(service);
  const exists = await sql.query('select 1 from pg_roles where rolname = $1', [role]);
  const options = `login nosuperuser nocreatedb nocreaterole noinherit password ${pg.escapeLiteral(password)}`;
  await sql.query(exists.rowCount ? `alter role ${quoted} with ${options}` : `create role ${quoted} with ${options}`);
  const { rows } = await sql.query<{ db: string }>('select current_database() as db');
  await sql.query(`grant connect on database ${pg.escapeIdentifier(rows[0].db)} to ${quoted}`);
  await sql.query(`create schema if not exists ${schema} authorization ${quoted}`);
  await sql.query(`alter schema ${schema} owner to ${quoted}`);
  await sql.query(`alter role ${quoted} set search_path = ${schema}, public`);
  return handOverSchema(sql, service, role);
}

/**
 * Keycloak's own login, owning its own database (`sql` is connected to that database). Like a
 * service's login, everything Keycloak made while it ran as the admin login is handed over.
 */
export async function provisionKeycloakDatabase(sql: Sql, { role, password }: { role: string; password: string }): Promise<number> {
  const quoted = pg.escapeIdentifier(role);
  const exists = await sql.query('select 1 from pg_roles where rolname = $1', [role]);
  const options = `login nosuperuser nocreatedb nocreaterole noinherit password ${pg.escapeLiteral(password)}`;
  await sql.query(exists.rowCount ? `alter role ${quoted} with ${options}` : `create role ${quoted} with ${options}`);
  const { rows } = await sql.query<{ db: string }>('select current_database() as db');
  await sql.query(`alter database ${pg.escapeIdentifier(rows[0].db)} owner to ${quoted}`);
  await sql.query(`alter schema public owner to ${quoted}`);
  return handOverSchema(sql, 'public', role);
}
