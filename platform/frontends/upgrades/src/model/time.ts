import type { Window } from './types.js';

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsIn = (at: Date, timeZone: string): ZonedParts => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(at)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
  return { year: parts.year!, month: parts.month!, day: parts.day!, hour: parts.hour! % 24, minute: parts.minute! };
};

/** Minutes the zone is ahead of UTC at that instant. */
const offsetAt = (at: Date, timeZone: string): number => {
  const p = partsIn(at, timeZone);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
};

/** The instant a wall-clock time in a zone falls at. A time skipped by a clock change moves forward with it. */
export const zonedToInstant = (year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date => {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let at = wall - offsetAt(new Date(wall), timeZone) * 60_000;
  at = wall - offsetAt(new Date(at), timeZone) * 60_000;
  return new Date(at);
};

export interface Occurrence {
  start: Date;
  end: Date;
}

/**
 * The next maintenance windows from `from`, in order, a window under way first.
 * "Any time" has none: everything may run whenever.
 */
export const nextWindows = (windows: Window[] | 'any', timeZone: string, from: Date, count = 3): Occurrence[] => {
  if (windows === 'any' || !windows.length) return [];
  const today = partsIn(from, timeZone);
  const found: Occurrence[] = [];
  for (let i = -1; i <= 7 * count + 1; i++) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    for (const w of windows) {
      if (date.getUTCDay() !== w.day) continue;
      const [h, m] = w.start.split(':').map(Number);
      const start = zonedToInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), h!, m!, timeZone);
      const end = new Date(start.getTime() + w.hours * 3_600_000);
      if (end > from) found.push({ start, end });
    }
  }
  return found.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, count);
};

/** Whether `at` falls inside a window. "Any time" always does. */
export const insideWindow = (windows: Window[] | 'any', timeZone: string, at: Date): boolean =>
  windows === 'any' || nextWindows(windows, timeZone, at, 1).some((o) => o.start <= at && at < o.end);

const relative = (to: Date, now: Date, locale?: string): string => {
  const seconds = Math.round((to.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 36 * 3600) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86_400), 'day');
};

/**
 * A time as the spec asks: absolute in the deployment's zone, the zone named, and relative.
 * "Sun 3 Nov, 02:00 GMT (in 2 days)".
 */
export const formatWhen = (at: Date | string, timeZone: string, now: Date, locale?: string): string => {
  const when = typeof at === 'string' ? new Date(at) : at;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(locale, { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' })
      .formatToParts(when)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${parts.timeZoneName} (${relative(when, now, locale)})`;
};
