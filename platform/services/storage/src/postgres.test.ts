import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseFor, dropDatabase, inSharedDatabase, jobsSchemaFor, prepareDatabase, provisionDatabase, provisionKeycloakDatabase, provisionServiceDatabase, roleFor, schemaFor, serviceRoleFor, type OpenDatabase } from './postgres.ts';

describe('an app’s schema', () => {
  it('is never one named for a part of AUGUR, made or dropped', async () => {
    const said: string[] = [];
    const sql = { query: async (text: string) => (said.push(text), { rows: [], rowCount: 0 }) } as unknown as Parameters<typeof provisionDatabase>[0];
    await expect(provisionDatabase(sql, { app: 'registry', password: 'p'.repeat(20), open: () => Promise.reject(new Error('not opened')) })).rejects.toThrow('No schema was made for it: "registry" is kept for the registry');
    await expect(dropDatabase(sql, 'public')).rejects.toThrow('Nothing was dropped');
    expect(said).toEqual([]);
  });
});

/** Another database on the test's server, as its admin login. */
const urlOf = (database: string, user?: string, password?: string) => {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  if (user) url.username = user;
  if (password !== undefined) url.password = password;
  return url.toString();
};
const open: OpenDatabase = async (database) => {
  const client = new pg.Client({ connectionString: urlOf(database) });
  await client.connect();
  return client;
};

// Runs wherever DATABASE_URL points at a Postgres with pgvector; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('an app’s database login', () => {
  const app = `storage-test-${process.pid}`;
  const other = `storage-other-${process.pid}`;
  let admin: pg.Client;
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    await prepareDatabase(admin);
  });
  afterAll(async () => {
    await dropDatabase(admin, app);
    await dropDatabase(admin, other);
    await admin.end();
  });

  const asApp = async (password: string, database = databaseFor(app), user = roleFor(app)) => {
    const client = new pg.Client({ connectionString: urlOf(database, user, password) });
    await client.connect();
    return client;
  };

  it('owns a database of its own, with a schema for its jobs too', async () => {
    await provisionDatabase(admin, { app, password: 'jobs-password-456', open });
    expect((await admin.query('select pg_get_userbyid(datdba) as owner from pg_database where datname = $1', [databaseFor(app)])).rows).toEqual([{ owner: roleFor(app) }]);
    const client = await asApp('jobs-password-456');
    try {
      await client.query(`create table ${jobsSchemaFor(app)}.workflow_status (id text)`);
      expect((await client.query(`select count(*)::int as n from ${jobsSchemaFor(app)}.workflow_status`)).rows).toEqual([{ n: 0 }]);
    } finally {
      await client.end();
    }
  });

  it('owns its schema there, can use pgvector and pg_trgm, and can’t create in public', async () => {
    await provisionDatabase(admin, { app, password: 'first-password-123', open });
    const client = await asApp('first-password-123');
    try {
      await client.query('create table notes (id int primary key, embedding vector(3))');
      await client.query(`insert into notes values (1, '[1,2,3]')`);
      expect((await client.query(`select ${schemaFor(app)}.notes.id from notes`)).rows).toEqual([{ id: 1 }]);
      expect((await client.query(`select similarity('Northern Tern', 'N. Tern') > 0.3 as near`)).rows).toEqual([{ near: true }]);
      await expect(client.query('create table public.stray (x int)')).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });

  // The exit check of P1 (PER-456): AUGUR's database is out of reach, so are its migrations' advisory locks, and so is another app's.
  it('can’t connect to AUGUR’s database or another app’s, and no one else can connect to its own', async () => {
    const platform = new URL(process.env.DATABASE_URL!).pathname.slice(1);
    // What a release before granted it, or grants it again when gone back to, is taken away.
    await admin.query(`grant connect on database ${platform} to ${roleFor(app)}`);
    await provisionDatabase(admin, { app, password: 'first-password-123', open });
    await provisionDatabase(admin, { app: other, password: 'other-password-123', open });
    await expect(asApp('first-password-123', platform)).rejects.toThrow(/permission denied for database/);
    await expect(asApp('first-password-123', databaseFor(other))).rejects.toThrow(/permission denied for database/);
    await expect(asApp('other-password-123', databaseFor(app), roleFor(other))).rejects.toThrow(/permission denied for database/);
  });

  it('holds at most its share of connections, so it can’t take AUGUR’s (ADR 0073)', async () => {
    await provisionDatabase(admin, { app, password: 'first-password-123', connections: 7, open });
    expect((await admin.query('select rolconnlimit from pg_roles where rolname = $1', [roleFor(app)])).rows).toEqual([{ rolconnlimit: 7 }]);
  });

  it('takes a new password when .env changes, and is otherwise unchanged', async () => {
    await provisionDatabase(admin, { app, password: 'second-password-456', open });
    await provisionDatabase(admin, { app, password: 'second-password-456', open });
    await expect(asApp('first-password-123')).rejects.toThrow(/password authentication failed/);
    const client = await asApp('second-password-456');
    expect((await client.query('select count(*)::int as n from notes')).rows).toEqual([{ n: 1 }]);
    await client.end();
  });

  it('tells an app installed before apps had databases of their own from an empty schema a release before made', async () => {
    const old = `storage-old-${process.pid}`;
    await admin.query(`create schema ${schemaFor(old)}`);
    try {
      expect(await inSharedDatabase(admin, old)).toBe(true);
      expect(await inSharedDatabase(admin, `${old}-none`)).toBe(false);
      // Gone back to a release before, which makes the schema again for an app that has its own database.
      await admin.query(`drop schema ${schemaFor(old)}`);
      await provisionDatabase(admin, { app: old, password: 'old-password-1234', open });
      await admin.query(`create schema ${schemaFor(old)}`);
      expect(await inSharedDatabase(admin, old)).toBe(false);
    } finally {
      await dropDatabase(admin, old);
    }
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

  it('goes, login, database and all, even while it is connected, and going twice is fine', async () => {
    await provisionDatabase(admin, { app, password: 'preview-password-789', open });
    const own = await open(databaseFor(app));
    // Dropping it cuts this connection, which says so as an error.
    (own as pg.Client).on('error', () => {});
    await own.query(`create table ${schemaFor(app)}.notes (id int)`);
    await own.query(`alter table ${schemaFor(app)}.notes owner to ${roleFor(app)}`);
    await dropDatabase(admin, app);
    await own.end().catch(() => {});
    expect((await admin.query('select 1 from pg_roles where rolname = $1', [roleFor(app)])).rowCount).toBe(0);
    expect((await admin.query('select 1 from pg_database where datname = $1', [databaseFor(app)])).rowCount).toBe(0);
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
      await admin.query(`drop schema if exists ${jobsSchemaFor(name)} cascade`);
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
      // Its jobs schema is its own too.
      await client.query(`create table ${jobsSchemaFor(service)}.runs (id int)`);
    } finally {
      await client.end();
    }
  });

  it('may use the connections Postgres keeps back, which an app’s login may not (reserved_connections)', async () => {
    await provisionServiceDatabase(admin, { service, password: 'service-password-123' });
    const may = async (role: string) => (await admin.query(`select pg_has_role($1, 'pg_use_reserved_connections', 'usage') as may`, [role])).rows[0].may;
    expect(await may(serviceRoleFor(service))).toBe(true);
    const app = `resvapp${process.pid}`;
    try {
      await provisionDatabase(admin, { app, password: 'app-password-1234', open });
      expect(await may(roleFor(app))).toBe(false);
    } finally {
      await dropDatabase(admin, app);
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
      expect((await inside.query(`select pg_has_role($1, 'pg_use_reserved_connections', 'usage') as may`, [role])).rows).toEqual([{ may: true }]);
    } finally {
      await inside.end();
    }
  });
});
