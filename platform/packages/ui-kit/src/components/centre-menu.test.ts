import { beforeEach, describe, expect, it, vi } from 'vitest';
import './centre-menu.js';
import { searchMenu, type MenuCategory, type UiCentreMenu } from './centre-menu.js';

const categories: MenuCategory[] = [
  { label: 'Home', icon: 'home', items: [{ label: 'Welcome', icon: 'star', detail: 'Start here' }, { label: 'Recent', icon: 'clock' }] },
  {
    label: 'Documents',
    icon: 'folder',
    items: [
      { label: 'Reports', icon: 'document', detail: 'Updated today', options: [{ label: 'Pin to Home' }, { label: 'Information' }] },
      { label: 'Drafts', icon: 'document', keywords: 'unfinished' },
    ],
  },
  { label: 'Assistant', icon: 'agents', ai: true, items: [{ label: 'Ask', icon: 'agents', ai: true }] },
];

let el: UiCentreMenu;
const root = () => el.shadowRoot!;
const menu = () => root().querySelector<HTMLElement>('.menu')!;
const press = async (key: string, init: KeyboardEventInit = {}) => {
  menu().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await el.updateComplete;
};
const caption = () => root().querySelector('.caption .title')!.textContent;
const catLabel = () => root().querySelector('.catlabel')!.textContent!.trim();

beforeEach(async () => {
  document.body.innerHTML = '<div style="position:relative;width:1000px;height:640px"><ui-centre-menu></ui-centre-menu></div>';
  el = document.querySelector('ui-centre-menu')!;
  el.categories = categories;
  await el.updateComplete;
});

describe('searchMenu', () => {
  it('finds items by label, keywords and category across every category', () => {
    expect(searchMenu(categories, 'rep').map((e) => e.item.label)).toEqual(['Reports']);
    expect(searchMenu(categories, 'unfinished').map((e) => e.item.label)).toEqual(['Drafts']);
    expect(searchMenu(categories, 'documents').map((e) => e.item.label)).toEqual(['Reports', 'Drafts']);
  });
});

describe('ui-centre-menu', () => {
  it('names only the focused category and item', () => {
    expect(catLabel()).toBe('Home');
    expect(caption()).toBe('Welcome');
    expect(root().querySelector('.caption .detail')!.textContent).toBe('Start here');
    expect(root().querySelectorAll('.cat')).toHaveLength(3);
    expect(root().querySelectorAll('.item')).toHaveLength(2);
  });

  it('moves across categories and down items, wrapping round the orbit', async () => {
    await press('ArrowRight');
    expect(catLabel()).toBe('Documents');
    await press('ArrowDown');
    expect(caption()).toBe('Drafts');
    await press('ArrowDown');
    expect(caption()).toBe('Drafts');
    await press('ArrowLeft');
    await press('ArrowLeft');
    expect(catLabel()).toBe('Assistant');
  });

  it('remembers the focused item in each category', async () => {
    await press('ArrowRight');
    await press('ArrowDown');
    await press('ArrowLeft');
    await press('ArrowRight');
    expect(caption()).toBe('Drafts');
  });

  it('opens the focused item with Enter', async () => {
    const select = vi.fn();
    el.addEventListener('ui-select', (e) => select((e as CustomEvent).detail));
    await press('ArrowRight');
    await press('Enter');
    expect(select).toHaveBeenCalledWith({ item: categories[1].items[0], category: categories[1] });
  });

  it('searches every category as you type, and Esc clears before going back', async () => {
    const back = vi.fn();
    el.addEventListener('ui-back', back);
    await press('d');
    await press('r');
    expect(catLabel()).toBe('“dr”');
    expect(caption()).toBe('Drafts');
    expect(root().querySelector('.caption .detail')!.textContent).toBe('Documents');
    await press('Backspace');
    expect(catLabel()).toBe('“d”');
    await press('Escape');
    expect(catLabel()).toBe('Home');
    expect(back).not.toHaveBeenCalled();
    await press('Escape');
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('says so when nothing matches', async () => {
    await press('z');
    await press('z');
    expect(caption()).toBe('No matches');
  });

  it('keeps options behind the context-menu key', async () => {
    const option = vi.fn();
    el.addEventListener('ui-option', (e) => option((e as CustomEvent).detail.option.label));
    expect(root().querySelector('.options')).toBeNull();
    await press('ArrowRight');
    await press('ContextMenu');
    expect([...root().querySelectorAll('.opt')].map((o) => o.textContent!.trim())).toEqual(['Pin to Home', 'Information']);
    await press('ArrowDown');
    await press('Enter');
    expect(option).toHaveBeenCalledWith('Information');
    expect(root().querySelector('.options')).toBeNull();
  });

  it('draws AI categories and items as bubbles', () => {
    const icons = [...root().querySelectorAll('.cat ui-icon')];
    expect(icons.map((i) => i.hasAttribute('bubble'))).toEqual([false, false, true]);
  });

  it('reports each move', async () => {
    const changes: string[] = [];
    el.addEventListener('ui-change', (e) => changes.push((e as CustomEvent).detail.item?.label));
    await press('ArrowDown');
    await press('ArrowRight');
    expect(changes).toEqual(['Recent', 'Reports']);
  });

  it('numbers chapters and stops at the ends in Title', async () => {
    el.variant = 'title';
    await el.updateComplete;
    expect(catLabel()).toBe('01  /  Home');
    await press('ArrowLeft');
    expect(catLabel()).toBe('01  /  Home');
    el.setCategory(2);
    await el.updateComplete;
    expect(catLabel()).toBe('03  /  Assistant');
  });

  it('starts on the category it is given and swells the water as you move', async () => {
    const pulse = vi.fn();
    el.background = { pulse };
    el.startCategory = 1;
    await el.updateComplete;
    expect(catLabel()).toBe('Documents');
    await press('ArrowDown');
    await press('ArrowRight');
    expect(pulse.mock.calls.map((c) => c[0])).toEqual([0.3, 1]);
  });
});
