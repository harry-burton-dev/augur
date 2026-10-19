import { describe, expect, it, vi } from 'vitest';
import './select.js';
import './toggle.js';
import './checkbox-group.js';
import type { UiSelect } from './select.js';
import type { UiToggle } from './toggle.js';
import type { UiCheckboxGroup } from './checkbox-group.js';

const mount = async <T extends HTMLElement & { updateComplete: Promise<boolean> }>(markup: string, tag: string, props: Record<string, unknown> = {}) => {
  document.body.innerHTML = markup;
  const el = document.body.querySelector(tag) as T;
  Object.assign(el, props);
  await el.updateComplete;
  return el;
};
const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));

describe('ui-select', () => {
  const options = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Bravo', disabled: true }, { value: 'c', label: 'Charlie', detail: '3 people' }];

  it('opens with the keys, skips options that can’t be picked, and picks with Enter', async () => {
    const el = await mount<UiSelect>('<ui-select label="Department"></ui-select>', 'ui-select', { options });
    const change = vi.fn();
    el.addEventListener('ui-change', change);
    const box = el.shadowRoot!.querySelector('.box')!;
    key(box, 'ArrowDown');
    await el.updateComplete;
    expect(el.open).toBe(true);
    expect(box.getAttribute('aria-expanded')).toBe('true');
    key(box, 'ArrowDown');
    key(box, 'Enter');
    await el.updateComplete;
    expect(el.value).toBe('c');
    expect(el.open).toBe(false);
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ detail: { value: 'c' } }));
    expect(el.shadowRoot!.querySelector('.value')!.textContent).toBe('Charlie');
  });

  it('keeps Esc to itself while open', async () => {
    const el = await mount<UiSelect>('<ui-select label="Department"></ui-select>', 'ui-select', { options });
    el.show();
    await el.updateComplete;
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true });
    el.shadowRoot!.querySelector('.box')!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(el.open).toBe(false);
  });

  it('jumps by typing and asks in green when required and empty', async () => {
    const el = await mount<UiSelect>('<ui-select label="Department" required></ui-select>', 'ui-select', { options });
    expect(el.check()).toBe(false);
    await el.updateComplete;
    expect(el.state).toBe('attention');
    key(el.shadowRoot!.querySelector('.box')!, 'c');
    expect(el.value).toBe('c');
    expect(el.state).toBe('idle');
  });

  it('won’t open while loading, read-only or empty', async () => {
    const el = await mount<UiSelect>('<ui-select label="Department" busy></ui-select>', 'ui-select', { options });
    el.show();
    expect(el.open).toBe(false);
    el.busy = false;
    el.readonly = true;
    el.show();
    expect(el.open).toBe(false);
    const empty = await mount<UiSelect>('<ui-select label="Department"></ui-select>', 'ui-select');
    expect(empty.shadowRoot!.textContent).toContain('Nothing to choose yet');
  });
});

describe('ui-toggle', () => {
  it('flips at once and says so', async () => {
    const el = await mount<UiToggle>('<ui-toggle label="Can sign in"></ui-toggle>', 'ui-toggle');
    const button = el.shadowRoot!.querySelector('button')!;
    button.click();
    await el.updateComplete;
    expect(el.checked).toBe(true);
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(el.shadowRoot!.querySelector('.word')!.textContent).toBe('On');
  });

  it('turns back and says why when the change fails', async () => {
    const el = await mount<UiToggle>('<ui-toggle label="Can sign in" checked></ui-toggle>', 'ui-toggle', {
      change: () => Promise.reject(new Error('You can’t turn off your own sign-in.')),
    });
    await el.flip();
    await el.updateComplete;
    expect(el.checked).toBe(true);
    expect(el.busy).toBe(false);
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).toContain('your own sign-in');
  });
});

describe('ui-checkbox-group', () => {
  it('ticks in the options’ order and reports a field value', async () => {
    const el = await mount<UiCheckboxGroup>('<ui-checkbox-group label="Roles" name="roles"></ui-checkbox-group>', 'ui-checkbox-group', { options: ['admin', 'editor'] });
    const boxes = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.box');
    boxes[1].click();
    boxes[0].click();
    await el.updateComplete;
    expect(el.values).toEqual(['admin', 'editor']);
    expect(el.value).toBe('admin,editor');
    expect(boxes[0].getAttribute('aria-checked')).toBe('true');
  });

  it('asks for at least one when required, and stops at the most', async () => {
    const el = await mount<UiCheckboxGroup>('<ui-checkbox-group label="Copy" required max="1"></ui-checkbox-group>', 'ui-checkbox-group', { options: ['a', 'b'] });
    expect(el.check()).toBe(false);
    expect(el.message).toBe('Needs you.');
    const boxes = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.box');
    boxes[0].click();
    await el.updateComplete;
    boxes[1].click();
    expect(el.values).toEqual(['a']);
    expect(el.check()).toBe(true);
    expect(el.shadowRoot!.textContent).toContain('the most you can choose');
  });
});
