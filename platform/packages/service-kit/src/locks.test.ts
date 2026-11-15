import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCK_NAMESPACE } from './locks.js';

it('gives each purpose its own namespace, each a Postgres int', () => {
  const values = Object.values(LOCK_NAMESPACE);
  expect(new Set(values).size).toBe(values.length);
  for (const v of values) expect(Number.isInteger(v) && v > 0 && v < 2 ** 31).toBe(true);
});

describe.runIf(process.env.DATABASE_URL)('advisory lock namespaces on Postgres', () => {
  let pool: pg.Pool;
  beforeAll(() => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  });
  afterAll(() => pool.end());

  it('keeps two purposes with the same key from blocking each other, while one purpose still excludes', async () => {
    const [a, b] = [await pool.connect(), await pool.connect()];
    try {
      await a.query('select pg_advisory_lock($1, 42)', [LOCK_NAMESPACE.migrations]);
      const other = await b.query<{ got: boolean }>('select pg_try_advisory_lock($1, 42) as got', [LOCK_NAMESPACE.auditOutbox]);
      expect(other.rows[0]!.got).toBe(true);
      const same = await b.query<{ got: boolean }>('select pg_try_advisory_lock($1, 42) as got', [LOCK_NAMESPACE.migrations]);
      expect(same.rows[0]!.got).toBe(false);
    } finally {
      await a.query('select pg_advisory_unlock_all()');
      await b.query('select pg_advisory_unlock_all()');
      a.release();
      b.release();
    }
  });
});
