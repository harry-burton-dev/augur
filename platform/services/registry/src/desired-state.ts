// Each unit's desired state (ADR 0020): AUGUR and every installed app have one record saying which
// releases the deployment takes, whether they install by themselves, how far Automatic goes, a semver
// pin, and the weekly windows an automatic upgrade may start in. The updater and the app runner
// reconcile to it; every change is kept, with who made it.
import semver from 'semver';
import type { Ring } from './ring.ts';

/** AUGUR's own unit; every other unit is an app's id. */
export const AUGUR_UNIT = 'augur';

export type UnitPolicy = 'automatic' | 'ask' | 'hold';
export type UnitChannel = 'stable' | 'beta' | 'dev';
/** How far Automatic goes: patch releases only, or minor releases too. A major always waits for an admin. */
export type AutomaticReach = 'patch' | 'minor';

/** A weekly slot an automatic upgrade may start in, in the unit's time zone. `day` 0 is Sunday. */
export interface UpgradeWindow {
  day: number;
  /** HH:MM, 24-hour. */
  start: string;
  hours: number;
}

export interface DesiredState {
  unit: string;
  channel: UnitChannel;
  policy: UnitPolicy;
  automaticUpTo: AutomaticReach;
  /** A semver range the unit stays within, such as 0.13.x; absent takes any version. */
  pin?: string;
  /** When an automatic upgrade may start. None means at any time. An admin's upgrade starts whenever they ask. */
  windows: UpgradeWindow[];
  /** An IANA time zone, such as Europe/London. */
  timeZone: string;
  setBy: string;
  setAt: string;
}

/** The record as kept: without a time zone it takes the deployment's (DEPLOYMENT_TIME_ZONE). */
export type StoredDesiredState = Omit<DesiredState, 'timeZone'> & { timeZone?: string };

/** What an admin sets: the record without who and when. */
export type DesiredStateInput = Omit<DesiredState, 'unit' | 'setBy' | 'setAt'>;

/** Production's default window (ADR 0020): Sunday 02:00 for two hours. */
export const PRODUCTION_WINDOW: UpgradeWindow = { day: 0, start: '02:00', hours: 2 };
export const MAX_WINDOWS = 14;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_MINUTES = 7 * 24 * 60;

/**
 * The record a unit has until an admin sets one. AUGUR on production takes patch releases by
 * itself in Sunday's window; elsewhere it takes them at any time. Apps take patch and minor releases
 * at any time, as they did before there was a record. `timeZone` is the deployment's (DEPLOYMENT_TIME_ZONE).
 */
export const defaultDesiredState = (unit: string, ring: Ring, timeZone = 'UTC'): DesiredState => ({
  unit,
  channel: unit === AUGUR_UNIT ? (ring === 'dev' ? 'dev' : ring === 'preview' ? 'beta' : 'stable') : 'stable',
  policy: 'automatic',
  automaticUpTo: unit === AUGUR_UNIT ? 'patch' : 'minor',
  windows: unit === AUGUR_UNIT && ring === 'production' ? [PRODUCTION_WINDOW] : [],
  timeZone,
  setBy: 'default',
  setAt: new Date(0).toISOString(),
});

/** Whether `zone` is a time zone this runtime knows. */
export const knownTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

const minutesOf = (hhmm: string) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
};

/** Why a record can't be set, one sentence each, or nothing. */
export const desiredStateProblems = (input: DesiredStateInput): string[] => {
  const problems: string[] = [];
  if (input.pin !== undefined && !semver.validRange(input.pin)) problems.push(`“${input.pin}” isn’t a version range. Use one such as 0.13.x or ^1.2.0.`);
  if (!knownTimeZone(input.timeZone)) problems.push(`“${input.timeZone}” isn’t a time zone. Use one such as Europe/London or UTC.`);
  if (input.windows.length > MAX_WINDOWS) problems.push(`At most ${MAX_WINDOWS} windows.`);
  for (const w of input.windows) {
    if (!Number.isInteger(w.day) || w.day < 0 || w.day > 6) problems.push(`A window’s day is 0 (Sunday) to 6 (Saturday), not ${w.day}.`);
    if (minutesOf(w.start) === undefined) problems.push(`A window starts at a time such as 02:00, not “${w.start}”.`);
    if (!(w.hours >= 1 && w.hours <= 24)) problems.push(`A window lasts 1 to 24 hours, not ${w.hours}.`);
  }
  return problems;
};

/** Minutes since Sunday 00:00 in `timeZone`. */
const minuteOfWeek = (now: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return day * 24 * 60 + Number(parts.hour) * 60 + Number(parts.minute);
};

/**
 * Whether an automatic upgrade may start now, and if not when it next may. A window may run past
 * midnight, and Saturday's past the end of the week.
 */
export const windowAt = (state: Pick<DesiredState, 'windows' | 'timeZone'>, now: Date): { open: boolean; nextAt?: string } => {
  if (!state.windows.length) return { open: true };
  const at = minuteOfWeek(now, state.timeZone);
  let soonest = Infinity;
  for (const w of state.windows) {
    const start = w.day * 24 * 60 + (minutesOf(w.start) ?? 0);
    const since = (at - start + WEEK_MINUTES) % WEEK_MINUTES;
    if (since < w.hours * 60) return { open: true };
    soonest = Math.min(soonest, WEEK_MINUTES - since);
  }
  return { open: false, nextAt: new Date(Math.floor(now.getTime() / 60000) * 60000 + soonest * 60000).toISOString() };
};

/**
 * A release's step up from `from`: its prerelease forms count as the step they lead to. Under semver
 * a 0.x minor may break things, so it counts as a major (ADR 0020, amended 2 Nov).
 */
export const stepOf = (from: string, to: string): 'major' | 'minor' | 'patch' | undefined => {
  const d = semver.diff(from, to);
  if (!d) return undefined;
  if (d === 'major' || d === 'premajor') return 'major';
  if (d === 'minor' || d === 'preminor') return semver.major(from) === 0 ? 'major' : 'minor';
  return 'patch';
};

/** Whether `to` is a 0.x minor over `from`, which counts as a major. */
export const isZeroMinor = (from: string, to: string) => semver.major(from) === 0 && semver.major(to) === 0 && semver.minor(to) > semver.minor(from);

/**
 * Why Automatic doesn't start AUGUR upgrades on this server yet, or nothing: it waits until an admin
 * has upgraded AUGUR here once and it finished (ADR 0020, amended 2 Nov), so the real upgrade chain is
 * first tried with someone watching.
 */
export const firstUpgradeProblem = (history: { requestedBy: string; state: string }[]) =>
  history.some((u) => u.requestedBy !== 'automatic' && u.state === 'done')
    ? undefined
    : 'Automatic starts after an admin has upgraded AUGUR on this server once and it finished. Upgrade once from here and watch it.';

/** Why the pin keeps `version` out, or nothing. */
export const pinProblem = (state: Pick<DesiredState, 'pin' | 'unit'>, version: string) =>
  state.pin && !semver.satisfies(version, state.pin, { includePrerelease: true }) ? `${version} is outside the pin ${state.pin}.` : undefined;

/**
 * Why the record doesn't let `to` install by itself over `from`, or nothing when it does. Windows are
 * checked apart (windowAt), since a release that waits for a window is still on its way.
 */
export const automaticProblem = (state: DesiredState, from: string, to: string): string | undefined => {
  if (state.policy === 'hold') return 'Updates are on hold.';
  if (state.policy === 'ask') return 'Each update waits for an admin.';
  const pin = pinProblem(state, to);
  if (pin) return pin;
  const step = stepOf(from, to);
  if (step === 'major' && isZeroMinor(from, to)) return `${to} is a 0.x minor release, which may break things like a major, so it waits for an admin.`;
  if (step === 'major') return `${to} is a major release, which always waits for an admin.`;
  if (step === 'minor' && state.automaticUpTo === 'patch') return `${to} is a minor release, and Automatic takes patch releases only.`;
  return undefined;
};

/** The record in a sentence, as the Upgrade Centre says it. */
export const policySentence = (state: DesiredState): string => {
  const when = state.windows.length
    ? ` in ${state.windows.map((w) => `${DAYS[w.day]} ${w.start} for ${w.hours} hour${w.hours === 1 ? '' : 's'}`).join(', ')} (${state.timeZone})`
    : ' at any time';
  const pin = state.pin ? `, within ${state.pin}` : '';
  if (state.policy === 'hold') return `On hold: nothing new is offered${pin}.`;
  if (state.policy === 'ask') return `Ask first: each new release waits for an admin${pin}.`;
  return `Automatic: ${state.automaticUpTo === 'patch' ? 'patch releases install' : 'patch and minor releases install'} by themselves${when}${pin}. Anything bigger, and a 0.x minor, waits for an admin.`;
};

/**
 * A unit's record as it applies: what was set, over its default, in the deployment's time zone when
 * it names none. AUGUR's channel always comes from RELEASE_CHANNEL (and the server's ring), so `channel`
 * passes it in.
 */
export const resolvedState = (unit: string, stored: StoredDesiredState | undefined, ring: Ring, timeZone: string, channel?: UnitChannel): DesiredState & { isDefault: boolean } => ({
  ...defaultDesiredState(unit, ring, timeZone),
  ...stored,
  timeZone: stored?.timeZone ?? timeZone,
  ...(channel ? { channel } : {}),
  isDefault: !stored,
});
