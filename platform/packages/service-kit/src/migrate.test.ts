import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LOCK_NAMESPACE } from './locks.ts';
import { MigrationLockTimeout, migrationIdleTimeoutMs, migrationLockTimeoutMs, runMigrations, type Migration } from './migrate.ts';

describe('runMigrations', () => {
  it('refuses a schema name it would have to quote', async () => {
    const pool = { connect: () => Promise.reject(new Error('should not connect')) };
    await expect(runMigrations(pool, { schema: 'a; drop table b', migrations: [] })).rejects.toThrow(/schema name/);
  });

  it('reads its lock and idle limits from the settings, 60 and 60 seconds when unset or nonsense', () => {
    expect(migrationLockTimeoutMs({ DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS: '5' })).toBe(5_000);
    expect(migrationLockTimeoutMs({ DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS: '0' })).toBe(0);
    expect(migrationLockTimeoutMs({})).toBe(60_000);
    expect(migrationLockTimeoutMs({ DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS: 'soon' })).toBe(60_000);
    expect(migrationIdleTimeoutMs({ DATABASE_MIGRATION_IDLE_TIMEOUT_SECONDS: '90' })).toBe(90_000);
    expect(migrationIdleTimeoutMs({ DATABASE_MIGRATION_IDLE_TIMEOUT_SECONDS: '' })).toBe(60_000);
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

  /** Runs `body` while a second session holds what `hold` takes, in a transaction it rolls back afterwards. */
  const whileHeld = async (hold: string, values: unknown[], body: (holder: number) => Promise<void>, on: pg.Pool = pool) => {
    const holder = await on.connect();
    try {
      await holder.query('begin');
      await holder.query(hold, values);
      const { rows } = await holder.query<{ pid: number }>('select pg_backend_pid() as pid');
      await body(rows[0]!.pid);
    } finally {
      await holder.query('rollback');
      holder.release();
    }
  };

  it('gives up waiting for another session’s migration lock, saying which, for how long, and who holds it', async () => {
    await whileHeld('select pg_advisory_xact_lock($1, hashtext($2))', [LOCK_NAMESPACE.migrations, schema], async (holder) => {
      const started = Date.now();
      const failed = await runMigrations(pool, { schema, migrations, lockTimeoutMs: 300 }).catch((err: unknown) => err);
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(failed).toBeInstanceOf(MigrationLockTimeout);
      const message = (failed as Error).message;
      expect(message).toContain(`${schema}'s migrations`);
      expect(message).toContain('003_counter');
      expect(message).toContain(`advisory lock (${LOCK_NAMESPACE.migrations}, hashtext('${schema}'))`);
      expect(message).toContain('0.3s (DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS)');
      expect(message).toContain(`pid ${holder}`);
      expect(message).not.toMatch(/postgres(ql)?:\/\//);
    });
    // Rolled back: nothing was made, and with the lock free it runs.
    expect((await pool.query('select 1 from pg_namespace where nspname = $1', [schema])).rowCount).toBe(0);
    await runMigrations(pool, { schema, migrations, lockTimeoutMs: 300 });
    expect(await applied()).toEqual(['001_things', '002_more', '003_counter']);
  });

  it('gives up on a migration that waits for a table another session is using, naming the migration', async () => {
    await runMigrations(pool, { schema, migrations: migrations.slice(0, 1) });
    // An app's open transaction that read the table: altering it must wait for that to end.
    await whileHeld(`lock table ${schema}.things in access share mode`, [], async (holder) => {
      const failed = await runMigrations(pool, { schema, migrations, lockTimeoutMs: 300 }).catch((err: unknown) => err);
      expect(failed).toBeInstanceOf(MigrationLockTimeout);
      expect((failed as MigrationLockTimeout).migration).toBe('002_more');
      expect((failed as Error).message).toMatch(/Migration 002_more of .* gave up after 0\.3s \(DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS\)/);
      expect((failed as Error).message).toContain(`pid ${holder}`);
    });
    expect(await applied()).toEqual(['001_things']);
    expect(await tables()).toEqual(['migrations', 'things']);
  });

  it('says a blocking session’s details are not visible to a login that may not see them', async () => {
    // A service's own login, like an app's, sees only its own sessions in pg_stat_activity.
    const role = 'service_kit_migrate_login';
    await pool.query(`drop role if exists ${role}`);
    await pool.query(`create role ${role} login password 'migrate-test-only'`);
    await pool.query(`create schema ${schema} authorization ${role}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.username = role;
    url.password = 'migrate-test-only';
    const own = new pg.Pool({ connectionString: url.toString(), max: 1 });
    try {
      await whileHeld('select pg_advisory_xact_lock($1, hashtext($2))', [LOCK_NAMESPACE.migrations, schema], async (holder) => {
        const failed = await runMigrations(own, { schema, migrations, lockTimeoutMs: 300 }).catch((err: unknown) => err);
        expect(failed).toBeInstanceOf(MigrationLockTimeout);
        expect((failed as Error).message).toMatch(new RegExp(`pid ${holder} \\(platform, [^)]*its state not visible to this role\\)`));
      });
    } finally {
      await own.end();
      await pool.query(`drop schema if exists ${schema} cascade`);
      await pool.query(`drop role ${role}`);
    }
  });

  it('waits as long as the lock timeout allows, so instances still queue behind a migration that takes a moment', async () => {
    const slow = [{ id: '001_slow', sql: `create table ${schema}.slow (n int); select pg_sleep(0.3)` }];
    await Promise.all([1, 2].map(() => runMigrations(pool, { schema, migrations: slow, lockTimeoutMs: 5_000 })));
    expect(await applied()).toEqual(['001_slow']);
  });
});
