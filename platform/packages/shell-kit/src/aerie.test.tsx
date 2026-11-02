// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ms } from '@augur/kit-common';
import { AppUnavailable } from './app-unavailable.js';
import { Toasts } from './toast.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const draw = (node: ReactNode) => {
  document.body.replaceChildren(document.createElement('div'));
  root = createRoot(document.body.firstElementChild!);
  act(() => root!.render(node));
};
afterEach(() => {
  act(() => root?.unmount());
  vi.useRealTimers();
});

describe('Toasts', () => {
  it('go by themselves after motion-toast, but not while hovered', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    draw(<Toasts toasts={[{ id: 'a', text: 'Archived 3 records' }]} onDone={onDone} />);
    const toast = document.querySelector('li')!;
    act(() => {
      toast.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(ms('motion-toast') + 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      toast.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(ms('motion-toast') + 1));
    expect(onDone).toHaveBeenCalledWith('a');
  });
});

describe('AppUnavailable', () => {
  it('says why an app can’t show, instead of hiding it', () => {
    draw(<AppUnavailable app={{ name: 'Data Atlas', icon: 'atlas' }} state="limited" reason="It’s only on department floors." />);
    expect(document.body.textContent).toContain('Not on this floor');
    expect(document.body.textContent).toContain('It’s only on department floors.');
  });
});
