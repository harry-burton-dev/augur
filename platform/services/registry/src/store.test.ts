import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryAppStore, PgAppStore, RouteTakenError, type AppStore } from './store.ts';

const library = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.1.0', sdk: '^1.0.0' };

/** The same behaviour from every store. */
const behavesLikeAStore = (make: () => AppStore, reset: () => Promise<void> = async () => {}) => {
  let store: AppStore;
  beforeEach(async () => {
    await reset();
    store = make();
  });

  it('adds, replaces and lists apps', async () => {
    expect(await store.put(library, 'service')).toBe(true);
    expect(await store.put({ ...library, version: '0.2.0' }, 'service')).toBe(false);
    expect(await store.list()).toEqual([{ ...library, version: '0.2.0' }]);
  });

  it('turns apps off and on, and keeps them off when they register again', async () => {
    await store.put(library, 'service');
    expect(await store.setEnabled('library', false)).toBe(true);
    await store.put({ ...library, version: '0.2.0' }, 'library');
    const [record] = await store.records();
    expect(record).toMatchObject({ entry: { version: '0.2.0' }, enabled: false, registeredBy: 'library' });
    expect(Date.parse(record.registeredAt)).not.toBeNaN();
    expect(await store.setEnabled('library', true)).toBe(true);
    expect((await store.records())[0].enabled).toBe(true);
    expect(await store.setEnabled('nothing', false)).toBe(false);
  });

  it('removes apps', async () => {
    await store.put(library, 'service');
    expect(await store.remove('library')).toBe(true);
    expect(await store.remove('library')).toBe(false);
    expect(await store.list()).toEqual([]);
  });
};

describe('MemoryAppStore', () => behavesLikeAStore(() => new MemoryAppStore()));

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('PgAppStore', () => {
  let store: PgAppStore;
  let admin: pg.Pool;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query('drop schema if exists registry cascade');
    store = await PgAppStore.connect(process.env.DATABASE_URL!);
  });
  afterAll(async () => {
    await store.close();
    await admin.end();
  });

  behavesLikeAStore(
    () => store,
    async () => {
      await admin.query('truncate registry.apps');
    },
  );

  it('migrates once, however often it starts', async () => {
    await Promise.all([store.migrate(), store.migrate()]);
    const { rows } = await admin.query('select id from registry.migrations');
    expect(rows.map((r) => r.id).sort()).toEqual(['001_apps', '002_enabled']);
  });

  it('lets the database refuse a second app on a taken route, so racing registrations cannot both win', async () => {
    await admin.query('truncate registry.apps');
    await store.put(library, 'service');
    await expect(store.put({ ...library, id: 'papers' }, 'service')).rejects.toBeInstanceOf(RouteTakenError);
  });

  it('records who registered an app', async () => {
    await admin.query('truncate registry.apps');
    await store.put(library, 'u-1');
    const { rows } = await admin.query('select registered_by from registry.apps');
    expect(rows).toEqual([{ registered_by: 'u-1' }]);
  });
});
