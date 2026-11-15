import { EventEmitter } from 'node:events';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { connectTimeoutMs, DatabaseUnavailable, statementTimeoutMs, steadyPool } from './pools.js';

describe('steadyPool', () => {
  it('logs a lost idle connection instead of ending the process', () => {
    const said: string[] = [];
    const pool = steadyPool(new EventEmitter(), (m) => said.push(m));
    // An 'error' with no listener would throw here.
    expect(() => pool.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
    expect(said[0]).toContain('administrator command');
  });

  it('keeps logging after the first lost connection, not just once', () => {
    const said: string[] = [];
    const pool = steadyPool(new EventEmitter(), (m) => said.push(m));
    pool.emit('error', new Error('first'));
    expect(() => pool.emit('error', new Error('second'))).not.toThrow();
    expect(said).toHaveLength(2);
  });

  it('gives each new connection a statement timeout, unless it is 0', () => {
    const asked: string[] = [];
    const client = { query: async (text: string) => void asked.push(text) };
    steadyPool(new EventEmitter(), () => undefined, 30_000).emit('connect', client);
    expect(asked).toEqual(['set statement_timeout = 30000']);
    steadyPool(new EventEmitter(), () => undefined, 0).emit('connect', client);
    expect(asked).toHaveLength(1);
  });

  it('reads DATABASE_STATEMENT_TIMEOUT_SECONDS, a minute when unset or nonsense', () => {
    expect(statementTimeoutMs({ DATABASE_STATEMENT_TIMEOUT_SECONDS: '15' })).toBe(15_000);
    expect(statementTimeoutMs({ DATABASE_STATEMENT_TIMEOUT_SECONDS: '0' })).toBe(0);
    expect(statementTimeoutMs({})).toBe(60_000);
    expect(statementTimeoutMs({ DATABASE_STATEMENT_TIMEOUT_SECONDS: 'soon' })).toBe(60_000);
  });

  it('reads DATABASE_CONNECT_TIMEOUT_SECONDS, ten seconds when unset or nonsense', () => {
    expect(connectTimeoutMs({ DATABASE_CONNECT_TIMEOUT_SECONDS: '3' })).toBe(3_000);
    expect(connectTimeoutMs({ DATABASE_CONNECT_TIMEOUT_SECONDS: '0' })).toBe(0);
    expect(connectTimeoutMs({})).toBe(10_000);
    expect(connectTimeoutMs({ DATABASE_CONNECT_TIMEOUT_SECONDS: '-1' })).toBe(10_000);
  });

  it('bounds how long a caller waits for a connection, keeping a bound the pool was made with', () => {
    const unset = steadyPool(new pg.Pool());
    expect(unset.options.connectionTimeoutMillis).toBe(connectTimeoutMs());
    const own = steadyPool(new pg.Pool({ connectionTimeoutMillis: 1234 }));
    expect(own.options.connectionTimeoutMillis).toBe(1234);
    void unset.end();
    void own.end();
  });
});

describe.runIf(process.env.DATABASE_URL)('steadyPool on Postgres', () => {
  it('answers DatabaseUnavailable, naming the setting, when no connection comes free in time', async () => {
    const pool = steadyPool(new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 300 }));
    const held = await pool.connect();
    try {
      const started = Date.now();
      const viaQuery = await pool.query('select 1').catch((err: unknown) => err);
      const viaConnect = await pool.connect().catch((err: unknown) => err);
      expect(Date.now() - started).toBeLessThan(3_000);
      for (const failed of [viaQuery, viaConnect]) {
        expect(failed).toBeInstanceOf(DatabaseUnavailable);
        expect((failed as Error).message).toMatch(/0\.3s \(DATABASE_CONNECT_TIMEOUT_SECONDS\)/);
      }
    } finally {
      held.release();
    }
    // Once the connection is back, the pool works as before.
    expect((await pool.query('select 1 as one')).rows).toEqual([{ one: 1 }]);
    await pool.end();
  });
});
