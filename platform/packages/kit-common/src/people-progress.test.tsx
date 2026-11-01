// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { initials, People } from './person.js';
import { Progress, Steps } from './progress.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const draw = (node: ReactNode) => {
  document.body.replaceChildren(document.createElement('div'));
  root = createRoot(document.body.firstElementChild!);
  act(() => root!.render(node));
};
afterEach(() => act(() => root?.unmount()));

describe('People', () => {
  it('takes first and last initials', () => {
    expect(initials('Sam Ortiz')).toBe('SO');
    expect(initials('  ada  ')).toBe('A');
    expect(initials('Mary Ann de la Cruz')).toBe('MC');
  });

  it('reads every name aloud, even past the "+N"', () => {
    draw(<People label="Shared with" max={2} people={[{ name: 'Sam Ortiz' }, { name: 'Priya Shah' }, { name: 'Lee Park' }]} />);
    const group = document.querySelector('[role="img"]')!;
    expect(group.getAttribute('aria-label')).toBe('Shared with: Sam Ortiz, Priya Shah, Lee Park');
    expect(group.textContent).toContain('+1');
  });
});

describe('Progress', () => {
  it('says how far it has got, or runs when it can’t know', () => {
    draw(<Progress label="Uploading" value={40} valueText="2 of 5" />);
    const bar = document.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.getAttribute('aria-valuetext')).toBe('2 of 5');
    draw(<Progress label="Reading" />);
    expect(document.querySelector('[role="progressbar"]')!.hasAttribute('aria-valuenow')).toBe(false);
  });

  it('marks the step it is on', () => {
    draw(<Steps label="Extraction" steps={[{ label: 'Read', state: 'done' }, { label: 'Extract', state: 'now' }, { label: 'Check', state: 'next' }]} />);
    expect(document.querySelector('[aria-current="step"]')!.textContent).toBe('Extract');
  });
});
