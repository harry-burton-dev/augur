import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { realmSenderFromDb } from './realm-sender.ts';

describe('the organisation’s sender, for the realm job', () => {
  it('says nothing, and warns, when the database can’t be read', async () => {
    const warnings: string[] = [];
    expect(await realmSenderFromDb('postgres://nobody@127.0.0.1:1/none', (m) => warnings.push(m))).toBeUndefined();
    expect(warnings[0]).toContain('SMTP_FROM');
  });
});

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('the organisation’s sender, read from Postgres', () => {
  let admin: pg.Pool;
  const url = process.env.DATABASE_URL!;
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: url });
    await admin.query('create schema if not exists realm_sender_test');
  });
  afterAll(async () => {
    await admin.query('drop schema if exists realm_sender_test cascade');
    await admin.end();
  });

  it('reads the sender an admin set, else the organisation’s name, and nothing before identity has made its tables', async () => {
    // A schema of its own stands in for identity's, so the store tests' tables are left alone.
    const q = (sql: string) => admin.query(sql.replaceAll('identity.', 'realm_sender_test.'));
    const read = () => realmSenderFromDb(url, undefined, 'realm_sender_test');
    expect(await read()).toBeUndefined();
    await q("create table identity.workspaces (id text primary key, kind text, name text); insert into identity.workspaces values ('w-1', 'org', 'Finance Group')");
    expect(await read()).toEqual({ name: 'Finance Group' });
    await q('create table identity.organisation (only_row boolean primary key default true, sender_name text, sender_address text)');
    await q("insert into identity.organisation (sender_name, sender_address) values ('Finance notices', 'notices@finance.example')");
    expect(await read()).toEqual({ name: 'Finance notices', address: 'notices@finance.example' });
  });
});
