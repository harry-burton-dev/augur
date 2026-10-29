import { describe, expect, it, vi } from 'vitest';
import './people-picker.js';
import type { Principal, UiPeoplePicker } from './people-picker.js';
import type { UiList } from './list.js';
import type { UiRefs } from './ref.js';

const PEOPLE: Principal[] = [
  { kind: 'person', id: 'u1', name: 'Nora Briggs', detail: 'Northern ports' },
  { kind: 'team', id: 't1', name: 'Northern ports', size: 12 },
  { kind: 'team', id: 't2', name: 'Northern logistics', detail: 'In Finance' },
];

const mount = async (props: Partial<UiPeoplePicker> = {}) => {
  const el = document.createElement('ui-people-picker') as UiPeoplePicker;
  el.search = vi.fn(async (q: string) => PEOPLE.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())));
  Object.assign(el, props);
  document.body.replaceChildren(el);
  await el.updateComplete;
  return el;
};
const list = (el: UiPeoplePicker) => el.shadowRoot!.querySelector('ui-list') as UiList;

describe('ui-people-picker', () => {
  it('finds people and teams, says each one’s team or size, and keeps the ones you can’t add with why', async () => {
    const el = await mount({ check: (p) => (p.id === 't2' ? 'Can’t see this library. Its owner can add it.' : undefined) });
    await el.find('nor');
    await el.updateComplete;
    const items = list(el).items;
    expect(items.map((i) => [i.title, i.detail])).toEqual([
      ['Nora Briggs', 'Northern ports'],
      ['Northern ports', '12 people'],
      ['Northern logistics', 'In Finance'],
    ]);
    expect(items[2]).toMatchObject({ disabled: true, reason: 'Can’t see this library. Its owner can add it.' });
  });

  it('hands over one choice and empties for the next', async () => {
    const el = await mount();
    const pick = vi.fn();
    el.addEventListener('ui-pick', pick);
    await el.find('nora');
    await el.updateComplete;
    list(el).dispatchEvent(new CustomEvent('ui-open', { detail: { item: list(el).items[0] } }));
    await el.updateComplete;
    expect(pick.mock.calls[0]![0].detail.principal.id).toBe('u1');
    expect(el.query).toBe('');
    expect(list(el)).toBeNull();
  });

  it('gathers choices as chips you can take off, with multiple', async () => {
    const el = await mount({ multiple: true, kinds: 'teams' });
    await el.find('nor');
    await el.updateComplete;
    expect(list(el).items.map((i) => i.title)).toEqual(['Northern ports', 'Northern logistics']);
    list(el).dispatchEvent(new CustomEvent('ui-open', { detail: { item: list(el).items[0] } }));
    await el.updateComplete;
    expect(el.value.map((p) => p.name)).toEqual(['Northern ports']);
    const chips = el.shadowRoot!.querySelector('ui-refs') as UiRefs;
    chips.dispatchEvent(new CustomEvent('ui-remove', { detail: { ref: { kind: 'team', id: 't1' } } }));
    expect(el.value).toEqual([]);
  });

  it('says when it couldn’t look', async () => {
    const el = await mount({ search: async () => Promise.reject(new Error('People are out of reach.')) });
    await el.find('x');
    await el.updateComplete;
    expect(list(el).error).toBe('People are out of reach.');
  });
});
