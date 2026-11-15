import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jobsSchemaFor, roleFor, schemaFor } from './postgres.ts';
import { dropDue, laterRelease, retiredBucketFor, retiredRoleFor, retiredSchemaFor, setAside, type Buckets } from './retirement.ts';

describe('laterRelease', () => {
  it('counts only a later AUGUR release, never a beta or dev build of the same one, or a name it can’t read', () => {
    expect(laterRelease('0.26.0', '0.25.1')).toBe(true);
    expect(laterRelease('1.0.0-beta.1', '0.26.3')).toBe(true);
    expect(laterRelease('0.25.1', '0.25.1')).toBe(false);
    expect(laterRelease('0.25.1-beta.2', '0.25.1-beta.1')).toBe(false);
    expect(laterRelease('0.25.0', '0.25.1')).toBe(false);
    expect(laterRelease('latest', '0.25.1')).toBe(false);
    expect(laterRelease('0.26.0', null)).toBe(false);
  });

  it('names what is set aside so no app’s own can be: retired-… is kept from apps’ ids', () => {
    expect(retiredSchemaFor('team-notes')).toBe('retired_team_notes');
    expect(retiredRoleFor('team-notes')).toBe('retired_app_team_notes');
    expect(retiredBucketFor('team-notes')).toBe('retired-team-notes');
  });
});

const fakeBuckets = () => {
  const did: string[] = [];
  const buckets: Buckets = {
    setAside: async (app) => (did.push(`set aside ${app}`), true),
    drop: async (app) => (did.push(`drop ${app}`), true),
  };
  return { did, buckets };
};

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('a retired or removed app’s data (ADR 0103)', () => {
  const app = `gone-${process.pid}`;
  let admin: pg.Client;
  const exists = async (kind: 'schema' | 'role', name: string) =>
    (await admin.query(kind === 'schema' ? 'select 1 from pg_namespace where nspname = $1' : 'select 1 from pg_roles where rolname = $1', [name])).rowCount === 1;
  const row = async () => (await admin.query('select outcome, renamed_in from public.storage_retired_apps where app = $1', [app])).rows[0];
  const make = async () => {
    await admin.query(`create role ${roleFor(app)} login password 'app-password-123'`);
    await admin.query(`create schema ${schemaFor(app)} authorization ${roleFor(app)}`);
    await admin.query(`create schema ${jobsSchemaFor(app)} authorization ${roleFor(app)}`);
    await admin.query(`create table ${schemaFor(app)}.notes (text text)`);
    await admin.query(`insert into ${schemaFor(app)}.notes values ('kept')`);
  };
  const good = (at: string) => ({ at, ok: true, file: 'platform-x.sql.gz', objects: 'objects-x.tar.gz' });
  const log = { info: (_: string) => {}, warn: (_: string) => {} };

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
  });
  afterAll(async () => {
    for (const s of [schemaFor(app), jobsSchemaFor(app), retiredSchemaFor(app), `${retiredSchemaFor(app)}_jobs`]) await admin.query(`drop schema if exists ${s} cascade`);
    for (const r of [roleFor(app), retiredRoleFor(app)]) await admin.query(`drop role if exists ${r}`);
    await admin.query('delete from public.storage_retired_apps where app = $1', [app]).catch(() => {});
    await admin.end();
  });

  it('is set aside first: renamed, its login unable to sign in, its bucket under another name, and noted with the release', async () => {
    await make();
    const { did, buckets } = fakeBuckets();
    await setAside({ sql: admin, buckets, app, release: '0.26.0' });
    expect(await exists('schema', schemaFor(app))).toBe(false);
    expect(await exists('schema', jobsSchemaFor(app))).toBe(false);
    expect((await admin.query(`select text from ${retiredSchemaFor(app)}.notes`)).rows).toEqual([{ text: 'kept' }]);
    expect(await exists('schema', `${retiredSchemaFor(app)}_jobs`)).toBe(true);
    expect(await exists('role', roleFor(app))).toBe(false);
    expect((await admin.query('select rolcanlogin from pg_roles where rolname = $1', [retiredRoleFor(app)])).rows).toEqual([{ rolcanlogin: false }]);
    expect(did).toEqual([`set aside ${app}`]);
    expect(await row()).toEqual({ outcome: 'renamed', renamed_in: '0.26.0' });
  });

  it('isn’t set aside again while an earlier copy of the same id waits to be dropped', async () => {
    await make();
    const { buckets } = fakeBuckets();
    await expect(setAside({ sql: admin, buckets, app, release: '0.26.0', again: true })).rejects.toThrow(/earlier copy .* waits/);
    expect(await exists('schema', schemaFor(app))).toBe(true);
    await admin.query(`drop schema ${schemaFor(app)} cascade; drop schema ${jobsSchemaFor(app)} cascade; drop role ${roleFor(app)}`);
  });

  it('stays through the release that set it aside, and without a good backup taken since, saying why', async () => {
    const { did, buckets } = fakeBuckets();
    const said: string[] = [];
    const warn = { ...log, warn: (m: string) => said.push(m) };
    await dropDue({ sql: admin, buckets, release: '0.26.0', marker: good('2099-01-01T00:00:00Z'), objects: true, log: warn });
    expect(await exists('schema', retiredSchemaFor(app))).toBe(true);
    await dropDue({ sql: admin, buckets, release: '0.27.0', marker: good('2000-01-01T00:00:00Z'), objects: true, log: warn });
    await dropDue({ sql: admin, buckets, release: '0.27.0', marker: { ...good('2099-01-01T00:00:00Z'), objects: undefined }, objects: true, log: warn });
    await dropDue({ sql: admin, buckets, release: '0.27.0', marker: undefined, objects: true, log: warn });
    expect(await exists('schema', retiredSchemaFor(app))).toBe(true);
    expect(did).toEqual([]);
    expect(said.filter((m) => m.startsWith(app))).toEqual([
      expect.stringMatching(/before .* set aside/),
      expect.stringMatching(/no copy of apps’ files/),
      expect.stringMatching(/No backup has been noted/),
    ]);
    expect((await row()).outcome).toBe('renamed');
  });

  it('is dropped on a later release behind a good backup taken since it was set aside, and noted as gone', async () => {
    const { did, buckets } = fakeBuckets();
    await dropDue({ sql: admin, buckets, release: '0.27.0', marker: good('2099-01-01T00:00:00Z'), objects: true, log });
    expect(await exists('schema', retiredSchemaFor(app))).toBe(false);
    expect(await exists('schema', `${retiredSchemaFor(app)}_jobs`)).toBe(false);
    expect(await exists('role', retiredRoleFor(app))).toBe(false);
    expect(did).toEqual([`drop ${app}`]);
    expect((await row()).outcome).toBe('removed');
  });
});
