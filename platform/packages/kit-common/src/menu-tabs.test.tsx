// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from './icon-button.js';
import { Menu } from './menu.js';
import { Tab, TabList, TabPanel, Tabs } from './tabs.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const draw = (node: ReactNode) => {
  document.body.replaceChildren(document.createElement('div'));
  root = createRoot(document.body.firstElementChild!);
  act(() => root!.render(node));
};
afterEach(() => act(() => root?.unmount()));

describe('Menu', () => {
  it('opens from its button, shows why an item is unavailable, and picks by its key', () => {
    const onAction = vi.fn();
    draw(
      <Menu
        label="Collection actions"
        onAction={onAction}
        items={[{ id: 'rename', label: 'Rename', key: 'R' }, { id: 'move', label: 'Move', disabled: true, reason: 'It has no other library to go to.' }, '-', { id: 'delete', label: 'Delete', danger: true }]}
      >
        <IconButton icon="more" label="More" />
      </Menu>,
    );
    act(() => document.querySelector<HTMLButtonElement>('button')!.click());
    const menu = document.querySelector('[role="menu"]')!;
    expect(menu.getAttribute('aria-label')).toBe('Collection actions');
    expect(menu.textContent).toContain('It has no other library to go to.');
    act(() => {
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    });
    expect(onAction).toHaveBeenCalledWith('rename');
  });
});

describe('Tabs', () => {
  it('says why in place of an unavailable tab’s content', () => {
    draw(
      <Tabs defaultSelected="history" unavailable={{ history: 'Only the library’s owner sees its history.' }}>
        <TabList label="Collection views">
          <Tab id="records">Records</Tab>
          <Tab id="history">History</Tab>
        </TabList>
        <TabPanel id="records">The records</TabPanel>
        <TabPanel id="history">The history</TabPanel>
      </Tabs>,
    );
    const panel = document.querySelector('[role="tabpanel"]')!;
    expect(panel.textContent).toBe('Only the library’s owner sees its history.');
  });
});
