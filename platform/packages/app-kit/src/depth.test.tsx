// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FocusStage, useRack } from './focus.js';
import { frontSections, FrontPage } from './front-page.js';
import { PathTree, type PathNode } from './path-tree.js';
import { RingProvider, useRingTarget, type RingAction } from './radial-menu.js';
import { Reel } from './reel.js';

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
const key = (el: Element, k: string, extra: KeyboardEventInit = {}) => act(() => void el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra })));

describe('FocusStage', () => {
  function Racks({ on }: { on: boolean }) {
    useRack(on, { x: 10, y: 20, width: 30, height: 40 });
    return <p>Inside</p>;
  }

  it('racks the plane out of focus, keeps the layout and leaves a hole for the subject', () => {
    draw(
      <FocusStage>
        <Racks on />
      </FocusStage>,
    );
    const stage = document.querySelector('.quill-stage')!;
    expect(stage.hasAttribute('data-racked')).toBe(true);
    expect(stage.getAttribute('data-depth')).toBe('veil');
    expect(document.querySelector('.quill-plane')!.hasAttribute('inert')).toBe(true);
    expect((document.querySelector('.quill-rack') as HTMLElement).style.getPropertyValue('--hole-w')).toBe('30px');
    draw(
      <FocusStage depth="lens">
        <Racks on={false} />
      </FocusStage>,
    );
    expect(document.querySelector('.quill-stage')!.hasAttribute('data-racked')).toBe(false);
  });

  it('uses the veil for a hole even when the lens was chosen, since a blurred plane can keep nothing sharp', () => {
    draw(
      <FocusStage depth="lens">
        <Racks on />
      </FocusStage>,
    );
    expect(document.querySelector('.quill-stage')!.getAttribute('data-depth')).toBe('veil');
  });
});

describe('RadialMenu', () => {
  const actions: RingAction[] = [
    { id: 'delete', label: 'Delete', icon: 'delete', danger: true },
    { id: 'open', label: 'Open', icon: 'arrow' },
    { id: 'publish', label: 'Publish up', icon: 'publish', disabled: true, reason: 'Only its leads can publish it' },
  ];
  function Thing({ onAction }: { onAction: (id: string) => void }) {
    const ring = useRingTarget(() => ({ label: 'Sites', actions, onAction }));
    return (
      <button type="button" {...ring}>
        Sites
      </button>
    );
  }
  const open = (onAction = vi.fn()) => {
    draw(
      <FocusStage>
        <RingProvider>
          <Thing onAction={onAction} />
        </RingProvider>
      </FocusStage>,
    );
    const thing = document.querySelector('button')!;
    act(() => void thing.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 })));
    return { thing, onAction };
  };
  const items = () => [...document.querySelectorAll('[role="menuitem"]')] as HTMLElement[];

  it('opens on right-click, racks the app and keeps every action, danger last and the unavailable one saying why', () => {
    open();
    expect(document.querySelector('[role="menu"]')!.getAttribute('aria-label')).toBe('Actions for Sites');
    expect(items().map((i) => i.querySelector('.quill-ring-label')!.textContent)).toEqual(['Open', 'Publish up', 'Delete']);
    expect(items()[1]!.getAttribute('aria-disabled')).toBe('true');
    expect(items()[1]!.textContent).toContain('Only its leads can publish it');
    expect(document.querySelector('.quill-stage')!.hasAttribute('data-racked')).toBe(true);
  });

  it('goes round with the arrows, ignores the unavailable one, and gives the choice once it has closed', () => {
    vi.useFakeTimers();
    const { thing, onAction } = open();
    const menu = document.querySelector('[role="menu"]')!;
    expect(document.activeElement).toBe(items()[0]);
    key(menu, 'ArrowRight');
    expect(document.activeElement).toBe(items()[1]);
    act(() => items()[1]!.click());
    expect(onAction).not.toHaveBeenCalled();
    key(menu, 'ArrowLeft');
    act(() => items()[0]!.click());
    act(() => void vi.runAllTimers());
    expect(onAction).toHaveBeenCalledWith('open');
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(thing);
  });

  it('opens from the keyboard and closes with Esc without choosing', () => {
    vi.useFakeTimers();
    draw(
      <RingProvider>
        <Thing onAction={vi.fn()} />
      </RingProvider>,
    );
    key(document.querySelector('button')!, 'F10', { shiftKey: true });
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    key(document.querySelector('[role="menu"]')!, 'Escape');
    act(() => void vi.runAllTimers());
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('turns into a list past eight actions', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, label: `Action ${i}`, icon: 'arrow' as const }));
    function Many() {
      const ring = useRingTarget(() => ({ label: 'Many', actions: many, onAction: () => {} }));
      return <button type="button" {...ring}>Many</button>;
    }
    draw(
      <RingProvider>
        <Many />
      </RingProvider>,
    );
    act(() => void document.querySelector('button')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    expect(document.querySelector('[role="menu"]')!.getAttribute('data-shape')).toBe('list');
  });
});

describe('PathTree', () => {
  const nodes: PathNode[] = [
    { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', children: [{ id: 'x', label: 'Deep' }] }, { id: 'a2', label: 'A2', children: [{ id: 'y', label: 'Hidden' }] }] },
    { id: 'b', label: 'B', children: [{ id: 'b1', label: 'Not shown' }] },
  ];

  it('opens only the path, lights it, and keeps the neighbours where they were', () => {
    draw(<PathTree label="Collections" nodes={nodes} path={['a', 'a1']} onOpen={() => {}} />);
    const rows = [...document.querySelectorAll('[role="treeitem"]')];
    expect(rows.map((r) => r.querySelector('.quill-tree-label')!.textContent)).toEqual(['A', 'A1', 'Deep', 'A2', 'B']);
    expect(rows.filter((r) => r.classList.contains('quill-tree-lit')).map((r) => r.textContent)).toEqual(['A', 'A1']);
    expect(rows[1]!.getAttribute('aria-current')).toBe('page');
    // What you opened isn't dimmed: only the path's neighbours are.
    expect(rows[2]!.classList.contains('quill-tree-inside')).toBe(true);
    expect(document.querySelectorAll('.quill-tree-line').length).toBeGreaterThan(0);
  });

  it('moves with the arrows and opens with Enter', () => {
    const onOpen = vi.fn();
    draw(<PathTree label="Collections" nodes={nodes} path={['a', 'a1']} onOpen={onOpen} />);
    const rows = () => [...document.querySelectorAll('[role="treeitem"]')] as HTMLElement[];
    expect(rows()[1]!.tabIndex).toBe(0);
    key(rows()[1]!, 'ArrowDown');
    expect(document.activeElement).toBe(rows()[2]);
    key(rows()[2]!, 'ArrowLeft');
    expect(document.activeElement).toBe(rows()[1]);
    key(rows()[1]!, 'ArrowUp');
    key(rows()[0]!, 'Enter');
    expect(onOpen).toHaveBeenCalledWith(nodes[0]);
  });
});

describe('Reel and the front page', () => {
  const items = ['One', 'Two', 'Three'].map((title) => ({ id: title, title, onOpen: vi.fn() }));

  it('pulls cards in one at a time behind its light, and says how many wait', () => {
    draw(<Reel label="Actions" tone="action" items={items} reveal="pull" noun="action" />);
    const light = document.querySelector('.quill-reel-light')!;
    expect(light.getAttribute('aria-label')).toBe('Bring in the next action. 3 waiting.');
    act(() => (light as HTMLElement).click());
    act(() => (light as HTMLElement).click());
    expect([...document.querySelectorAll('.quill-reel-card')].map((c) => c.textContent)).toEqual(['One', 'Two']);
    expect(document.querySelector('.quill-reel-card[data-front]')!.textContent).toBe('Two');
    expect(document.querySelector('.quill-field')!.hasAttribute('data-pulling')).toBe(true);
  });

  it('brings a card forward on the first press and opens it on the next', () => {
    draw(<Reel label="New" items={items} />);
    const first = document.querySelector('.quill-reel-card') as HTMLElement;
    act(() => first.click());
    expect(items[0]!.onOpen).not.toHaveBeenCalled();
    expect(first.hasAttribute('data-front')).toBe(true);
    act(() => first.click());
    expect(items[0]!.onOpen).toHaveBeenCalled();
  });

  it('builds the same page from any app’s config and its data', () => {
    const sections = frontSections(
      { sections: [{ id: 'needs', title: 'Needs you', empty: 'Nothing needs you.', layout: 'reel', tone: 'action' }, { id: 'new', title: 'New', empty: 'Nothing new.' }] },
      { needs: { items } },
    );
    draw(<FrontPage heading="Plans" eyebrow="Your floor" look="title" sections={sections} />);
    expect(document.querySelector('.quill-title-name')!.textContent).toBe('Plans');
    expect(document.querySelectorAll('.quill-reel-card')).toHaveLength(3);
    expect(document.querySelector('#front-needs')!.textContent).toBe('Needs you3');
    expect(document.querySelector('.quill-empty')!.textContent).toBe('Nothing new.');
  });
});
