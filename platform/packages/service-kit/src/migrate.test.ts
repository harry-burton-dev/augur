import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations, type Migration } from './migrate.ts';

describe('runMigrations', () => {
  it('refuses a schema name it would have to quote', async () => {
    const pool = { connect: () => Promise.reject(new Error('should not connect')) };
    await expect(runMigrations(pool, { schema: 'a; drop table b', migrations: [] })).rejects.toThrow(/schema name/);
  });
});

describe.runIf(process.env.DATABASE_URL)('runMigrations on Postgres', () => {
  // Unique to this test file: other packages' tests share the database.
  const schema = 'service_kit_migrate_test';
  let pool: pg.Pool;
  const tables = async () =>
    (await pool.query<{ table_name: string }>('select table_name from information_schema.tables where table_schema = $1 order by table_name', [schema])).rows.map((r) => r.table_name);
  const applied = async () => (await pool.query<{ id: string }>(`select id from ${schema}.migrations order by applied_at, id`)).rows.map((r) => r.id);

  const migrations: Migration[] = [
    { id: '001_things', sql: `create table ${schema}.things (id text primary key)` },
    { id: '002_more', sql: `alter table ${schema}.things add column label text not null default ''` },
    { id: '003_counter', sql: `create table ${schema}.counter (n int not null); insert into ${schema}.counter values (0)` },
  ];

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6 });
  });
  beforeEach(async () => {
    await pool.query(`drop schema if exists ${schema} cascade`);
  });
  afterAll(async () => {
    await pool.query(`drop schema if exists ${schema} cascade`);
    await pool.end();
  });

  it('makes the schema and applies the migrations in order', async () => {
    await runMigrations(pool, { schema, migrations });
    expect(await tables()).toEqual(['counter', 'migrations', 'things']);
    expect(await applied()).toEqual(['001_things', '002_more', '003_counter']);
  });

  it('does nothing on a second run, and applies only what is new', async () => {
    await runMigrations(pool, { schema, migrations: migrations.slice(0, 2) });
    await runMigrations(pool, { schema, migrations: migrations.slice(0, 2) });
    await runMigrations(pool, { schema, migrations });
    await runMigrations(pool, { schema, migrations });
    expect(await applied()).toEqual(['001_things', '002_more', '003_counter']);
    expect((await pool.query(`select n from ${schema}.counter`)).rows).toEqual([{ n: 0 }]);
  });

  it('uses a schema that is already there', async () => {
    await pool.query(`create schema ${schema}`);
    await runMigrations(pool, { schema, migrations });
    expect(await applied()).toHaveLength(3);
  });

  it('lets several instances start at once, applying each migration once', async () => {
    // Each insert would fail a primary key, and the counter would be off, if a migration ran twice.
    const counted = [...migrations, { id: '004_count', sql: `update ${schema}.counter set n = n + 1` }];
    await Promise.all([1, 2, 3, 4].map(() => runMigrations(pool, { schema, migrations: counted })));
    expect(await applied()).toEqual(['001_things', '002_more', '003_counter', '004_count']);
    expect((await pool.query(`select n from ${schema}.counter`)).rows).toEqual([{ n: 1 }]);
  });

  it('rolls the whole run back when a migration fails', async () => {
    const failing = [...migrations, { id: '004_broken', sql: `alter table ${schema}.nothing add column x int` }];
    await expect(runMigrations(pool, { schema, migrations: failing })).rejects.toThrow(/nothing/);
    expect((await pool.query('select 1 from pg_namespace where nspname = $1', [schema])).rowCount).toBe(0);

    await runMigrations(pool, { schema, migrations: migrations.slice(0, 1) });
    await expect(runMigrations(pool, { schema, migrations: failing })).rejects.toThrow(/nothing/);
    expect(await applied()).toEqual(['001_things']);
    expect(await tables()).toEqual(['migrations', 'things']);
  });
});
