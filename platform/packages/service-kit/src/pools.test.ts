import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { statementTimeoutMs, steadyPool } from './pools.js';

describe('steadyPool', () => {
  it('logs a lost idle connection instead of ending the process', () => {
    const said: string[] = [];
    const pool = steadyPool(new EventEmitter(), (m) => said.push(m));
    // An 'error' with no listener would throw here.
    expect(() => pool.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
    expect(said[0]).toContain('administrator command');
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
});
