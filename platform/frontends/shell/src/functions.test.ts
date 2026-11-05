import { defaultFunctions } from '@augur/shell-kit';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_AREA, AGENTS_WHY, alphaFunctions } from './App.js';

describe('the Shell’s functions', () => {
  it('keeps Agents, not built yet, where they would be, unavailable and saying why', () => {
    expect(alphaFunctions.find((f) => f.label === 'Agents')?.id).toBe('agents');
    expect(alphaFunctions.find((f) => f.id === 'agents')?.unavailable).toBe(AGENTS_WHY);
    expect(alphaFunctions.filter((f) => f.unavailable)).toHaveLength(1);
  });

  it('opens the Account area from Account, with Settings folded into it (ADR 0036)', () => {
    expect(alphaFunctions.map((f) => f.label)).toEqual(defaultFunctions.filter((f) => f.id !== 'settings').map((f) => f.label));
    expect(alphaFunctions.find((f) => f.label === 'Account')?.id).toBe(ACCOUNT_AREA);
  });
});
