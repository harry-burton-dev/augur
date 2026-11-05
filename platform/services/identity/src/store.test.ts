import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PgOrganisationStore } from './organisation.ts';
import { PgSignInCursorStore } from './sign-ins.ts';
import { PgLifecycleStore } from './lifecycle.ts';
import { PgPreferenceStore, type PreferenceStore } from './store.ts';

/** The same behaviour from every store. */
const behavesLikeAStore = (make: () => PreferenceStore, reset: () => Promise<void> = async () => {}) => {
  let store: PreferenceStore;
  beforeEach(async () => {
    await reset();
    store = make();
  });

  it('keeps and replaces one person’s preferences', async () => {
    expect(await store.get('u-1')).toEqual({});
    await store.put('u-1', { density: 'compact', recent: ['board'] });
    await store.put('u-1', { reduceMotion: true });
    expect(await store.get('u-1')).toEqual({ reduceMotion: true });
    expect(await store.get('u-2')).toEqual({});
  });
};

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('PgPreferenceStore', () => {
  let store: PgPreferenceStore;
  let admin: pg.Pool;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query('drop schema if exists identity cascade');
    store = await PgPreferenceStore.connect(process.env.DATABASE_URL!);
  });
  afterAll(async () => {
    await store.close();
    await admin.end();
  });

  behavesLikeAStore(
    () => store,
    async () => void (await admin.query('truncate identity.preferences')),
  );

  it('migrates once, however often it starts', async () => {
    await Promise.all([store.migrate(), store.migrate()]);
    const { rows } = await admin.query('select id from identity.migrations');
    expect(rows.map((r) => r.id)).toEqual(['001_preferences', '002_workspaces', '003_team_levels', '004_leave_requests', 'organisation_001_settings', 'signins_001_cursor', 'lifecycle_001_people', 'lifecycle_002_invites']);
  });

  it('keeps the organisation settings in one row', async () => {
    const org = new PgOrganisationStore(admin);
    expect(await org.get()).toEqual({});
    await org.put({ timeZone: 'Europe/London', senderName: 'Acme', updatedAt: '2026-11-05T01:00:00.000Z', updatedBy: 'u-1' });
    await org.put({ timeZone: 'Europe/Paris', senderName: 'Acme', senderAddress: 'no-reply@acme.example', updatedAt: '2026-11-05T02:00:00.000Z', updatedBy: 'u-2' });
    expect(await org.get()).toEqual({ timeZone: 'Europe/Paris', senderName: 'Acme', senderAddress: 'no-reply@acme.example', updatedAt: '2026-11-05T02:00:00.000Z', updatedBy: 'u-2' });
    expect((await admin.query('select count(*)::int as n from identity.organisation')).rows[0].n).toBe(1);
  });

  it('keeps where sign-in copying has got to, and lets one identity copy at a time', async () => {
    const cursor = new PgSignInCursorStore(admin);
    expect(await cursor.load()).toBeUndefined();
    await cursor.save({ time: 1_700_000_000_000, seen: ['a'] });
    await cursor.save({ time: 1_700_000_000_500, seen: ['b', 'c'] });
    expect(await cursor.load()).toEqual({ time: 1_700_000_000_500, seen: ['b', 'c'] });
    let inner: boolean | undefined;
    const outer = await cursor.alone(async () => {
      inner = await cursor.alone(async () => {});
    });
    expect(outer).toBe(true);
    expect(inner).toBe(false);
    expect(await cursor.alone(async () => {})).toBe(true);
  });

  it('keeps each account’s life: first and last sign-in, why it went off, that they left', async () => {
    const lc = new PgLifecycleStore(admin);
    await lc.signedIn('p-1', '2026-11-05T09:00:00.000Z');
    await lc.signedIn('p-1', '2026-11-04T09:00:00.000Z');
    await lc.signedIn('p-1', '2026-11-06T09:00:00.000Z');
    await lc.disabled('p-1', 'admin', '2026-11-06T10:00:00.000Z');
    await lc.enabled('p-1');
    await lc.disabled('p-2', 'leaver', '2026-11-06T10:00:00.000Z');
    await lc.left('p-2', { at: '2026-11-06T10:00:01.000Z', by: 'a-1', handOverTo: 'p-1' });
    await lc.invited('p-3', 'email', { at: '2026-11-06T10:00:00.000Z', expiresAt: '2026-11-09T10:00:00.000Z' });
    await lc.invited('p-3', 'email');
    await lc.invited('p-3', 'email', { at: '2026-11-07T10:00:00.000Z', expiresAt: '2026-11-10T10:00:00.000Z' });
    expect((await lc.get(['p-3'])).get('p-3')).toEqual({ invite: { method: 'email', count: 2, sentAt: '2026-11-07T10:00:00.000Z', expiresAt: '2026-11-10T10:00:00.000Z' } });
    expect(await lc.get(['p-1'])).toEqual(new Map([['p-1', { joinedAt: '2026-11-05T09:00:00.000Z', lastSignInAt: '2026-11-06T09:00:00.000Z' }]]));
    expect((await lc.get()).get('p-2')).toEqual({ disabledAt: '2026-11-06T10:00:00.000Z', disabledCause: 'leaver', left: { at: '2026-11-06T10:00:01.000Z', by: 'a-1', handOverTo: 'p-1' } });
  });
});
