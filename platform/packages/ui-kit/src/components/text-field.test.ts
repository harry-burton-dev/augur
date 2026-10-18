import { describe, expect, it, vi } from 'vitest';
import './text-field.js';
import type { UiTextField } from './text-field.js';

const mount = async (markup: string) => {
  document.body.innerHTML = markup;
  const el = document.body.querySelector('ui-text-field') as UiTextField;
  await el.updateComplete;
  return el;
};
const input = (el: UiTextField) => el.shadowRoot!.querySelector('input')!;
const type = async (el: UiTextField, text: string) => {
  input(el).value = text;
  input(el).dispatchEvent(new Event('input'));
  await el.updateComplete;
};

describe('ui-text-field', () => {
  it('links the label to the input', async () => {
    const el = await mount('<ui-text-field label="Title"></ui-text-field>');
    const label = el.shadowRoot!.querySelector('label')!;
    expect(label.htmlFor).toBe(input(el).id);
  });

  it('asks in green, not red, when a required field is empty', async () => {
    const el = await mount('<ui-text-field label="Title" required></ui-text-field>');
    expect(el.check()).toBe(false);
    await el.updateComplete;
    expect(el.state).toBe('attention');
    expect(el.message).toBe('Needs you.');
    expect(input(el).getAttribute('aria-invalid')).toBe('true');
  });

  it('clears "needs you" as soon as you type', async () => {
    const el = await mount('<ui-text-field label="Title" required></ui-text-field>');
    el.check();
    await type(el, 'Q3 policy');
    expect(el.state).toBe('idle');
    expect(el.value).toBe('Q3 policy');
  });

  it('runs the validator and shows its message', async () => {
    const el = await mount('<ui-text-field label="Email"></ui-text-field>');
    el.validate = (v) => (v.includes('@') ? null : { state: 'error', message: 'That email is missing its domain' });
    await type(el, 'harry');
    expect(el.check()).toBe(false);
    expect(el.state).toBe('error');
    expect(el.message).toContain('domain');
  });

  it('treats a warning as passing', async () => {
    const el = await mount('<ui-text-field label="Title"></ui-text-field>');
    el.validate = () => ({ state: 'warning', message: 'Long titles get cut off' });
    await type(el, 'x'.repeat(90));
    expect(el.check()).toBe(true);
    expect(el.state).toBe('warning');
  });

  it('emits ui-input with the value', async () => {
    const el = await mount('<ui-text-field label="Title"></ui-text-field>');
    const onInput = vi.fn();
    el.addEventListener('ui-input', onInput);
    await type(el, 'abc');
    expect(onInput.mock.calls[0][0].detail).toEqual({ value: 'abc' });
  });

  it('shows a count when maxlength is set', async () => {
    const el = await mount('<ui-text-field label="Summary" maxlength="140"></ui-text-field>');
    await type(el, 'hello');
    expect(el.shadowRoot!.querySelector('.count')!.textContent).toContain('5 / 140');
  });
});
