import pg from 'pg';

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
 * embeddings), and nobody but the logins given it may connect or create in public.
 * A service login can't create extensions on a managed Postgres, so it happens here.
 */
export async function prepareDatabase(sql: Sql): Promise<void> {
  await sql.query('create extension if not exists vector');
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
  const role = pg.escapeIdentifier(roleFor(app));
  await sql.query(`drop schema if exists ${pg.escapeIdentifier(schemaFor(app))} cascade`);
  const exists = await sql.query('select 1 from pg_roles where rolname = $1', [roleFor(app)]);
  if (!exists.rowCount) return;
  await sql.query(`drop owned by ${role}`);
  await sql.query(`drop role ${role}`);
}
