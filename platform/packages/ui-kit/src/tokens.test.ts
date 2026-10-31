import { describe, expect, it } from 'vitest';
import { token, tokens } from './generated/tokens.js';

describe('tokens', () => {
  it('carries the fixed accents from tokens.json', () => {
    expect(tokens.green).toBe('#34D399');
    expect(tokens.navy).toBe('#1E40AF');
  });

  it('includes type roles and spacing', () => {
    expect(tokens['type-body']).toBe('1rem');
    expect(tokens['space-5']).toBe('28px');
  });

  it('builds var() references', () => {
    expect(token('ink')).toBe('var(--ink)');
  });
});
