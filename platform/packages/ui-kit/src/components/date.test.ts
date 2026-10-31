import { describe, expect, it, vi } from 'vitest';
import './date.js';
import { dayDistance, dayName, parseDay } from './date.js';
import type { UiDate } from './date.js';

// Thursday 29 October 2026.
const now = new Date(2026, 9, 29, 15, 0);

describe('parseDay', () => {
  it.each([
    ['13 nov', '2026-11-13'],
    ['13 November 2027', '2027-11-13'],
    ['nov 13', '2026-11-13'],
    ['Fri 13 Nov 2026', '2026-11-13'],
    ['13/11', '2026-11-13'],
    ['13/11/27', '2027-11-13'],
    ['2026-11-13', '2026-11-13'],
    ['today', '2026-10-29'],
    ['tomorrow', '2026-10-30'],
    ['friday', '2026-10-30'],
    ['thursday', '2026-11-05'],
    ['end of week', '2026-10-30'],
    ['end of month', '2026-10-31'],
    ['+2w', '2026-11-12'],
    ['-1d', '2026-10-28'],
    ['+1m', '2026-11-29'],
  ])('reads “%s”', (text, iso) => expect(parseDay(text, now)).toBe(iso));

  it.each(['31 feb', 'soon', '13', '2026-13-01', 'nov'])('refuses “%s”', (text) => expect(parseDay(text, now)).toBeNull());
});

describe('day words', () => {
  it('names the day, and how far it is', () => {
    expect(dayName('2026-11-13', now)).toBe('Fri 13 Nov');
    expect(dayName('2027-01-04', now)).toBe('Mon 4 Jan 2027');
    expect(dayDistance('2026-11-13', now)).toBe('in 15 days');
    expect(dayDistance('2026-10-26', now)).toBe('3 days ago');
    expect(dayDistance('2026-10-29', now)).toBe('today');
  });
});

describe('ui-date', () => {
  const mount = async (props: Partial<UiDate> = {}) => {
    const el = document.createElement('ui-date') as UiDate;
    el.now = now;
    Object.assign(el, props);
    document.body.replaceChildren(el);
    await el.updateComplete;
    return el;
  };
  const input = (el: UiDate) => el.shadowRoot!.querySelector<HTMLInputElement>('.input')!;

  it('says the day in words, and reads what you type', async () => {
    const el = await mount({ label: 'Done by', value: '2026-11-13' });
    expect(input(el).value).toBe('Fri 13 Nov · in 15 days');
    const change = vi.fn();
    el.addEventListener('ui-change', change);
    input(el).dispatchEvent(new Event('focus'));
    await el.updateComplete;
    input(el).value = '+2w';
    input(el).dispatchEvent(new Event('input'));
    input(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await el.updateComplete;
    expect(el.value).toBe('2026-11-12');
    expect(change.mock.calls[0]![0].detail.value).toBe('2026-11-12');
    expect(input(el).value).toBe('Thu 12 Nov · in 14 days');
  });

  it('says how to write a day it can’t read, and won’t pass a dialog’s check', async () => {
    const el = await mount({ label: 'Seen' });
    input(el).dispatchEvent(new Event('focus'));
    input(el).value = 'soonish';
    input(el).dispatchEvent(new Event('input'));
    expect(el.check()).toBe(false);
    await el.updateComplete;
    expect(el.state).toBe('error');
    expect(el.shadowRoot!.querySelector('.msg')!.textContent).toContain('friday');
  });

  it('offers quick choices, and Clear when it isn’t required', async () => {
    const el = await mount({ label: 'Seen', quick: [{ label: 'Today', value: 'today' }, { label: 'Yesterday', value: 'yesterday' }] });
    const quick = () => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.quiet')];
    quick()[1]!.click();
    await el.updateComplete;
    expect(el.value).toBe('2026-10-28');
    expect(quick().map((b) => b.textContent)).toEqual(['Today', 'Yesterday', 'Clear']);
    quick()[2]!.click();
    expect(el.value).toBe('');
  });

  it('asks in green when it’s required and empty', async () => {
    const el = await mount({ label: 'By', required: true });
    expect(el.check()).toBe(false);
    expect(el.state).toBe('attention');
  });
});
