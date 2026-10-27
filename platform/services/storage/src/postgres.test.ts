import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dropDatabase, prepareDatabase, provisionDatabase, roleFor, schemaFor } from './postgres.ts';

// Runs wherever DATABASE_URL points at a Postgres with pgvector; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('an app’s database login', () => {
  const app = `storage-test-${process.pid}`;
  let admin: pg.Client;
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    await prepareDatabase(admin);
  });
  afterAll(async () => {
    await admin.query(`drop schema if exists ${schemaFor(app)} cascade`);
    await admin.query(`drop owned by ${roleFor(app)}`).catch(() => {});
    await admin.query(`drop role if exists ${roleFor(app)}`);
    await admin.end();
  });

  const asApp = async (password: string) => {
    const url = new URL(process.env.DATABASE_URL!);
    url.username = roleFor(app);
    url.password = password;
    const client = new pg.Client({ connectionString: url.toString() });
    await client.connect();
    return client;
  };

  it('owns its schema, can use pgvector, and can’t reach the platform’s schemas', async () => {
    await provisionDatabase(admin, { app, password: 'first-password-123' });
    await admin.query('create schema if not exists storage_test_platform');
    await admin.query('create table if not exists storage_test_platform.secrets (x int)');
    const client = await asApp('first-password-123');
    try {
      await client.query('create table notes (id int primary key, embedding vector(3))');
      await client.query(`insert into notes values (1, '[1,2,3]')`);
      expect((await client.query(`select ${schemaFor(app)}.notes.id from notes`)).rows).toEqual([{ id: 1 }]);
      await expect(client.query('select * from storage_test_platform.secrets')).rejects.toThrow(/permission denied/);
      await expect(client.query('create table public.stray (x int)')).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
      await admin.query('drop schema storage_test_platform cascade');
    }
  });

  it('takes a new password when .env changes, and is otherwise unchanged', async () => {
    await provisionDatabase(admin, { app, password: 'second-password-456' });
    await provisionDatabase(admin, { app, password: 'second-password-456' });
    await expect(asApp('first-password-123')).rejects.toThrow(/password authentication failed/);
    const client = await asApp('second-password-456');
    expect((await client.query('select count(*)::int as n from notes')).rows).toEqual([{ n: 1 }]);
    await client.end();
  });
});

describe.runIf(process.env.DATABASE_URL)('a preview’s scratch database', () => {
  const app = `storage-test-${process.pid}-pr3`;
  let admin: pg.Client;
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
  });
  afterAll(() => admin.end());

  it('goes, login, schema and all, and going twice is fine', async () => {
    await provisionDatabase(admin, { app, password: 'preview-password-789' });
    await admin.query(`create table ${schemaFor(app)}.notes (id int)`);
    await admin.query(`alter table ${schemaFor(app)}.notes owner to ${roleFor(app)}`);
    await dropDatabase(admin, app);
    expect((await admin.query('select 1 from pg_roles where rolname = $1', [roleFor(app)])).rowCount).toBe(0);
    expect((await admin.query('select 1 from information_schema.schemata where schema_name = $1', [schemaFor(app)])).rowCount).toBe(0);
    await dropDatabase(admin, app);
  });
});
