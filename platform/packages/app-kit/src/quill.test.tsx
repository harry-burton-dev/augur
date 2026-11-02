// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { About } from './about.js';
import { AppFrame, RailLink } from './app-frame.js';
import { FrontPage } from './front-page.js';
import { More } from './more.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const draw = (node: ReactNode) => {
  document.body.replaceChildren(document.createElement('div'));
  root = createRoot(document.body.firstElementChild!);
  act(() => root!.render(node));
};
afterEach(() => act(() => root?.unmount()));
const button = (name: string) => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name || b.textContent === name)!;

describe('AppFrame', () => {
  it('folds the rail to icons, keeps their names, and remembers it', () => {
    localStorage.clear();
    const frame = () => (
      <AppFrame app={{ name: 'Plans', icon: 'library' }} railLabel="Sections" rail={<RailLink icon="home" label="Home" current onPress={() => {}} />}>
        Main
      </AppFrame>
    );
    draw(frame());
    expect(document.querySelector('.quill-rail-label')?.textContent).toBe('Home');
    act(() => button('Hide Sections').click());
    expect(document.querySelector('.quill-rail-label')).toBeNull();
    expect(button('Home').getAttribute('aria-current')).toBe('page');
    draw(frame());
    expect(document.querySelector('.quill-frame')!.getAttribute('data-rail')).toBe('closed');
  });

  it('tells the shell how much of the edge its drawer takes, and gives it back when it goes', () => {
    const seen = vi.fn();
    window.addEventListener('ui-drawer', (e) => seen((e as CustomEvent).detail.inset));
    draw(<AppFrame app={{ name: 'Plans', icon: 'library' }} drawer={<p>About</p>}>Main</AppFrame>);
    act(() => root!.unmount());
    root = undefined;
    expect(seen).toHaveBeenLastCalledWith(0);
  });
});

describe('FrontPage and About', () => {
  it('say so when a section or a row is empty', () => {
    draw(<FrontPage heading="Plans" sections={[{ id: 'needs', title: 'Needs you', empty: 'Nothing needs you.' }]} />);
    expect(document.body.textContent).toContain('Nothing needs you.');
    draw(<About what="A collection of 12 plans" />);
    expect(document.body.textContent).toContain('Nobody owns this yet.');
    expect(document.body.textContent).toContain('Nothing is linked to this yet.');
  });
});

describe('More', () => {
  it('says how many of how many, and goes when they all show', () => {
    const onMore = vi.fn();
    draw(<More shown={50} total={312} noun="records" onMore={onMore} />);
    expect(document.body.textContent).toContain('Showing 50 of 312 records');
    act(() => button('Show 50 more').click());
    expect(onMore).toHaveBeenCalled();
    draw(<More shown={312} total={312} noun="records" onMore={onMore} />);
    expect(document.body.textContent).toBe('');
  });
});
