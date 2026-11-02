// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Choice, Segmented } from './choice.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const draw = (node: ReactNode) => {
  document.body.replaceChildren(document.createElement('div'));
  root = createRoot(document.body.firstElementChild!);
  act(() => root!.render(node));
};
afterEach(() => act(() => root?.unmount()));

describe('Choice', () => {
  it('keeps an unavailable option in the list, says why, and won’t pick it', () => {
    const onChange = vi.fn();
    draw(
      <Choice
        label="Who can read it"
        onChange={onChange}
        options={[
          { value: 'team', label: 'Your team', detail: 'Everyone on your team can read it.' },
          { value: 'org', label: 'Whole organisation', disabled: true, reason: 'Only a department lead can publish here.' },
        ]}
      />,
    );
    const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios).toHaveLength(2);
    expect(document.body.textContent).toContain('Only a department lead can publish here.');
    act(() => radios[1].click());
    expect(onChange).not.toHaveBeenCalled();
    act(() => radios[0].click());
    expect(onChange).toHaveBeenCalledWith('team');
  });
});

describe('Segmented', () => {
  it('always has one on, and names icon-only segments', () => {
    const onChange = vi.fn();
    draw(<Segmented label="View" onChange={onChange} options={[{ value: 'list', label: 'List', icon: 'list', iconOnly: true }, { value: 'grid', label: 'Grid', icon: 'apps', iconOnly: true }]} />);
    const buttons = document.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-label')).toBe('List');
    expect(buttons[0].getAttribute('aria-pressed') ?? buttons[0].getAttribute('aria-checked')).toBe('true');
    act(() => buttons[1].click());
    expect(onChange).toHaveBeenCalledWith('grid');
    act(() => buttons[1].click());
    expect(buttons[1].getAttribute('aria-pressed') ?? buttons[1].getAttribute('aria-checked')).toBe('true');
  });
});
