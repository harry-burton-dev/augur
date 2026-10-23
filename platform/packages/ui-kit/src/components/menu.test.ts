import { beforeEach, describe, expect, it, vi } from 'vitest';
import './menu.js';
import type { UiMenu } from './menu.js';

let menu: UiMenu;
let button: HTMLButtonElement;
const items = () => [...menu.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role=menuitem]')];
const key = (k: string) => menu.shadowRoot!.querySelector('[role=menu]')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

beforeEach(async () => {
  document.body.innerHTML = '<button id="more">More</button><ui-menu label="Run actions"></ui-menu>';
  button = document.querySelector('#more')!;
  menu = document.querySelector('ui-menu')!;
  menu.items = [
    { id: 'open', label: 'Open', key: '↵' },
    '-',
    { id: 'rename', label: 'Rename', key: 'N' },
    { id: 'share', label: 'Share', disabled: true },
    '-',
    { id: 'delete', label: 'Delete', danger: true },
  ];
  await menu.updateComplete;
});

describe('ui-menu', () => {
  it('is a menu of menuitems with lines between groups and danger last', async () => {
    await menu.show(button);
    expect(menu.isOpen).toBe(true);
    expect(menu.shadowRoot!.querySelector('[role=menu]')!.getAttribute('aria-label')).toBe('Run actions');
    expect(items().map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Open ↵', 'Rename N', 'Share', 'Delete']);
    expect(menu.shadowRoot!.querySelectorAll('hr')).toHaveLength(2);
    expect(items()[3].classList.contains('danger')).toBe(true);
    expect(menu.shadowRoot!.activeElement).toBe(items()[0]);
  });

  it('moves with the arrows, skipping what can’t be used, and picks with Enter', async () => {
    const picked = vi.fn();
    menu.addEventListener('ui-select', (e) => picked((e as CustomEvent).detail.item.id));
    await menu.show(button);
    key('ArrowDown');
    expect(menu.shadowRoot!.activeElement).toBe(items()[1]);
    key('ArrowDown');
    expect(menu.shadowRoot!.activeElement).toBe(items()[3]);
    key('ArrowDown');
    expect(menu.shadowRoot!.activeElement).toBe(items()[0]);
    key('End');
    (menu.shadowRoot!.activeElement as HTMLButtonElement).click();
    expect(picked).toHaveBeenCalledWith('delete');
    expect(menu.isOpen).toBe(false);
  });

  it('picks an item by its key', async () => {
    const picked = vi.fn();
    menu.addEventListener('ui-select', (e) => picked((e as CustomEvent).detail.item.id));
    await menu.show(button);
    key('n');
    expect(picked).toHaveBeenCalledWith('rename');
  });

  it('Esc closes and puts focus back on the button, without reaching what it opened over', async () => {
    const outer = vi.fn();
    document.body.addEventListener('keydown', outer);
    await menu.show(button);
    key('Escape');
    expect(menu.isOpen).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(outer).not.toHaveBeenCalled();
  });

  it('a click outside closes it; only one menu is open at a time', async () => {
    await menu.show(button);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(menu.isOpen).toBe(false);
    const other = document.createElement('ui-menu') as UiMenu;
    document.body.append(other);
    other.items = [{ id: 'x', label: 'X' }];
    await menu.show(button);
    await other.show(button);
    expect(menu.isOpen).toBe(false);
    expect(other.isOpen).toBe(true);
  });
});
