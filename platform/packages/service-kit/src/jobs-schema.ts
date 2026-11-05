import pg from 'pg';

/**
 * Readies the jobs schema for a login that can't create schemas. DBOS's first step on launch is
 * `create schema if not exists`, and Postgres refuses that from a login without CREATE on the
 * database even when the schema is there and the login owns it. On a server the storage service
 * makes the schema for the login, so when it's there and DBOS hasn't recorded anything in it yet,
 * this records DBOS's first step (the schema) as done; DBOS then makes its tables in the schema
 * the login owns. A login that can create schemas is left to DBOS.
 */
export async function prepareJobsSchema(databaseUrl: string, schema: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ creates: boolean; there: boolean; recorded: boolean }>(
      `select has_database_privilege(current_database(), 'CREATE') as creates,
              exists (select 1 from pg_namespace where nspname = $1) as there,
              exists (select 1 from information_schema.tables where table_schema = $1 and table_name = 'dbos_migrations') as recorded`,
      [schema],
    );
    const { creates, there, recorded } = rows[0];
    if (creates || !there || recorded) return;
    const table = `${pg.escapeIdentifier(schema)}."dbos_migrations"`;
    // The table as DBOS's second step makes it; that step then finds it there and goes on.
    await client.query(`create table if not exists ${table} ("version" bigint not null, constraint "dbos_migrations_pkey" primary key ("version"))`);
    await client.query(`insert into ${table} ("version") select 1 where not exists (select 1 from ${table})`);
  } finally {
    await client.end();
  }
}
