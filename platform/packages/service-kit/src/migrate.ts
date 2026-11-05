/** One step in a service's schema. Once it has shipped it never changes (`pnpm check:migrations`). */
export interface Migration {
  /** Its name, kept in `<schema>.migrations` once applied. Migrations run in the order given, not by id. */
  id: string;
  sql: string;
}

/** A pg.Pool, or anything else that lends a client for one transaction. */
interface Pool {
  connect(): Promise<{
    query(text: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
    release(): void;
  }>;
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Brings a service's schema up to date: runs, in order, each migration not yet recorded in
 * `<schema>.migrations`, all in one transaction, so a failing one leaves the schema as it was.
 * Safe to run from several instances at once: they queue on an advisory lock named after the
 * schema, and the later ones find nothing left to do.
 *
 * Makes the schema when it is missing. On a server the storage job makes it for the service's own
 * login, which may not be allowed to create schemas, so it is only created when it isn't there.
 */
export const runMigrations = async (pool: Pool, { schema, migrations }: { schema: string; migrations: readonly Migration[] }): Promise<void> => {
  if (!IDENTIFIER.test(schema)) throw new Error(`"${schema}" isn't a schema name runMigrations can use: lowercase letters, digits and underscores only.`);
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Migrations may take as long as they need, and so may waiting for another instance's: the pool's statement timeout is lifted for this transaction.
    await client.query('set local statement_timeout = 0');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`${schema}.migrate`]);
    const { rowCount: hasSchema } = await client.query('select 1 from pg_namespace where nspname = $1', [schema]);
    if (!hasSchema) await client.query(`create schema ${schema}`);
    await client.query(`create table if not exists ${schema}.migrations (id text primary key, applied_at timestamptz not null default now())`);
    const { rows } = await client.query(`select id from ${schema}.migrations`);
    const applied = new Set((rows as { id: string }[]).map((r) => r.id));
    for (const m of migrations.filter((m) => !applied.has(m.id))) {
      await client.query(m.sql);
      await client.query(`insert into ${schema}.migrations (id) values ($1)`, [m.id]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
};
