import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { steadyPool } from './pools.js';

describe('steadyPool', () => {
  it('logs a lost idle connection instead of ending the process', () => {
    const said: string[] = [];
    const pool = steadyPool(new EventEmitter(), (m) => said.push(m));
    // An 'error' with no listener would throw here.
    expect(() => pool.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
    expect(said[0]).toContain('administrator command');
  });
});
