import { describe, expect, it } from 'vitest';
import { channelChoices, featureHint, featureModeChoices } from './installs.js';

describe('which releases an app follows', () => {
  it('offers preview releases on a preview server, and shows why not on a production one', () => {
    expect(channelChoices('preview').map((c) => [c.value, c.disabled ?? false])).toEqual([['stable', false], ['beta', false], ['dev', false]]);
    const production = channelChoices('production');
    expect(production.find((c) => c.value === 'beta')).toMatchObject({ disabled: true, detail: 'Not on a production server' });
    expect(production.find((c) => c.value === 'dev')).toMatchObject({ disabled: true, detail: 'Not on a production server' });
    expect(production.find((c) => c.value === 'stable')?.label).toBe('Production releases');
  });
});

describe('who gets a feature preview', () => {
  const preview = { id: 'board', name: 'Board view', mode: 'opt-in' as const, ended: false, chosen: false, optedIn: 2 };
  it('offers the server’s default first, and only Off for one that has ended', () => {
    expect(featureModeChoices(preview, 'opt-in').map((c) => c.value)).toEqual(['default', 'off', 'opt-in', 'everyone', 'floors']);
    expect(featureModeChoices(preview, 'off')[0].label).toBe('As this server does: off');
    const ended = featureModeChoices({ ...preview, ended: true, until: '2026-01-01' }, 'off');
    expect(ended.filter((c) => c.disabled).map((c) => c.value)).toEqual(['opt-in', 'everyone', 'floors']);
  });

  it('says how many turned it on, and what to do once it has ended', () => {
    expect(featureHint(preview)).toBe('2 people have turned it on.');
    expect(featureHint({ ...preview, ended: true, until: '2026-01-01' })).toMatch(/should drop it or make it everyone’s/);
  });

  it('names the floors one is on for', () => {
    const names: Record<string, string> = { f: 'Finance', l: 'Legal', p: 'Payroll' };
    expect(featureHint({ ...preview, mode: 'floors', floors: ['f'] }, (id) => names[id])).toBe('On for Finance and the floors beneath, without a release; off everywhere else.');
    expect(featureHint({ ...preview, mode: 'floors', floors: ['f', 'l', 'p'] }, (id) => names[id])).toMatch(/^On for Finance, Legal and Payroll /);
  });
});
