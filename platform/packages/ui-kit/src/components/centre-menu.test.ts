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
const wheel = async (init: WheelEventInit) => {
  const e = new WheelEvent('wheel', { bubbles: true, composed: true, cancelable: true, ...init });
  if (init.shiftKey) Object.defineProperty(e, 'shiftKey', { value: true }); // happy-dom drops it
  menu().dispatchEvent(e);
  await el.updateComplete;
};
const pointer = (type: string, x: number, y: number) =>
  menu().dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, button: 0, pointerId: 1, clientX: x, clientY: y }));
/** Press at the first point, move slowly through the rest (no throw), let go. */
const drag = async (...points: [number, number][]) => {
  let t = 0;
  const now = vi.spyOn(performance, 'now').mockImplementation(() => (t += 100));
  pointer('pointerdown', ...points[0]);
  for (const p of points.slice(1)) pointer('pointermove', ...p);
  pointer('pointerup', ...points[points.length - 1]);
  now.mockRestore();
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

  it('moves one item per notch of a mouse wheel, and sideways with Shift', async () => {
    await wheel({ deltaY: 100 });
    expect(caption()).toBe('Recent');
    await wheel({ deltaY: -100 });
    expect(caption()).toBe('Welcome');
    await wheel({ deltaY: 100, shiftKey: true });
    expect(catLabel()).toBe('Documents');
  });

  it('follows a trackpad continuously, then settles on the nearest item', async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 6; i++) await wheel({ deltaY: 7.5 }); // 45px, three quarters of an item
      expect(root().querySelector('.menu')!.classList.contains('moving')).toBe(true);
      expect(caption()).toBe('Recent'); // the focus follows the nearest item while moving
      vi.advanceTimersByTime(200);
      await el.updateComplete;
      expect(root().querySelector('.menu')!.classList.contains('moving')).toBe(false);
      expect(caption()).toBe('Recent');
      for (let i = 0; i < 6; i++) await wheel({ deltaX: 21.5 }); // 129px across, about one category
      vi.advanceTimersByTime(200);
      await el.updateComplete;
      expect(catLabel()).toBe('Documents');
    } finally {
      vi.useRealTimers();
    }
  });

  it('drags on both axes, locked to the first one moved', async () => {
    await drag([500, 300], [500, 290], [503, 270], [505, 240]); // up, with a little drift sideways
    expect(caption()).toBe('Recent');
    expect(catLabel()).toBe('Home');
    await drag([500, 300], [490, 300], [400, 302], [355, 305]); // left, about one category
    expect(catLabel()).toBe('Documents');
  });

  it('slides between apps when Title is dragged sideways, and stops at the ends', async () => {
    el.variant = 'title';
    await el.updateComplete;
    await drag([500, 300], [490, 300], [380, 300], [370, 300]);
    expect(catLabel()).toBe('02  /  Documents');
    await drag([500, 300], [510, 300], [900, 300], [1400, 300]);
    expect(catLabel()).toBe('01  /  Home');
  });

  it('keeps a press that moves less than 6px a click', async () => {
    const select = vi.fn();
    el.addEventListener('ui-select', select);
    await drag([500, 300], [503, 302]);
    (root().querySelectorAll<HTMLElement>('.item')[0]).click();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('is a tablist of categories controlling a listbox of items', async () => {
    const tabs = [...root().querySelectorAll('[role=tab]')];
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    const list = root().querySelector('[role=listbox]')!;
    expect(tabs[0].getAttribute('aria-controls')).toBe(list.id);
    expect(list.getAttribute('aria-label')).toBe('Home');
    const options = [...list.querySelectorAll('[role=option]')];
    expect(list.getAttribute('aria-activedescendant')).toBe(options[0].id);
    await press('ArrowDown');
    expect(list.getAttribute('aria-activedescendant')).toBe(options[1].id);
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    el.focus();
    expect(root().activeElement).toBe(list);
  });

  it('keeps every icon it shows at least 55% opaque', async () => {
    const many: MenuCategory[] = Array.from({ length: 8 }, (_, i) => ({
      label: `C${i}`,
      items: Array.from({ length: 8 }, (_, j) => ({ label: `I${i}.${j}` })),
    }));
    for (const variant of ['orbit', 'title'] as const) {
      el.variant = variant;
      el.categories = many;
      el.setCategory(3);
      el.setItem(3);
      await el.updateComplete;
      const opacities = [...root().querySelectorAll<HTMLElement>('.cat, .item')].map((n) => Number(n.style.opacity));
      expect(opacities.filter((o) => o > 0 && o < 0.55), variant).toEqual([]);
    }
  });

  it('opens a category with no items as a choice by itself, and finds it by name', async () => {
    const select = vi.fn();
    el.addEventListener('ui-select', (e) => select((e as CustomEvent).detail.item));
    el.variant = 'title';
    el.categories = [...categories, { id: 'notes', label: 'Notes', icon: 'document', detail: 'Jottings', keywords: 'memo', items: [] }];
    el.setCategory(3);
    await el.updateComplete;
    expect(root().querySelectorAll('.item')).toHaveLength(0);
    expect(caption()).toBe('Notes');
    expect(root().querySelector('.caption .detail')!.textContent).toBe('Jottings');
    await press('Enter');
    expect(select).toHaveBeenLastCalledWith({ id: 'notes', label: 'Notes', icon: 'document', detail: 'Jottings', keywords: 'memo', ai: undefined });
    root().querySelectorAll<HTMLElement>('.cat')[3].click();
    expect(select).toHaveBeenCalledTimes(2);
    expect(searchMenu(el.categories, 'memo').map((e) => e.item.label)).toEqual(['Notes']);
  });

  it('names the section a category is in, in Orbit', async () => {
    el.categories = categories.map((c, i) => ({ ...c, section: i < 2 ? 'Work' : 'Help' }));
    await el.updateComplete;
    expect(catLabel()).toBe('Work  /  Home');
    await press('ArrowLeft');
    expect(catLabel()).toBe('Help  /  Assistant');
  });
});
