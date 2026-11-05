import { describe, expect, it } from 'vitest';
import { afterLook, lookDue, startAfterWatch } from './after-watch.ts';

const T0 = new Date('2026-11-01T02:20:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe('the light watch after a quiet watch (ADR 0020, amended 2 Nov)', () => {
  it('looks every 5 minutes, reading the minutes since the last look', () => {
    const w = startAfterWatch(T0);
    expect(lookDue(w, at(4))).toBeUndefined();
    expect(lookDue(w, at(5))).toEqual({ minutes: 5 });
    expect(lookDue(afterLook(w, { calls: 1, serverErrors: 0 }, '0.13.1', at(5)), at(9))).toBeUndefined();
    // The gateway keeps 15 minutes, so a late look reads all it has.
    expect(lookDue(w, at(60))).toEqual({ minutes: 15 });
  });

  it('holds once AUGUR’s services have had 20 calls with few errors', () => {
    let w = afterLook(startAfterWatch(T0), { calls: 12, serverErrors: 0 }, '0.13.1', at(5));
    expect(w.state).toBe('watching');
    w = afterLook(w, { calls: 9, serverErrors: 1 }, '0.13.1', at(10));
    expect(w).toMatchObject({ state: 'held', calls: 21, serverErrors: 1, message: 'AUGUR’s services answered their first 21 calls after the watch with few errors.' });
    expect(lookDue(w, at(60))).toBeUndefined();
  });

  it('fails without going back when too many of those calls fail, or sign-in stops twice in a row', () => {
    const errors = afterLook(startAfterWatch(T0), { calls: 20, serverErrors: 4 }, '0.13.1', at(5));
    expect(errors.state).toBe('failed');
    expect(errors.message).toBe(
      '4 of the first 20 calls to AUGUR’s services after the watch failed, more than 5%. AUGUR 0.13.1 is still running: it didn’t go back by itself, because people’s work is on it now. See docs/upgrade-went-back.md before you do anything.',
    );
    const once = afterLook(startAfterWatch(T0), { calls: 0, serverErrors: 0, signInProblem: 'Keycloak answered 503.' }, '0.13.1', at(5));
    expect(once.state).toBe('watching');
    expect(afterLook(once, { calls: 0, serverErrors: 0, signInProblem: 'Keycloak answered 503.' }, '0.13.1', at(10)).message).toMatch(/^Signing in stopped working after the watch: Keycloak answered 503\. AUGUR 0\.13\.1 is still running/);
  });

  it('ends quiet after a day without enough calls', () => {
    const w = afterLook(startAfterWatch(T0), { calls: 3, serverErrors: 0 }, '0.13.1', at(24 * 60));
    expect(w).toMatchObject({ state: 'quiet', message: 'In a day AUGUR’s services had only 3 calls, and it takes 20 to judge errors by. Sign-in kept working.' });
  });
});
