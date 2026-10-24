import { beforeEach, describe, expect, it } from 'vitest';
import './filter-bar.js';
import { filterValue, type FilterDef, type UiFilterBar } from './filter-bar.js';

let bar: UiFilterBar;
const root = () => bar.shadowRoot!;
const buttons = () => [...root().querySelectorAll<HTMLButtonElement>('.open')];
const options = () => [...root().querySelectorAll<HTMLButtonElement>('.opt')];
const chips = () => [...root().querySelectorAll('ui-tag')].map((t) => t.label);
const filters: FilterDef[] = [
  { id: 'tag', label: 'Tags', search: true, options: [{ value: 'fin', label: 'Finance' }, { value: 'pol', label: 'Policy' }, { value: 'trv', label: 'Travel' }] },
  { id: 'type', label: 'Type', options: [{ value: 'pdf', label: 'PDF' }, { value: 'word', label: 'Word' }] },
  { id: 'since', label: 'Changed', single: true, options: [{ value: 'week', label: 'Past week' }, { value: 'month', label: 'Past month' }] },
];

beforeEach(async () => {
  document.body.innerHTML = '<ui-filter-bar label="Filter documents"></ui-filter-bar>';
  bar = document.querySelector('ui-filter-bar')!;
  bar.filters = filters;
  bar.sorts = [{ value: 'title', label: 'Title' }, { value: 'newest', label: 'Newest' }];
  bar.sort = 'title';
  bar.count = 12;
  bar.noun = ['document', 'documents'];
  await bar.updateComplete;
});

describe('ui-filter-bar', () => {
  it('keeps only chosen values its filters know', () => {
    expect(filterValue(filters, { tag: ['fin', 'gone'], type: [], other: ['x'] })).toEqual({ tag: ['fin'] });
  });

  it('shows a button for each filter, the count and the sort', () => {
    expect(buttons().map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Tags', 'Type', 'Changed', 'Sort: Title']);
    expect(root().querySelector('.count')!.textContent).toBe('12 documents');
  });

  it('opens a filter’s choices, narrows a long list, and says each change', async () => {
    const seen: unknown[] = [];
    bar.addEventListener('ui-change', (e) => seen.push((e as CustomEvent).detail));
    buttons()[0].click();
    await bar.updateComplete;
    expect(buttons()[0].getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.textContent!.trim())).toEqual(['Finance', 'Policy', 'Travel']);
    const find = root().querySelector<HTMLInputElement>('.find')!;
    find.value = 'pol';
    find.dispatchEvent(new Event('input'));
    await bar.updateComplete;
    expect(options().map((o) => o.textContent!.trim())).toEqual(['Policy']);
    options()[0].click();
    await bar.updateComplete;
    expect(options()[0].getAttribute('aria-checked')).toBe('true');
    expect(seen).toEqual([{ value: { tag: ['pol'] }, sort: 'title' }]);
    expect(chips()).toEqual(['Policy']);
    expect(buttons()[0].querySelector('.n')!.textContent).toBe('1');
  });

  it('takes one time range at a time, and closes when one is picked', async () => {
    buttons()[2].click();
    await bar.updateComplete;
    options()[0].click();
    await bar.updateComplete;
    buttons()[2].click();
    await bar.updateComplete;
    options()[1].click();
    await bar.updateComplete;
    expect(bar.value).toEqual({ since: ['month'] });
    expect(bar.opened).toBe('');
  });

  it('sorts, takes a chip off with its ×, and clears them all', async () => {
    bar.value = { tag: ['fin', 'trv'], type: ['pdf'] };
    await bar.updateComplete;
    expect(chips()).toEqual(['Finance', 'Travel', 'PDF']);
    root().querySelectorAll('ui-tag')[1].dispatchEvent(new CustomEvent('ui-remove'));
    await bar.updateComplete;
    expect(bar.value).toEqual({ tag: ['fin'], type: ['pdf'] });
    buttons()[3].click();
    await bar.updateComplete;
    options()[1].click();
    await bar.updateComplete;
    expect(bar.sort).toBe('newest');
    root().querySelector<HTMLButtonElement>('.clear')!.click();
    await bar.updateComplete;
    expect(bar.value).toEqual({});
    expect(chips()).toEqual([]);
  });

  it('moves through the choices with the arrows, and Esc goes back to the button', async () => {
    buttons()[1].click();
    await bar.updateComplete;
    const panel = root().querySelector('.panel')!;
    expect(root().activeElement).toBe(options()[0]);
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(root().activeElement).toBe(options()[1]);
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await bar.updateComplete;
    expect(bar.opened).toBe('');
    expect(root().activeElement).toBe(buttons()[1]);
  });
});
