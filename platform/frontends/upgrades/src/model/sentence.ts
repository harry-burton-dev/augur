import semver from 'semver';
import type { DesiredStateInput, Window } from './types.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES = DAYS;
/** The registry's own limit on windows (MAX_WINDOWS). */
export const MAX_WINDOWS = 14;

/**
 * The record in one sentence, worded as the registry words it (desired-state.ts), so the
 * "now" and "after you save" lines can be compared word for word.
 */
export const policySentence = (s: Pick<DesiredStateInput, 'policy' | 'automaticUpTo' | 'pin' | 'windows'> & { timeZone: string }): string => {
  const when = s.windows.length
    ? ` in ${s.windows.map((w) => `${DAYS[w.day]} ${w.start} for ${w.hours} hour${w.hours === 1 ? '' : 's'}`).join(', ')} (${s.timeZone})`
    : ' at any time';
  const pin = s.pin ? `, within ${s.pin}` : '';
  if (s.policy === 'hold') return `On hold: nothing new is offered${pin}.`;
  if (s.policy === 'ask') return `Ask first: each new release waits for an admin${pin}.`;
  return `Automatic: ${s.automaticUpTo === 'patch' ? 'patch releases install' : 'patch and minor releases install'} by themselves${when}${pin}. Anything bigger waits for an admin.`;
};

const knownTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

const validWindow = (w: Window) => Number.isInteger(w.day) && w.day >= 0 && w.day <= 6 && /^([01]\d|2[0-3]):[0-5]\d$/.test(w.start) && w.hours >= 1 && w.hours <= 24;

/**
 * Why the registry would turn a record down, in its words, checked before saving so the
 * person fixes it in place. The registry checks again and has the last word.
 */
export const desiredProblems = (s: DesiredStateInput & { timeZone: string }): string[] => {
  const problems: string[] = [];
  if (s.pin !== undefined && !semver.validRange(s.pin)) problems.push(`“${s.pin}” isn’t a version range. Use one such as 0.13.x or ^1.2.0.`);
  if (!knownTimeZone(s.timeZone)) problems.push(`“${s.timeZone}” isn’t a time zone. Use one such as Europe/London or UTC.`);
  if (s.windows.length > MAX_WINDOWS) problems.push(`At most ${MAX_WINDOWS} windows.`);
  if (s.windows.some((w) => !validWindow(w))) problems.push('Each window starts at a time such as 02:00 and lasts 1 to 24 hours.');
  return problems;
};

/** Every IANA zone this browser knows, for the time zone picker. Falls back to the ones given. */
export const timeZones = (...always: string[]): string[] => {
  const known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set([...always, ...known])].sort();
};
