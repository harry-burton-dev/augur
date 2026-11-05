import type { Preferences } from './preferences.js';

/**
 * How dates and times are written for the person signed in (ADR 0039: from the person, then the
 * deployment, then the browser). The words stay English; only the way of writing dates, times and
 * numbers follows their choice.
 */
export interface Formats {
  /** A language tag, such as en-GB; the browser's without it. */
  locale?: string;
  /** IANA; the browser's without it. */
  timeZone?: string;
  hourCycle?: 'h12' | 'h23';
}

/** Their date format, else their language, else the browser's; their time zone; their clock. */
export const formatsFrom = (prefs: Pick<Preferences, 'dateFormat' | 'timeZone' | 'clock'>, language?: string): Formats => ({
  ...(prefs.dateFormat || language ? { locale: prefs.dateFormat || language } : {}),
  ...(prefs.timeZone ? { timeZone: prefs.timeZone } : {}),
  ...(prefs.clock ? { hourCycle: prefs.clock === '12' ? 'h12' : 'h23' } : {}),
});

let current: Formats = {};

/** The shell sets these once preferences load and whenever one of them changes. */
export const setFormats = (formats: Formats) => {
  current = formats;
};
export const currentFormats = () => current;

/** A formatter for `options`, written their way. A tag the browser can't use falls back to the browser's own. */
export const dateTimeFormat = (options: Intl.DateTimeFormatOptions, formats: Formats = current) => {
  const extra: Intl.DateTimeFormatOptions = {
    ...(formats.timeZone && !options.timeZone ? { timeZone: formats.timeZone } : {}),
    ...(formats.hourCycle && options.hour ? { hourCycle: formats.hourCycle } : {}),
  };
  try {
    return new Intl.DateTimeFormat(formats.locale, { ...options, ...extra });
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
};

/** `when`, written their way. */
export const writeDate = (when: string | number | Date, options: Intl.DateTimeFormatOptions, formats: Formats = current) =>
  dateTimeFormat(options, formats).format(new Date(when));

/** The language a sign-in token carries (Keycloak's `locale` claim), if it has one. */
export const languageOf = (token: string): string | undefined => {
  const part = token.split('.')[1];
  if (!part) return undefined;
  try {
    const locale = (JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { locale?: unknown }).locale;
    return typeof locale === 'string' && locale ? locale : undefined;
  } catch {
    return undefined;
  }
};
