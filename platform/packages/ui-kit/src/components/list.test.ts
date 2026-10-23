import { beforeEach, describe, expect, it, vi } from 'vitest';
import './list.js';
import type { ListItem, UiList } from './list.js';

let list: UiList;
const root = () => list.shadowRoot!;
const rows = () => [...root().querySelectorAll<HTMLButtonElement>('.row')];
const items: ListItem[] = [
  { id: 'a', title: 'Approve the travel policy', detail: 'Library · Sam asked', meta: '4 min', status: 'needs', group: 'Needs you', actions: [{ id: '0', label: 'Approve' }, { id: '1', label: 'Open' }, { id: '2', label: 'Dropped' }] },
  { id: 'b', title: 'Sign the claim', meta: '1 h', status: 'needs', group: 'Needs you' },
  { id: 'c', title: 'Expenses guide published', status: 'done', group: 'Earlier', disabled: true },
];

beforeEach(async () => {
  document.body.innerHTML = '<ui-list label="What needs you"></ui-list>';
  list = document.querySelector('ui-list')!;
  list.noun = ['thing', 'things'];
  list.items = items;
  await list.updateComplete;
});

describe('ui-list', () => {
  it('counts what’s there, groups the rows and pings only the first that needs you', () => {
    expect(root().querySelector('.bar')!.textContent).toBe('3 things');
    expect([...root().querySelectorAll('.group')].map((g) => [g.textContent, g.classList.contains('needs')])).toEqual([['Needs you', true], ['Earlier', false]]);
    expect(root().querySelectorAll('.lead.first')).toHaveLength(1);
    expect(rows()[0].querySelector('.lead')!.classList.contains('first')).toBe(true);
  });

  it('opens a row, and does a row’s action, at most two of them', () => {
    const seen: string[] = [];
    list.addEventListener('ui-open', (e) => seen.push(`open ${(e as CustomEvent).detail.item.id}`));
    list.addEventListener('ui-action', (e) => seen.push(`act ${(e as CustomEvent).detail.item.id} ${(e as CustomEvent).detail.action.label}`));
    const acts = [...root().querySelectorAll<HTMLButtonElement>('.act')];
    expect(acts.map((b) => b.textContent)).toEqual(['Approve', 'Open']);
    acts[0].click();
    rows()[1].click();
    rows()[2].click();
    expect(seen).toEqual(['act a Approve', 'open b']);
  });

  it('moves between rows with the arrows, skipping what can’t be opened', async () => {
    rows()[0].focus();
    rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    expect(root().activeElement).toBe(rows()[1]);
    rows()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    expect(root().activeElement).toBe(rows()[1]);
    rows()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
    expect(root().activeElement).toBe(rows()[0]);
  });

  it('says when there’s nothing, while it loads, and when it failed', async () => {
    list.items = [];
    list.empty = 'Nothing needs you right now.';
    await list.updateComplete;
    expect(root().querySelector('ui-state')!.getAttribute('heading')).toBe('Nothing needs you right now.');
    list.loading = true;
    await list.updateComplete;
    expect(root().querySelectorAll('.skel')).toHaveLength(3);
    list.loading = false;
    list.error = 'Couldn’t load what needs you.';
    await list.updateComplete;
    const retry = vi.fn();
    list.addEventListener('ui-retry', retry);
    const state = root().querySelector('ui-state')!;
    await state.updateComplete;
    state.shadowRoot!.querySelector('button')!.click();
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('ui-state', () => {
  it('waits 300ms before showing that something is loading', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<ui-state kind="loading" heading="Loading"></ui-state>';
    const state = document.querySelector('ui-state')!;
    await state.updateComplete;
    expect(state.shadowRoot!.querySelector('.state')!.classList.contains('hidden')).toBe(true);
    vi.advanceTimersByTime(300);
    await state.updateComplete;
    expect(state.shadowRoot!.querySelector('.state')!.classList.contains('hidden')).toBe(false);
    vi.useRealTimers();
  });

  it('marks an error with the diamond, as an alert, and offers its one action', async () => {
    document.body.innerHTML = '<ui-state kind="error" heading="Couldn’t load" action="Try again"></ui-state>';
    const state = document.querySelector('ui-state')!;
    await state.updateComplete;
    expect(state.shadowRoot!.querySelector('[role=alert] ui-icon')!.getAttribute('name')).toBe('error');
    expect(state.shadowRoot!.querySelector('button')!.textContent).toBe('Try again');
  });
});
