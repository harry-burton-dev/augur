import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryPreferenceStore, PgPreferenceStore, type PreferenceStore } from './store.ts';

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

describe('MemoryPreferenceStore', () => behavesLikeAStore(() => new MemoryPreferenceStore()));

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
    expect(rows.map((r) => r.id)).toEqual(['001_preferences', '002_workspaces', '003_team_levels', '004_leave_requests']);
  });
});
