import { describe, expect, it, vi } from 'vitest';
import { signInAgainHere } from './stage.js';

describe('signing in again for an app on the contract', () => {
  it('asks for the password and comes back to the same address', () => {
    const assign = vi.fn();
    signInAgainHere({ pathname: '/@claims/upgrades/augur', search: '?to=0.24.1', assign });
    expect(assign).toHaveBeenCalledWith('/auth/again?return=%2F%40claims%2Fupgrades%2Faugur%3Fto%3D0.24.1');
  });
});
