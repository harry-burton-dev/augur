import { defaultFunctions } from '@augur/shell-kit';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_AREA, AGENTS_UNAVAILABLE, alphaFunctions } from './App.js';

describe('the Shell’s functions', () => {
  it('keeps Agents, not built yet, where they would be, under an id that explains rather than opens', () => {
    expect(alphaFunctions.find((f) => f.label === 'Agents')?.id).toBe(AGENTS_UNAVAILABLE);
  });

  it('opens the Account area from Account, with Settings folded into it (ADR 0036)', () => {
    expect(alphaFunctions.map((f) => f.label)).toEqual(defaultFunctions.filter((f) => f.id !== 'settings').map((f) => f.label));
    expect(alphaFunctions.find((f) => f.label === 'Account')?.id).toBe(ACCOUNT_AREA);
  });
});
