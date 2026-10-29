import { describe, expect, it, vi } from 'vitest';
import './card.js';
import './tally.js';
import './details.js';
import './timeline.js';
import './path.js';
import { dayWords } from './timeline.js';
import type { UiCard } from './card.js';
import type { UiTally } from './tally.js';
import type { UiDetails } from './details.js';
import type { UiTimeline } from './timeline.js';
import type { UiPath } from './path.js';

const settle = async (el: { updateComplete: Promise<unknown> }) => {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

const make = async <T extends HTMLElement & { updateComplete: Promise<unknown> }>(tag: string, props: Partial<T>) => {
  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.replaceChildren(el);
  await settle(el);
  return el;
};

describe('ui-card', () => {
  it('shows its floor as a dot and a name, at most three facts, and opens as a whole', async () => {
    const el = await make<UiCard>('ui-card', { heading: 'Keep Port Halden open', status: 'warning', statusLabel: 'At risk', floorKind: 'team', floorName: 'Engineering', meta: ['By 13 Nov', 'Dana Reyes', '3 parts', 'dropped'], note: '1 part blocked' });
    const root = el.shadowRoot!;
    const floor = root.querySelector('.floor') as HTMLElement;
    expect(floor.textContent).toBe('Engineering');
    expect(floor.getAttribute('style')).toContain('--floor-team-high');
    expect(root.querySelector('.meta')!.textContent).not.toContain('dropped');
    expect(root.querySelector('.note')!.textContent).toBe('1 part blocked');
    const open = vi.fn();
    el.addEventListener('ui-open', open);
    (root.querySelector('button.card') as HTMLButtonElement).click();
    expect(open).toHaveBeenCalledOnce();
  });

  it('stays in the grid when it can’t be opened, and says why', async () => {
    const el = await make<UiCard>('ui-card', { heading: 'Budget 2027', floorName: 'Finance', meta: ['By 1 Dec'], unavailable: true, reason: 'Kept on Finance. Ask its leads.' });
    const root = el.shadowRoot!;
    expect(root.querySelector('button')).toBeNull();
    expect(root.querySelector('.card')!.getAttribute('aria-disabled')).toBe('true');
    expect(root.querySelector('.meta')!.textContent).toBe('Kept on Finance. Ask its leads.');
    expect(root.querySelector('ui-icon[name="lock"]')).not.toBeNull();
  });
});

describe('ui-tally', () => {
  it('draws one segment per thing, names every count, and says only the loud ones', async () => {
    const el = await make<UiTally>('ui-tally', {
      noun: ['part', 'parts'],
      counts: [
        { status: 'done', n: 4, word: 'achieved' },
        { status: 'warning', n: 1, word: 'at risk', loud: true },
        { status: 'failed', n: 1, word: 'blocked', loud: true },
        { status: 'queued', n: 0, word: 'not started' },
      ],
    });
    const root = el.shadowRoot!;
    expect(root.querySelectorAll('.bar i')).toHaveLength(6);
    expect(root.querySelector('.bar')!.getAttribute('aria-label')).toBe('6 parts: 4 achieved, 1 at risk, 1 blocked');
    expect(root.querySelector('.words')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('6 parts · 1 at risk · 1 blocked');
  });

  it('draws proportionally past 24', async () => {
    const el = await make<UiTally>('ui-tally', { counts: [{ status: 'done', n: 30, word: 'done' }, { status: 'queued', n: 10, word: 'waiting' }] });
    expect(el.shadowRoot!.querySelectorAll('.bar i')).toHaveLength(2);
  });
});

describe('ui-details', () => {
  it('says what isn’t known, and folds past its limit', async () => {
    const items = [{ label: 'Class', value: 'Frigate' }, { label: 'Home port', value: '' }, ...Array.from({ length: 8 }, (_, i) => ({ label: `L${i}`, value: `${i}` }))];
    const el = await make<UiDetails>('ui-details', { items });
    const root = el.shadowRoot!;
    expect(root.querySelectorAll('dt')).toHaveLength(8);
    expect(root.querySelector('dd.missing')!.textContent).toBe('Not known');
    const more = root.querySelector('button')!;
    expect(more.textContent).toBe('2 more details');
    more.click();
    await settle(el);
    expect(root.querySelectorAll('dt')).toHaveLength(10);
    expect(root.querySelector('button')!.textContent).toBe('Fewer details');
  });
});

describe('ui-timeline', () => {
  const now = new Date('2026-10-29T15:00:00');
  it('names days in words', () => {
    expect(dayWords(new Date('2026-10-29T09:00:00'), now)).toBe('Today');
    expect(dayWords(new Date('2026-10-28T09:00:00'), now)).toBe('Yesterday');
    expect(dayWords(new Date('2026-10-27T09:00:00'), now)).toBe('Tue 27 Oct');
  });

  it('groups by day, newest first, and keeps the earlier ones behind a button', async () => {
    const items = ['2026-10-29T09:00:00', '2026-10-29T11:30:00', '2026-10-28T10:00:00', '2026-10-27T10:00:00', '2026-10-26T10:00:00', '2026-10-25T10:00:00'].map((at, i) => ({ at, who: 'Dana', what: `did ${i}` }));
    const el = await make<UiTimeline>('ui-timeline', { items, now });
    const root = el.shadowRoot!;
    expect([...root.querySelectorAll('.day')].map((d) => d.textContent)).toEqual(['Today', 'Yesterday', 'Tue 27 Oct', 'Mon 26 Oct']);
    expect(root.querySelector('.ev')!.textContent).toContain('did 1');
    expect(root.querySelectorAll('.ev')).toHaveLength(5);
    root.querySelector('button')!.click();
    await settle(el);
    expect(root.querySelectorAll('.ev')).toHaveLength(6);
  });
});

describe('ui-path', () => {
  it('marks where you are, and opens the steps above', async () => {
    const steps = [
      { id: 'o', floor: 'org' as const, title: 'Keep the coast watched' },
      { id: 't', floor: 'team' as const, title: 'Keep the fleet at sea', mark: 'Main effort' },
      { id: 'y', floor: 'personal' as const, title: 'Refit Hull 4', here: true },
    ];
    const el = await make<UiPath>('ui-path', { steps });
    const root = el.shadowRoot!;
    expect(root.querySelector('[aria-current="step"]')!.textContent).toContain('Refit Hull 4');
    expect(root.querySelectorAll('button')).toHaveLength(2);
    const open = vi.fn();
    el.addEventListener('ui-open', open);
    root.querySelectorAll('button')[1]!.click();
    expect(open.mock.calls[0]![0].detail.step.id).toBe('t');
  });
});
