import { beforeEach, describe, expect, it } from 'vitest';
import './lifecycle.js';
import type { UiLifecycle } from './lifecycle.js';

const STATES = [
  { id: 'in-progress', name: 'In progress' },
  { id: 'in-review', name: 'In review' },
  { id: 'complete', name: 'Complete' },
  { id: 'issued', name: 'Issued' },
  { id: 'retired', name: 'Retired' },
];

let track: UiLifecycle;

beforeEach(async () => {
  document.body.innerHTML = '<ui-lifecycle label="Version 2"></ui-lifecycle>';
  track = document.querySelector('ui-lifecycle')!;
  track.states = STATES;
  track.offLine = ['retired'];
  track.state = 'in-review';
  await track.updateComplete;
});

describe('ui-lifecycle', () => {
  it('rings the state it’s in, fills the ones passed, and leaves out states off the line', () => {
    const steps = [...track.shadowRoot!.querySelectorAll('li')];
    expect(steps.map((s) => s.textContent!.trim())).toEqual(['In progress', 'In review', 'Complete', 'Issued']);
    expect(steps.map((s) => s.className)).toEqual(['passed', 'here', '', '']);
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    expect(track.shadowRoot!.querySelector('ol')!.getAttribute('aria-label')).toBe('Version 2: In review');
  });

  it('shows an off-line state while the record is in it', async () => {
    track.state = 'retired';
    await track.updateComplete;
    expect(track.shadowRoot!.querySelector('.here')!.textContent!.trim()).toBe('Retired');
  });

  it('offers each move it may make, and says why when there are none', async () => {
    track.why = 'Only whoever manages it can issue it.';
    await track.updateComplete;
    expect(track.shadowRoot!.querySelector('.why')!.textContent).toBe('Only whoever manages it can issue it.');
    track.moves = ['complete'];
    await track.updateComplete;
    expect(track.shadowRoot!.querySelector('.why')).toBeNull();
    let moved = '';
    track.addEventListener('ui-move', (e) => (moved = (e as CustomEvent<{ state: string }>).detail.state));
    const button = track.shadowRoot!.querySelector('ui-button')!;
    expect(button.textContent!.trim()).toBe('Make it Complete');
    button.click();
    expect(moved).toBe('complete');
  });
});
