import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PgModelStore, type ModelStore } from './store.ts';

/** The same behaviour from every store. */
const behavesLikeAStore = (make: () => ModelStore, reset: () => Promise<void> = async () => {}) => {
  let store: ModelStore;
  beforeEach(async () => {
    await reset();
    store = make();
  });

  it('starts off, and keeps what an admin set', async () => {
    expect(await store.settings()).toEqual({ enabled: false, dailyLimit: 500 });
    await store.saveSettings({ enabled: true, dailyLimit: 20 }, 'u-1');
    expect(await store.settings()).toMatchObject({ enabled: true, dailyLimit: 20, updatedBy: 'u-1', updatedAt: expect.any(String) });
  });

  it('counts each app’s calls a day up to the limit', async () => {
    expect(await store.take('library', '2026-10-23', 2)).toBe(true);
    expect(await store.take('library', '2026-10-23', 2)).toBe(true);
    expect(await store.take('library', '2026-10-23', 2)).toBe(false);
    expect(await store.take('assistant', '2026-10-23', 2)).toBe(true);
    expect(await store.take('library', '2026-10-24', 2)).toBe(true);
    expect(await store.take('other', '2026-10-24', 0)).toBe(false);
    await store.addTokens('library', '2026-10-23', 120, 30);
    await store.addTokens('library', '2026-10-23', 10, 5);
    expect(await store.usage('2026-10-23')).toEqual([
      { day: '2026-10-24', app: 'library', calls: 1, inputTokens: 0, outputTokens: 0 },
      { day: '2026-10-23', app: 'assistant', calls: 1, inputTokens: 0, outputTokens: 0 },
      { day: '2026-10-23', app: 'library', calls: 2, inputTokens: 130, outputTokens: 35 },
    ]);
    expect((await store.usage('2026-10-24')).map((u) => u.day)).toEqual(['2026-10-24']);
  });
};

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('PgModelStore', () => {
  let store: PgModelStore;
  let admin: pg.Pool;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query('drop schema if exists models cascade');
    store = await PgModelStore.connect(process.env.DATABASE_URL!);
  });
  afterAll(async () => {
    await store.close();
    await admin.end();
  });

  behavesLikeAStore(
    () => store,
    async () => {
      await admin.query('truncate models.settings, models.usage');
    },
  );

  it('answers its readiness check while the database does', async () => {
    await expect(store.ping()).resolves.toBeUndefined();
    const gone = await PgModelStore.connect(process.env.DATABASE_URL!);
    await gone.close();
    await expect(gone.ping()).rejects.toThrow();
  });

  it('never lets two calls at once take the last one', async () => {
    await admin.query('truncate models.usage');
    const taken = await Promise.all(Array.from({ length: 10 }, () => store.take('library', '2026-10-25', 3)));
    expect(taken.filter(Boolean)).toHaveLength(3);
  });
});
