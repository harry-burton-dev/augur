import { describe, expect, it } from 'vitest';
import { levelFrom, newestAllowed, pinChoices, validPin } from './levels.js';
import { gateFor, isRefusal } from './roles.js';
import { desiredProblems, policySentence } from './sentence.js';
import { formatWhen, insideWindow, nextWindows } from './time.js';
import { channelsFor } from './words.js';

const sunday2 = [{ day: 0, start: '02:00', hours: 2 }];

describe('windows', () => {
  it('finds the next three Sunday windows in the deployment’s zone', () => {
    const from = new Date('2026-11-01T12:00:00Z'); // a Sunday afternoon in London
    const next = nextWindows(sunday2, 'Europe/London', from);
    expect(next.map((o) => o.start.toISOString())).toEqual(['2026-11-08T02:00:00.000Z', '2026-11-15T02:00:00.000Z', '2026-11-22T02:00:00.000Z']);
  });

  it('follows the zone across a clock change', () => {
    const from = new Date('2026-03-25T00:00:00Z');
    const [first, second] = nextWindows([{ day: 0, start: '05:00', hours: 1 }], 'Europe/London', from, 2);
    expect(first!.start.toISOString()).toBe('2026-03-29T04:00:00.000Z'); // BST from 29 March
    expect(second!.start.toISOString()).toBe('2026-04-05T04:00:00.000Z');
  });

  it('says whether now is inside a window, and any time always is', () => {
    expect(insideWindow(sunday2, 'Europe/London', new Date('2026-11-08T03:30:00Z'))).toBe(true);
    expect(insideWindow(sunday2, 'Europe/London', new Date('2026-11-08T04:30:00Z'))).toBe(false);
    expect(insideWindow('any', 'Europe/London', new Date())).toBe(true);
    expect(nextWindows('any', 'UTC', new Date())).toEqual([]);
  });

  it('writes a time absolute, zoned and relative', () => {
    expect(formatWhen('2026-11-08T02:00:00Z', 'Europe/London', new Date('2026-11-06T02:00:00Z'), 'en-GB')).toBe('Sun 8 Nov, 02:00 GMT (in 2 days)');
  });
});

describe('levels and pins', () => {
  it('counts a minor below 1.0 as a major', () => {
    expect(levelFrom('0.13.1', '0.13.2')).toBe('patch');
    expect(levelFrom('0.13.1', '0.14.0')).toBe('major');
    expect(levelFrom('1.2.0', '1.3.0')).toBe('minor');
    expect(levelFrom('1.2.0', '2.0.0')).toBe('major');
  });

  it('offers the newest release a pin allows, never a halted one', () => {
    const releases = [{ version: '0.13.2' }, { version: '0.13.3', halted: { reason: 'Sign-in loop', at: '2026-11-01' } }, { version: '0.14.0' }];
    expect(newestAllowed(releases, '0.13.x')?.version).toBe('0.13.2');
    expect(newestAllowed(releases)?.version).toBe('0.14.0');
  });

  it('suggests the common pins and checks typed ones', () => {
    expect(pinChoices('0.13.1').map((p) => p.range)).toEqual(['0.13.x', '0.x', '0.13.1']);
    expect(validPin('>=0.13 <0.15')).toBe(true);
    expect(validPin('soon')).toBe(false);
  });
});

describe('policy sentence and checks', () => {
  it('words the record as the registry does', () => {
    expect(policySentence({ policy: 'automatic', automaticUpTo: 'patch', windows: sunday2, timeZone: 'Europe/London' })).toBe(
      'Automatic: patch releases install by themselves in Sunday 02:00 for 2 hours (Europe/London). Anything bigger waits for an admin.',
    );
    expect(policySentence({ policy: 'automatic', automaticUpTo: 'minor', windows: [], pin: '0.x', timeZone: 'UTC' })).toBe(
      'Automatic: patch and minor releases install by themselves at any time, within 0.x. Anything bigger waits for an admin.',
    );
    expect(policySentence({ policy: 'hold', automaticUpTo: 'patch', windows: [], timeZone: 'UTC' })).toBe('On hold: nothing new is offered.');
  });

  it('catches what the registry would refuse before saving', () => {
    const ok = { channel: 'stable' as const, policy: 'automatic' as const, automaticUpTo: 'patch' as const, windows: sunday2, timeZone: 'Europe/London' };
    expect(desiredProblems(ok)).toEqual([]);
    expect(desiredProblems({ ...ok, pin: 'banana' })[0]).toContain('isn’t a version range');
    expect(desiredProblems({ ...ok, timeZone: 'Mars/Base' })[0]).toContain('isn’t a time zone');
    expect(desiredProblems({ ...ok, windows: [{ day: 0, start: '25:00', hours: 2 }] })).toHaveLength(1);
  });
});

describe('channels and roles', () => {
  it('keeps channels a ring can’t take in the list, saying why', () => {
    const prod = channelsFor('production');
    expect(prod.filter((c) => c.allowed).map((c) => c.channel)).toEqual(['stable']);
    expect(prod[1]!.reason).toContain('SERVER_RING');
    expect(channelsFor('dev').every((c) => c.allowed)).toBe(true);
  });

  it('lets deployment admins change things and tells others which role they need', () => {
    expect(gateFor(true)).toEqual({ allowed: true });
    expect(gateFor(false)).toMatchObject({ allowed: false, requiredRole: 'deployment-admin' });
    expect(isRefusal({ error: 'step_up_required', acr: 'otp', maxAge: 300, message: 'Sign in again' })).toBe(true);
    expect(isRefusal({ error: 'oops' })).toBe(false);
  });
});

