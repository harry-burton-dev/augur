import { describe, expect, it } from 'vitest';
import { BoundedMap } from './cache.js';

describe('BoundedMap', () => {
  it('keeps at most max entries, dropping the one used longest ago', () => {
    const map = new BoundedMap<string, number>(2);
    map.set('a', 1).set('b', 2);
    expect(map.get('a')).toBe(1);
    map.set('c', 3);
    expect(map.size).toBe(2);
    expect(map.get('b')).toBeUndefined();
    expect(map.get('a')).toBe(1);
    expect(map.get('c')).toBe(3);
  });
});
