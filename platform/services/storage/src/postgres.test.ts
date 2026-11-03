import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dropDatabase, jobsSchemaFor, prepareDatabase, provisionDatabase, provisionKeycloakDatabase, provisionServiceDatabase, roleFor, schemaFor, serviceRoleFor } from './postgres.ts';

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
    await admin.query(`drop schema if exists ${jobsSchemaFor(app)} cascade`);
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

  it('owns a schema for its jobs too', async () => {
    await provisionDatabase(admin, { app, password: 'jobs-password-456' });
    const client = await asApp('jobs-password-456');
    try {
      await client.query(`create table ${jobsSchemaFor(app)}.workflow_status (id text)`);
      expect((await client.query(`select count(*)::int as n from ${jobsSchemaFor(app)}.workflow_status`)).rows).toEqual([{ n: 0 }]);
    } finally {
      await client.end();
    }
  });

  it('owns its schema, can use pgvector and pg_trgm, and can’t reach the platform’s schemas', async () => {
    await provisionDatabase(admin, { app, password: 'first-password-123' });
    await admin.query('create schema if not exists storage_test_platform');
    await admin.query('create table if not exists storage_test_platform.secrets (x int)');
    const client = await asApp('first-password-123');
    try {
      await client.query('create table notes (id int primary key, embedding vector(3))');
      await client.query(`insert into notes values (1, '[1,2,3]')`);
      expect((await client.query(`select ${schemaFor(app)}.notes.id from notes`)).rows).toEqual([{ id: 1 }]);
      expect((await client.query(`select similarity('Northern Tern', 'N. Tern') > 0.3 as near`)).rows).toEqual([{ near: true }]);
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
    expect((await admin.query('select 1 from information_schema.schemata where schema_name = $1', [jobsSchemaFor(app)])).rowCount).toBe(0);
    await dropDatabase(admin, app);
  });
});

describe.runIf(process.env.DATABASE_URL)('a platform service’s database login', () => {
  const service = `svctest${process.pid}`;
  const other = `svcother${process.pid}`;
  let admin: pg.Client;
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
  });
  afterAll(async () => {
    for (const name of [service, other]) {
      await admin.query(`drop schema if exists ${name} cascade`);
      await admin.query(`drop owned by ${serviceRoleFor(name)}`).catch(() => {});
      await admin.query(`drop role if exists ${serviceRoleFor(name)}`);
    }
    await admin.end();
  });

  const as = async (name: string, password: string, database?: string) => {
    const url = new URL(process.env.DATABASE_URL!);
    url.username = serviceRoleFor(name);
    url.password = password;
    if (database) url.pathname = `/${database}`;
    const client = new pg.Client({ connectionString: url.toString() });
    await client.connect();
    return client;
  };

  it('takes over what the service made as the admin login, and can’t reach another service’s schema', async () => {
    // As it was: the service ran as the admin login and made its schema and tables itself.
    await admin.query(`create schema ${service}`);
    await admin.query(`create table ${service}.audit (id bigint generated always as identity primary key, what text)`);
    await admin.query(`create table ${service}.notes (id serial primary key)`);
    await admin.query(`create sequence ${service}.counter`);
    await admin.query(`create view ${service}.recent as select * from ${service}.audit`);
    await admin.query(`create type ${service}.level as enum ('low', 'high')`);
    await admin.query(`create function ${service}.twice(x int) returns int language sql as 'select x * 2'`);
    await provisionServiceDatabase(admin, { service: other, password: 'other-password-123' });
    await admin.query(`create table ${other}.secrets (x int)`);

    const handed = await provisionServiceDatabase(admin, { service, password: 'service-password-123' });
    expect(handed).toBe(6);
    expect(await provisionServiceDatabase(admin, { service, password: 'service-password-123' })).toBe(0);

    const client = await as(service, 'service-password-123');
    try {
      await client.query(`insert into audit (what) values ('x')`);
      await client.query('insert into notes default values');
      await client.query(`select nextval('counter'), twice(2), 'low'::level`);
      await client.query('alter table audit add column at timestamptz');
      expect((await client.query('select count(*)::int as n from recent')).rows).toEqual([{ n: 1 }]);
      await expect(client.query(`select * from ${other}.secrets`)).rejects.toThrow(/permission denied/);
      await expect(client.query(`create schema ${service}_more`)).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });
});

describe.runIf(process.env.DATABASE_URL)('Keycloak’s database login', () => {
  const database = `kctest${process.pid}`;
  const role = `kcrole${process.pid}`;
  let admin: pg.Client;
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    await admin.query(`create database ${database}`);
  });
  afterAll(async () => {
    await admin.query(`drop database if exists ${database} with (force)`);
    await admin.query(`drop role if exists ${role}`);
    await admin.end();
  });

  it('owns its database and what Keycloak made in it as the admin login', async () => {
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${database}`;
    const inside = new pg.Client({ connectionString: url.toString() });
    await inside.connect();
    try {
      await inside.query('create table realm (id text primary key)');
      expect(await provisionKeycloakDatabase(inside, { role, password: 'keycloak-password-123' })).toBe(1);
      const owner = await inside.query(`select pg_get_userbyid(datdba) as owner from pg_database where datname = $1`, [database]);
      expect(owner.rows).toEqual([{ owner: role }]);
      expect((await inside.query(`select tableowner from pg_tables where tablename = 'realm'`)).rows).toEqual([{ tableowner: role }]);
    } finally {
      await inside.end();
    }
  });
});
