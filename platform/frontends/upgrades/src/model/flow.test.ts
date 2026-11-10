import { describe, expect, it } from 'vitest';
import { endingOf, flowSteps } from './flow.js';
import type { Upgrade } from './types.js';

const up = (over: Partial<Upgrade> = {}): Upgrade => ({ id: 'u1', from: '0.13.1', version: '0.13.2', requestedBy: 'p1', requestedAt: '2026-11-02T01:00:00Z', state: 'running', steps: [], ...over });
const at = '2026-11-02T01:01:00Z';

describe('following an upgrade', () => {
  it('shows every planned step, the watch included, with where it stands', () => {
    const steps = flowSteps(up({ steps: [{ step: 'preflight', state: 'done', at }, { step: 'backup', state: 'running', at }] }));
    expect(steps.map((s) => s.state)).toEqual(['done', 'now', 'next', 'next', 'next', 'next']);
    expect(steps.at(-1)!.label).toBe('Watch it for 10 minutes');
  });

  it('adds going back once it starts, and marks a step left running when it ended as failed', () => {
    const steps = flowSteps(up({ state: 'rolled-back', steps: [{ step: 'preflight', state: 'done', at }, { step: 'verify', state: 'running', at }, { step: 'roll-back', state: 'done', at }] }));
    expect(steps.find((s) => s.step === 'verify')!.state).toBe('failed');
    expect(steps.at(-1)!.step).toBe('roll-back');
  });

  it('ends one of four ways, and says when a failure left the new release running', () => {
    expect(endingOf(up({ state: 'done' }), '0.13.2')!.kind).toBe('done');
    expect(endingOf(up({ state: 'rolled-back' }), '0.13.1')!.words).toContain('Back on 0.13.1');
    expect(endingOf(up({ state: 'failed', message: 'Watch tripped' }), '0.13.2')!.words).toContain('0.13.2 is running but didn’t pass its checks: Watch tripped');
    expect(endingOf(up({ state: 'failed' }), '0.13.1')!.words).toContain('couldn’t go back by itself');
    expect(endingOf(up({ state: 'cancelled' }), '0.13.1')!.kind).toBe('cancelled');
    expect(endingOf(up(), '0.13.1')).toBeUndefined();
  });
});
