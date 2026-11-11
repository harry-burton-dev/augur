import { describe, expect, it } from 'vitest';
import { DEFAULT_CHOICE, settingChange } from './app-settings.js';
import type { AppSettingView } from './types.js';

const days: AppSettingView = { id: 'keep', label: 'Keep deleted things', type: 'number', required: false, min: 1, max: 90, unit: 'days', default: 30, set: false };

describe('an app setting changed inline', () => {
  it('sends only what differs, and puts a value back to its default', () => {
    expect(settingChange(days, '30')).toBeUndefined();
    expect(settingChange(days, ' 14 ')).toEqual({ value: 14 });
    expect(settingChange({ ...days, set: true, value: 14 }, DEFAULT_CHOICE)).toEqual({ value: null });
    expect(settingChange(days, DEFAULT_CHOICE)).toBeUndefined();
  });

  it('says why a number is out of bounds, and keeps a secret left empty', () => {
    expect(settingChange(days, '120')).toEqual({ problem: 'Keep deleted things takes a number from 1 to 90 days.' });
    const key: AppSettingView = { id: 'key', label: 'API key', type: 'secret', required: true, set: true };
    expect(settingChange(key, '')).toBeUndefined();
    expect(settingChange(key, 's3cret')).toEqual({ value: 's3cret' });
    const on: AppSettingView = { id: 'on', label: 'Digest', type: 'boolean', required: false, default: false, set: false };
    expect(settingChange(on, 'true')).toEqual({ value: true });
  });
});
