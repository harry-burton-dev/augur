import { describe, expect, it } from 'vitest';
import { channelChoices } from './installs.js';

describe('which releases an app follows', () => {
  it('offers preview releases on a preview server, and shows why not on a production one', () => {
    expect(channelChoices('preview').map((c) => [c.value, c.disabled ?? false])).toEqual([['stable', false], ['beta', false]]);
    const production = channelChoices('production');
    expect(production.find((c) => c.value === 'beta')).toMatchObject({ disabled: true, detail: 'Not on a production server' });
    expect(production.find((c) => c.value === 'stable')?.label).toBe('Production releases');
  });
});
