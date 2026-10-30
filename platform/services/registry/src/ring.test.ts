import { describe, expect, it } from 'vitest';
import { defaultMode } from './feature-previews.ts';
import { ringFrom, takesAugurDevBuilds, takesPreview } from './ring.ts';
import { UpdateChecker } from './updates.ts';

describe('server rings', () => {
  it('reads SERVER_RING, production when unset, and refuses anything else', () => {
    expect(ringFrom('dev')).toBe('dev');
    expect(ringFrom('preview')).toBe('preview');
    expect(ringFrom(undefined)).toBe('production');
    expect(ringFrom('')).toBe('production');
    expect(() => ringFrom('staging')).toThrow('SERVER_RING is dev, preview or production, not "staging".');
  });

  it('lets the workbench take everything a preview server does, and AUGUR’s own dev builds', () => {
    expect(takesPreview('dev')).toBe(true);
    expect(takesPreview('preview')).toBe(true);
    expect(takesPreview('production')).toBe(false);
    expect(takesAugurDevBuilds('dev')).toBe(true);
    expect(takesAugurDevBuilds('preview')).toBe(false);
    expect(takesAugurDevBuilds('production')).toBe(false);
  });

  it('follows AUGUR’s dev builds on the workbench, and makes feature previews opt-in there', () => {
    const running = { version: '0.12.0', channel: 'beta' as const };
    expect(new UpdateChecker({ running, ring: 'dev' }).channel).toBe('dev');
    expect(new UpdateChecker({ running, ring: 'production' }).channel).toBe('stable');
    expect(defaultMode('dev')).toBe('opt-in');
    expect(defaultMode('production')).toBe('off');
  });
});
