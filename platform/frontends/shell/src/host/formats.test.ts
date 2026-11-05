import { afterEach, describe, expect, it } from 'vitest';
import { currentFormats, formatsFrom, languageOf, setFormats, writeDate } from './formats.js';

const at = '2026-03-24T15:30:00Z';
const token = (claims: object) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.y`;

afterEach(() => setFormats({}));

describe('how dates are written', () => {
  it('takes their date format, else their language, with their time zone and clock', () => {
    expect(formatsFrom({ dateFormat: 'en-US', timeZone: 'Europe/Berlin', clock: '24' }, 'de')).toEqual({ language: 'de', locale: 'en-US', timeZone: 'Europe/Berlin', hourCycle: 'h23' });
    expect(formatsFrom({}, 'de')).toEqual({ language: 'de', locale: 'de' });
    expect(formatsFrom({})).toEqual({});
  });

  it('writes a moment their way', () => {
    expect(writeDate(at, { day: 'numeric', month: 'short', year: 'numeric' }, { locale: 'en-GB', timeZone: 'UTC' })).toBe('24 Mar 2026');
    expect(writeDate(at, { day: 'numeric', month: 'short', year: 'numeric' }, { locale: 'en-US', timeZone: 'UTC' })).toBe('Mar 24, 2026');
    expect(writeDate(at, { hour: 'numeric', minute: '2-digit' }, { locale: 'en-US', timeZone: 'UTC', hourCycle: 'h23' })).toBe('15:30');
    expect(writeDate(at, { hour: 'numeric', minute: '2-digit' }, { locale: 'en-GB', timeZone: 'Asia/Tokyo', hourCycle: 'h12' })).toMatch(/^12:30\sam$/i);
    // what the shell set is the default
    setFormats({ locale: 'de-DE', timeZone: 'UTC' });
    expect(currentFormats().locale).toBe('de-DE');
    expect(writeDate(at, { dateStyle: 'short' })).toBe('24.03.26');
  });

  it('reads the language a sign-in carries', () => {
    expect(languageOf(token({ locale: 'de' }))).toBe('de');
    expect(languageOf(token({}))).toBeUndefined();
    expect(languageOf('nonsense')).toBeUndefined();
  });
});
