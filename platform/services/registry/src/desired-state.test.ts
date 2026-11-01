import { describe, expect, it } from 'vitest';
import { automaticProblem, defaultDesiredState, desiredStateProblems, pinProblem, policySentence, windowAt, type DesiredState } from './desired-state.ts';

const state = (more: Partial<DesiredState> = {}): DesiredState => ({ ...defaultDesiredState('augur', 'production'), ...more });

describe('desired state (ADR 0020)', () => {
  it('defaults AUGUR on production to patch releases in Sunday’s window, and apps to patch and minor at any time', () => {
    expect(defaultDesiredState('augur', 'production', 'Europe/London')).toMatchObject({ policy: 'automatic', automaticUpTo: 'patch', windows: [{ day: 0, start: '02:00', hours: 2 }], timeZone: 'Europe/London', setBy: 'default' });
    expect(defaultDesiredState('augur', 'dev').windows).toEqual([]);
    expect(defaultDesiredState('mandate', 'production')).toMatchObject({ channel: 'stable', policy: 'automatic', automaticUpTo: 'minor', windows: [] });
  });

  it('turns down a bad pin, time zone or window, saying how to write it', () => {
    expect(desiredStateProblems({ ...state(), pin: '0.13.x', timeZone: 'Europe/London' })).toEqual([]);
    expect(desiredStateProblems({ ...state(), pin: 'latest', timeZone: 'Mars/Olympus', windows: [{ day: 7, start: '25:00', hours: 0 }] })).toEqual([
      '“latest” isn’t a version range. Use one such as 0.13.x or ^1.2.0.',
      '“Mars/Olympus” isn’t a time zone. Use one such as Europe/London or UTC.',
      'A window’s day is 0 (Sunday) to 6 (Saturday), not 7.',
      'A window starts at a time such as 02:00, not “25:00”.',
      'A window lasts 1 to 24 hours, not 0.',
    ]);
  });

  it('opens a window in the unit’s own time zone, across midnight and the end of the week, and says when the next opens', () => {
    const sunday = state({ timeZone: 'Europe/London' });
    // 2026-11-01 is a Sunday; London is on UTC in November.
    expect(windowAt(sunday, new Date('2026-11-01T02:30:00Z')).open).toBe(true);
    expect(windowAt(sunday, new Date('2026-11-01T04:00:00Z'))).toEqual({ open: false, nextAt: '2026-11-08T02:00:00.000Z' });
    expect(windowAt(state({ timeZone: 'America/New_York' }), new Date('2026-11-01T02:30:00Z')).open).toBe(false);
    const lateSaturday = state({ windows: [{ day: 6, start: '23:00', hours: 3 }], timeZone: 'UTC' });
    expect(windowAt(lateSaturday, new Date('2026-11-01T01:00:00Z')).open).toBe(true);
    expect(windowAt(state({ windows: [] }), new Date()).open).toBe(true);
  });

  it('lets Automatic take only what it reaches, inside the pin, and never a major', () => {
    expect(automaticProblem(state(), '0.13.0', '0.13.1')).toBeUndefined();
    expect(automaticProblem(state(), '0.13.1', '0.14.0')).toBe('0.14.0 is a minor release, and Automatic takes patch releases only.');
    expect(automaticProblem(state({ automaticUpTo: 'minor' }), '0.13.1', '0.14.0')).toBeUndefined();
    expect(automaticProblem(state({ automaticUpTo: 'minor' }), '0.13.1', '1.0.0')).toBe('1.0.0 is a major release, which always waits for an admin.');
    expect(automaticProblem(state({ automaticUpTo: 'minor', pin: '0.13.x' }), '0.13.1', '0.14.0')).toBe('0.14.0 is outside the pin 0.13.x.');
    expect(automaticProblem(state({ policy: 'ask' }), '0.13.0', '0.13.1')).toBe('Each update waits for an admin.');
    expect(automaticProblem(state({ policy: 'hold' }), '0.13.0', '0.13.1')).toBe('Updates are on hold.');
    expect(pinProblem(state({ pin: '0.13.x' }), '0.13.2-dev.4')).toBeUndefined();
  });

  it('says the record in a sentence', () => {
    expect(policySentence(state())).toBe('Automatic: patch releases install by themselves in Sunday 02:00 for 2 hours (UTC). Anything bigger waits for an admin.');
    expect(policySentence(state({ policy: 'ask', pin: '0.13.x' }))).toBe('Ask first: each new release waits for an admin, within 0.13.x.');
  });
});
