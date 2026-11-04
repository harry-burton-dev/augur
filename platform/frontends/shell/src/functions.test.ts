import { defaultFunctions } from '@augur/shell-kit';
import { describe, expect, it } from 'vitest';
import { AGENTS_UNAVAILABLE, alphaFunctions } from './App.js';

describe('the Shell’s functions', () => {
  it('keeps Agents, not built yet, where they would be, under an id that explains rather than opens', () => {
    expect(alphaFunctions.map((f) => f.label)).toEqual(defaultFunctions.map((f) => f.label));
    expect(alphaFunctions.find((f) => f.label === 'Agents')?.id).toBe(AGENTS_UNAVAILABLE);
  });
});
