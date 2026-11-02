// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button.js';
import { Icon } from './icon.js';
import { IconButton } from './icon-button.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const host = () => document.body.firstElementChild as HTMLElement;
const draw = (node: ReactNode) => {
  document.body.replaceChildren(document.createElement('div'));
  root = createRoot(host());
  act(() => root!.render(node));
  return host();
};
const press = (el: Element) => act(() => (el as HTMLElement).click());
afterEach(() => act(() => root?.unmount()));

describe('Button', () => {
  it('acts on a press', () => {
    const onPress = vi.fn();
    const button = draw(<Button onPress={onPress}>Publish</Button>).querySelector('button')!;
    expect(button.textContent).toBe('Publish');
    press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says why it is disabled, stays focusable, and does nothing', () => {
    const onPress = vi.fn();
    const el = draw(
      <Button disabled reason="Only an admin can publish here." onPress={onPress}>
        Publish
      </Button>,
    );
    const button = el.querySelector('button')!;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    const said = document.getElementById(button.getAttribute('aria-describedby')!);
    expect(said?.textContent).toBe('Only an admin can publish here.');
    press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is really disabled when it gives no reason', () => {
    expect(draw(<Button disabled>Publish</Button>).querySelector('button')!.disabled).toBe(true);
  });

  it('asks twice before a danger action, and Esc puts it back', () => {
    const onPress = vi.fn();
    const button = draw(
      <Button kind="danger" onPress={onPress}>
        Delete
      </Button>,
    ).querySelector('button')!;
    press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.textContent).toContain('Press again to confirm');
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(button.textContent).toBe('Delete');
    press(button);
    press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('acts on the first press with once', () => {
    const onPress = vi.fn();
    press(draw(<Button kind="danger" once onPress={onPress}>Delete</Button>).querySelector('button')!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says it is working while busy, and takes no second press', () => {
    const onPress = vi.fn();
    const button = draw(<Button busy busyLabel="Publishing" onPress={onPress}>Publish</Button>).querySelector('button')!;
    expect(button.textContent).toBe('Publishing');
    press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('is named for what it does', () => {
    const el = draw(<IconButton icon="close" label="Close" />);
    expect(el.querySelector('button')!.getAttribute('aria-label')).toBe('Close');
    expect(el.querySelector('svg')).not.toBeNull();
  });
});

describe('Icon', () => {
  it('draws nothing for a name it does not know', () => {
    expect(draw(<Icon name="no-such-icon" />).innerHTML).toBe('');
  });

  it('is hidden from readers unless it has a label', () => {
    expect(draw(<Icon name="home" />).querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(draw(<Icon name="home" label="Home" />).querySelector('svg')!.getAttribute('role')).toBe('img');
  });
});
