import { beforeEach, describe, expect, it, vi } from 'vitest';
import './dialog.js';
import './text-field.js';
import type { UiDialog } from './dialog.js';
import type { UiTextField } from './text-field.js';

let el: UiDialog;
let field: UiTextField;

beforeEach(async () => {
  document.body.innerHTML = `
    <ui-dialog heading="Publish the document" action-label="Publish" busy-label="Publishing…">
      <p>It goes to everyone in Finance.</p>
      <ui-text-field slot="fields" name="note" label="Note to readers" required></ui-text-field>
    </ui-dialog>`;
  el = document.body.querySelector('ui-dialog') as UiDialog;
  field = document.body.querySelector('ui-text-field') as UiTextField;
  await el.updateComplete;
  await field.updateComplete;
});

const fill = async (value: string) => {
  field.value = value;
  await field.updateComplete;
};

describe('ui-dialog', () => {
  it('opens and closes the native dialog', async () => {
    el.show();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('dialog')!.hasAttribute('open')).toBe(true);
    el.close();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('dialog')!.hasAttribute('open')).toBe(false);
  });

  it('will not submit while a required field is empty', async () => {
    const submit = vi.fn();
    el.submit = submit;
    el.show();
    await el.updateComplete;
    expect(await el.confirm()).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    expect(field.state).toBe('attention');
  });

  it('submits field values by name and closes', async () => {
    const onClose = vi.fn();
    el.addEventListener('ui-close', onClose);
    el.submit = vi.fn();
    el.show();
    await fill('Please read before Friday');
    expect(await el.confirm()).toBe(true);
    expect(el.submit).toHaveBeenCalledWith({ note: 'Please read before Friday' }, el);
    expect(onClose.mock.calls[0][0].detail.result).toEqual({ note: 'Please read before Friday' });
    expect(el.open).toBe(false);
  });

  it('stays open and shows the message when submit fails', async () => {
    el.submit = () => Promise.reject(new Error('Nothing was changed; try again.'));
    el.show();
    await fill('x');
    expect(await el.confirm()).toBe(false);
    expect(el.open).toBe(true);
    expect(el.error).toBe('Nothing was changed; try again.');
  });

  it('stays open when submit returns false', async () => {
    el.submit = () => false;
    el.show();
    await fill('x');
    expect(await el.confirm()).toBe(false);
    expect(el.open).toBe(true);
  });

  it('ignores Esc while working', async () => {
    let finish!: () => void;
    el.submit = () => new Promise<void>((r) => (finish = r));
    el.show();
    await fill('x');
    const done = el.confirm();
    await Promise.resolve();
    expect(el.busy).toBe(true);
    el.shadowRoot!.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(el.open).toBe(true);
    finish();
    expect(await done).toBe(true);
  });

  it('closes as cancelled on Esc', async () => {
    const onClose = vi.fn();
    el.addEventListener('ui-close', onClose);
    el.show();
    await el.updateComplete;
    el.shadowRoot!.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onClose.mock.calls[0][0].detail.result).toBeNull();
  });
});
