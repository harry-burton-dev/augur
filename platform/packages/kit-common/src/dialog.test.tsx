// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './dialog.js';
import { TextField } from './text-field.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const draw = (node: ReactNode) => {
  document.body.replaceChildren(document.createElement('div'));
  root = createRoot(document.body.firstElementChild!);
  act(() => root!.render(node));
};
afterEach(() => act(() => root?.unmount()));
const primary = () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Create')!;
const type = (input: HTMLInputElement, text: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('Dialog', () => {
  it('checks every field before it acts, then closes with the values', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    draw(
      <Dialog open heading="New collection" actionLabel="Create" onClose={onClose} onSubmit={onSubmit} fields={<TextField label="Name" name="name" required />} />,
    );
    const input = document.querySelector('input')!;
    await act(async () => primary().click());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.querySelector('.augur-field')!.getAttribute('data-state')).toBe('attention');
    type(input, 'Plans');
    await act(async () => primary().click());
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Plans' });
    expect(onClose).toHaveBeenCalledWith({ name: 'Plans' });
  });

  it('stays open and says why when the action fails', async () => {
    const onClose = vi.fn();
    draw(<Dialog open heading="Publish" actionLabel="Create" onClose={onClose} onSubmit={() => Promise.reject(new Error('The library is read-only now.'))} />);
    await act(async () => primary().click());
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('The library is read-only now.');
  });
});
