import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { realmIdleFromDb, realmOrganisationFromDb, realmSenderFromDb } from './realm-sender.ts';

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

  it('reads the idle-account days, with the defaults for what isn’t set or before identity has them', async () => {
    const q = (sql: string) => admin.query(sql.replaceAll('identity.', 'realm_sender_test.'));
    const defaults = { on: true, warningDays: 60, turnOffDays: 90 };
    const read = () => realmIdleFromDb(url, defaults, undefined, 'realm_sender_test');
    await q('drop table if exists identity.organisation');
    expect(await read()).toEqual(defaults);
    await q('create table identity.organisation (only_row boolean primary key default true, sender_name text)');
    expect(await read()).toEqual(defaults);
    await q('alter table identity.organisation add column idle_on boolean, add column idle_warning_days int, add column idle_turn_off_days int');
    await q('insert into identity.organisation (idle_turn_off_days) values (120)');
    expect(await read()).toEqual({ on: true, warningDays: 60, turnOffDays: 120 });
    await q('update identity.organisation set idle_on = false');
    expect((await read())?.on).toBe(false);
  });

  it('reads the notice, languages and two steps for everyone, with the defaults before identity has them', async () => {
    const q = (sql: string) => admin.query(sql.replaceAll('identity.', 'realm_sender_test.'));
    const read = () => realmOrganisationFromDb(url, undefined, 'realm_sender_test');
    await q('drop table if exists identity.organisation');
    expect(await read()).toEqual({ name: 'Finance Group', notice: { on: false }, twoStepForAll: false });
    await q('create table identity.organisation (only_row boolean primary key default true, sender_name text)');
    expect(await read()).toEqual({ name: 'Finance Group', notice: { on: false }, twoStepForAll: false });
    await q('alter table identity.organisation add column notice_on boolean, add column notice_title text, add column notice_text text, add column languages text[], add column default_language text, add column two_step_for_all boolean');
    await q("insert into identity.organisation (notice_on, notice_title, notice_text, languages, default_language, two_step_for_all) values (true, 'T', 'X', '{en,fr,de}', 'fr', true)");
    expect(await read()).toEqual({ name: 'Finance Group', notice: { on: true, title: 'T', text: 'X' }, languages: ['fr', 'en', 'de'], twoStepForAll: true });
    // On without words is off: Keycloak would show an empty page.
    await q("update identity.organisation set notice_text = null");
    expect((await read())?.notice.on).toBe(false);
  });
});
