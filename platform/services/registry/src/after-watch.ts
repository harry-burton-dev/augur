/**
 * The light watch after an upgrade's 10-minute watch (ADR 0020, amended 2 Nov). A night-time window
 * rarely has the calls the watch needs to judge errors by, so when it was too quiet the updater keeps
 * looking, every few minutes, until AUGUR's services have had MIN_CALLS calls, for at most a day. By
 * then people's work is on the new release, so a failure doesn't go back by itself: it waits in Needs
 * you for an admin. The registry keeps the count, so a restarted updater carries on where it was.
 */

/** How long the light watch keeps looking for enough calls. */
export const AFTER_WATCH_MS = 24 * 60 * 60_000;
/** How often it looks. The gateway keeps 15 minutes of counts, so a look always covers the time since the last. */
export const AFTER_LOOK_MS = 5 * 60_000;
/** The same thresholds as the 10-minute watch (the updater's upgrade.ts). */
export const MIN_CALLS = 20;
export const ERROR_RATE = 0.05;
export const SIGN_IN_LOOKS = 2;
const GATEWAY_MINUTES = 15;

export interface AfterWatch {
  state: 'watching' | 'held' | 'failed' | 'quiet';
  since: string;
  until: string;
  lastLookAt?: string;
  calls: number;
  serverErrors: number;
  signInMisses: number;
  /** How it ended, in a sentence. */
  message?: string;
  endedAt?: string;
}

/** One look: AUGUR's own calls since the last look, and whether sign-in worked. */
export interface AfterLook {
  calls: number;
  serverErrors: number;
  signInProblem?: string;
}

export const startAfterWatch = (now: Date): AfterWatch => ({
  state: 'watching',
  since: now.toISOString(),
  until: new Date(now.getTime() + AFTER_WATCH_MS).toISOString(),
  calls: 0,
  serverErrors: 0,
  signInMisses: 0,
});

/** When a look is due, how many minutes of the gateway's counts it reads; nothing when none is due yet. */
export const lookDue = (w: AfterWatch, now: Date): { minutes: number } | undefined => {
  if (w.state !== 'watching') return undefined;
  const last = Date.parse(w.lastLookAt ?? w.since);
  if (now.getTime() - last < AFTER_LOOK_MS) return undefined;
  return { minutes: Math.min(GATEWAY_MINUTES, Math.max(1, Math.round((now.getTime() - last) / 60_000))) };
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Adds one look, and ends the watch when there's enough to judge by, sign-in keeps failing, or the day is up. */
export const afterLook = (w: AfterWatch, look: AfterLook, version: string, now: Date): AfterWatch => {
  if (w.state !== 'watching') return w;
  const at = now.toISOString();
  const next: AfterWatch = {
    ...w,
    lastLookAt: at,
    calls: w.calls + Math.max(0, look.calls),
    serverErrors: w.serverErrors + Math.max(0, look.serverErrors),
    signInMisses: look.signInProblem ? w.signInMisses + 1 : 0,
  };
  const stays = `AUGUR ${version} is still running: it didn’t go back by itself, because people’s work is on it now. See docs/upgrade-went-back.md before you do anything.`;
  const end = (state: AfterWatch['state'], message: string): AfterWatch => ({ ...next, state, message, endedAt: at });
  if (next.signInMisses >= SIGN_IN_LOOKS) return end('failed', `Signing in stopped working after the watch: ${look.signInProblem} ${stays}`);
  if (next.calls >= MIN_CALLS) {
    if (next.serverErrors / next.calls > ERROR_RATE) {
      return end('failed', `${next.serverErrors} of the first ${next.calls} calls to AUGUR’s services after the watch failed, more than ${ERROR_RATE * 100}%. ${stays}`);
    }
    return end('held', `AUGUR’s services answered their first ${next.calls} calls after the watch with few errors.`);
  }
  if (now.getTime() >= Date.parse(w.until)) {
    return end('quiet', `In a day AUGUR’s services had only ${plural(next.calls, 'call')}, and it takes ${MIN_CALLS} to judge errors by. Sign-in kept working.`);
  }
  return next;
};
