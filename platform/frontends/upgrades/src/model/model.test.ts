import { describe, expect, it } from 'vitest';
import { levelFrom, newestAllowed, pinChoices, validPin } from './levels.js';
import { needsYou } from './needs-you.js';
import { canChange, isRefusal } from './roles.js';
import { policySentence } from './sentence.js';
import { unitState } from './states.js';
import { formatWhen, insideWindow, nextWindows } from './time.js';
import type { PlatformUpdates } from './types.js';
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

describe('unit state', () => {
  const now = new Date('2026-11-04T12:00:00Z'); // a Wednesday
  const base = { running: '0.13.1', timeZone: 'Europe/London', windows: sunday2 };

  it('shows offers as available until the desired-state record exists', () => {
    expect(unitState({ ...base, offered: { version: '0.13.2' } }, now)).toBe('update-available');
    expect(unitState({ ...base }, now)).toBe('up-to-date');
  });

  it('waits for the window when Automatic would take it, and for a person when it wouldn’t', () => {
    expect(unitState({ ...base, policy: 'automatic', offered: { version: '0.13.2' } }, now)).toBe('waiting-window');
    expect(unitState({ ...base, policy: 'automatic', offered: { version: '0.14.0' } }, now)).toBe('waiting-you');
    expect(unitState({ ...base, policy: 'automatic', offered: { version: '0.13.2', asksNewPowers: true } }, now)).toBe('waiting-you');
    expect(unitState({ ...base, policy: 'ask', offered: { version: '0.13.2' } }, now)).toBe('waiting-you');
  });

  it('puts running, watching, halted and held before any offer', () => {
    const offered = { version: '0.13.2' };
    expect(unitState({ ...base, offered, job: 'running', runningHalted: { reason: 'x', at: '' } }, now)).toBe('running');
    expect(unitState({ ...base, offered, watchingUntil: '2026-11-04T12:05:00Z' }, now)).toBe('watching');
    expect(unitState({ ...base, offered, watchingUntil: '2026-11-04T11:55:00Z' }, now)).toBe('update-available');
    expect(unitState({ ...base, offered, runningHalted: { reason: 'x', at: '' }, held: true }, now)).toBe('halted');
    expect(unitState({ ...base, offered, held: true, policy: 'automatic' }, now)).toBe('held');
  });
});

describe('policy sentence', () => {
  it('says what moves by itself and what waits', () => {
    expect(policySentence({ name: 'AUGUR', channel: 'stable', policy: 'automatic', windows: sunday2 })).toBe(
      'AUGUR takes patch releases from Production by itself on Sundays 02:00–04:00. Minors and majors wait for you.',
    );
    expect(policySentence({ name: 'Artifacts', channel: 'beta', policy: 'automatic', automaticUpTo: 'minor', windows: 'any', pin: '0.x' })).toBe(
      'Artifacts takes patch and minor releases from Preview within 0.x by itself at any time. Majors wait for you.',
    );
    expect(policySentence({ name: 'AUGUR', channel: 'stable', policy: 'hold', windows: 'any' })).toContain('is held');
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
    expect(canChange(['deployment-admin'])).toEqual({ allowed: true });
    expect(canChange(['admin'])).toMatchObject({ allowed: false, requiredRole: 'deployment-admin' });
    expect(isRefusal({ error: 'step_up_required', acr: 'otp', maxAge: 300, message: 'Sign in again' })).toBe(true);
    expect(isRefusal({ error: 'oops' })).toBe(false);
  });
});

describe('needs you', () => {
  const updates = (over: Partial<PlatformUpdates> = {}): PlatformUpdates => ({ running: { version: '0.13.1', channel: 'stable' }, channel: 'stable', feed: 'on', newer: [], needsYou: [], ...over });

  it('is empty when nothing waits', () => {
    expect(needsYou(updates(), [], new Set())).toEqual([]);
  });

  it('puts a bad feed first, then a halted release, then unopened failures and approvals', () => {
    const items = needsYou(
      updates({
        feedTrust: { state: 'expired' },
        needsYou: [{ kind: 'halted', message: 'Sign-in loops after upgrade' }],
        upgrade: { id: 'u1', from: '0.13.0', version: '0.13.1', requestedBy: 'p', requestedAt: '', state: 'rolled-back', steps: [] },
      }),
      [{ app: 'folio', name: 'Artifacts', version: '1.0.0', installedAt: '', channel: 'stable', policy: 'automatic', update: { version: '1.1.0', channel: 'stable', needs: ['It asks to send notifications.'] } }],
      new Set(),
    );
    expect(items.map((i) => i.kind)).toEqual(['feed', 'halted', 'went-back', 'approval']);
    expect(items[3]!.title).toBe('Artifacts 1.1.0 is waiting for you');
  });

  it('drops a result once someone has opened it', () => {
    const u = updates({ upgrade: { id: 'u1', from: '0.13.0', version: '0.13.1', requestedBy: 'p', requestedAt: '', state: 'failed', steps: [] } });
    expect(needsYou(u, [], new Set(['u1']))).toEqual([]);
  });
});
