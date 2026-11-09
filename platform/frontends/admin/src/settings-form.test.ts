import { describe, expect, it } from 'vitest';
import type { AppSettingView } from './api.js';
import { givenSettings, mustFill, settingChanges, settingNow } from './settings-form.js';

const retention: AppSettingView = { id: 'retentionDays', label: 'Keep archived notes for', type: 'number', unit: 'days', min: 7, max: 3650, default: 365, required: false, set: false };
const theme: AppSettingView = { id: 'theme', label: 'Note colour', type: 'enum', options: ['plain', 'warm'], default: 'plain', required: false, set: true, value: 'warm' };
const key: AppSettingView = { id: 'exportKey', label: 'Export key', type: 'secret', required: true, set: true, setAt: '2026-11-09T10:00:00Z' };
const sharing: AppSettingView = { id: 'allowSharing', label: 'Sharing', type: 'boolean', default: false, required: false, set: false };

describe('an app’s settings in Admin', () => {
  it('says what each is now, never a secret’s value', () => {
    expect(settingNow(retention)).toBe('365 days (its default)');
    expect(settingNow(theme)).toBe('warm');
    expect(settingNow(sharing)).toBe('Off (its default)');
    expect(settingNow(key)).toMatch(/^Given /);
    expect(settingNow({ ...key, set: false })).toBe('Not given yet: the app needs it to start');
  });

  it('sends only what the form changed, secrets last, and an emptied one back to its default', () => {
    const all = [key, retention, theme, sharing];
    expect(settingChanges(all, { 'setting:exportKey': '', 'setting:retentionDays': '', 'setting:theme': 'warm', 'setting:allowSharing': '' })).toEqual([]);
    expect(
      settingChanges(all, { 'setting:exportKey': 'new-key', 'setting:retentionDays': '30', 'setting:theme': '', 'setting:allowSharing': 'true' }),
    ).toEqual([
      { id: 'retentionDays', value: 30 },
      { id: 'theme', value: null },
      { id: 'allowSharing', value: true },
      { id: 'exportKey', value: 'new-key' },
    ]);
  });

  it('asks an install for the required settings with no default, each as its own type', () => {
    const fill = mustFill([key, retention]);
    expect(fill.map((s) => s.id)).toEqual(['exportKey']);
    expect(givenSettings([key, retention], { 'setting:exportKey': 'k', 'setting:retentionDays': '30' })).toEqual({ exportKey: 'k', retentionDays: 30 });
  });
});
