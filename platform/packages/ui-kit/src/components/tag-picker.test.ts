import { beforeEach, describe, expect, it } from 'vitest';
import './tag-picker.js';
import type { UiTagPicker } from './tag-picker.js';

let picker: UiTagPicker;
const root = () => picker.shadowRoot!;
const input = () => root().querySelector('input')!;
const rows = () => [...root().querySelectorAll('[role="option"]')].map((r) => r.querySelector('.word')!.textContent);
const chosen = () => [...root().querySelectorAll('ui-tag')].map((t) => t.label);
const type = async (text: string) => {
  input().value = text;
  input().dispatchEvent(new Event('input'));
  await picker.updateComplete;
};
const key = async (k: string) => {
  input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  await picker.updateComplete;
};

beforeEach(async () => {
  document.body.innerHTML = '<ui-tag-picker label="Tags" name="tags"></ui-tag-picker>';
  picker = document.querySelector('ui-tag-picker')!;
  picker.options = [
    { value: 'fin', label: 'Finance', detail: 'Org' },
    { value: 'pol', label: 'Policy', detail: 'Org' },
    { value: 'trv', label: 'Travel' },
    { value: 'ref', label: 'Refunds' },
  ];
  await picker.updateComplete;
});

describe('ui-tag-picker', () => {
  it('narrows as you type, words that start with it first', async () => {
    input().dispatchEvent(new Event('focus'));
    await picker.updateComplete;
    expect(rows()).toEqual(['Finance', 'Policy', 'Refunds', 'Travel']);
    await type('f');
    expect(rows()).toEqual(['Finance', 'Refunds']);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('picks with Enter, shows what it picked, and collects like a field', async () => {
    const seen: string[][] = [];
    picker.addEventListener('ui-change', (e) => seen.push((e as CustomEvent).detail.values));
    await type('tr');
    await key('Enter');
    // The list stays open after a pick: Finance, then Policy.
    await key('ArrowDown');
    await key('Enter');
    expect(seen).toEqual([['trv'], ['trv', 'pol']]);
    expect(chosen()).toEqual(['Travel', 'Policy']);
    expect(picker.value).toBe('trv,pol');
    expect(rows()).not.toContain('Travel');
    await key('Backspace');
    expect(picker.values).toEqual(['trv']);
  });

  it('offers to add a word that isn’t a tag yet, only when it may', async () => {
    await type('Grants');
    expect(rows()).toEqual([]);
    picker.creatable = true;
    await picker.updateComplete;
    expect(rows()).toEqual(['Add “Grants”']);
    const asked: string[] = [];
    picker.addEventListener('ui-create', (e) => asked.push((e as CustomEvent).detail.name));
    await key('Enter');
    expect(asked).toEqual(['Grants']);
    expect(picker.values).toEqual([]);
    await type('finance');
    expect(rows()).toEqual(['Finance']);
  });

  it('takes a tag off with its ×, and stops at max', async () => {
    picker.values = ['fin', 'pol'];
    picker.max = 2;
    await picker.updateComplete;
    expect(root().querySelector('input')).toBeNull();
    expect(root().querySelector('.full')!.textContent).toBe('2 at most');
    root().querySelector('ui-tag')!.dispatchEvent(new CustomEvent('ui-remove'));
    await picker.updateComplete;
    expect(picker.values).toEqual(['pol']);
    expect(input()).not.toBeNull();
  });
});
