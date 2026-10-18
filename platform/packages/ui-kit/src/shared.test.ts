import { afterEach, describe, expect, it } from 'vitest';
import { reducedMotion } from './shared.js';

describe('reducedMotion', () => {
  afterEach(() => delete document.documentElement.dataset.motion);

  it('holds still when the page asks, as well as when the system does', () => {
    expect(reducedMotion()).toBe(false);
    document.documentElement.dataset.motion = 'reduce';
    expect(reducedMotion()).toBe(true);
  });
});
