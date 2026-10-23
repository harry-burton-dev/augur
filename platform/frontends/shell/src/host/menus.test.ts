import type { AppManifestEntry } from '@augur/mfe-sdk';
import { describe, expect, it } from 'vitest';
import { backFrom, escapeIsFree, findPages, orbitMenu, screenFor, titleMenu, titleTarget } from './index.js';

const app = (id: string, route: string, extra: Partial<AppManifestEntry> = {}): AppManifestEntry => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  route,
  entry: `/apps/${id}/entry.js`,
  version: '0.1.0',
  sdk: '^1.0.0',
  ...extra,
});
const board = app('board', '/board', {
  icon: 'apps',
  menu: [
    { label: 'Labels', icon: 'star', items: [{ label: 'All labels', path: '/labels', detail: '3 labels' }, { label: 'New', path: '/labels/new' }, { label: 'Archive', path: '/archive' }] },
    { label: 'Colours', items: [{ label: 'Browse', path: '/colours', keywords: 'palette' }] },
  ],
});
const home = app('home', '/home', { icon: 'home', description: 'What needs you' });
const manifest = [home, board];

describe('screenFor', () => {
  it('shows Title at the root, Orbit at a root with a menu, and the app everywhere else', () => {
    expect(screenFor(manifest, '/')).toEqual({ kind: 'title' });
    expect(screenFor(manifest, '/board')).toEqual({ kind: 'orbit', app: board });
    expect(screenFor(manifest, '/board/labels')).toEqual({ kind: 'app', app: board, path: '/labels' });
    expect(screenFor(manifest, '/home')).toEqual({ kind: 'app', app: home, path: '/' });
    expect(screenFor(manifest, '/nowhere')).toBeUndefined();
  });
});

describe('titleMenu', () => {
  it('makes each app a chapter, its menu categories the items', () => {
    const title = titleMenu(manifest);
    expect(title.map((c) => c.label)).toEqual(['Home', 'Board']);
    expect(title[0].items).toEqual([{ id: 'home/', label: 'Home', icon: 'home', ai: undefined, detail: 'What needs you' }]);
    expect(title[1].items.map((i) => [i.label, i.detail])).toEqual([
      ['Labels', 'All labels, New and 1 more'],
      ['Colours', 'Browse'],
    ]);
    expect(title[1].items[1].keywords).toContain('palette');
  });

  it('leads each item back to its app and Orbit category', () => {
    const [homeChapter, boardChapter] = titleMenu(manifest);
    expect(titleTarget(manifest, homeChapter.items[0])).toEqual({ app: home, category: 0 });
    expect(titleTarget(manifest, boardChapter.items[1])).toEqual({ app: board, category: 1 });
    expect(titleTarget(manifest, { label: 'Gone', id: 'gone/0' })).toBeUndefined();
  });
});

describe('orbitMenu', () => {
  it('carries each item’s path as its id, and the category icon down', () => {
    const orbit = orbitMenu(board);
    expect(orbit[0].items[1]).toMatchObject({ id: '/labels/new', label: 'New', icon: 'star' });
    expect(orbit[1].icon).toBe('apps');
  });
});

describe('backFrom', () => {
  it('goes from inside an app to its Orbit, and from Orbit or a menu-less app to Title', () => {
    expect(backFrom({ kind: 'app', app: board, path: '/labels' })).toBe('/board');
    expect(backFrom({ kind: 'orbit', app: board })).toBe('/');
    expect(backFrom({ kind: 'app', app: home, path: '/' })).toBe('/');
    expect(backFrom({ kind: 'title' })).toBeUndefined();
  });
});

describe('escapeIsFree', () => {
  const esc = (target: HTMLElement, init: KeyboardEventInit = {}) => {
    let free = false;
    const listen = (e: Event) => (free = escapeIsFree(e as KeyboardEvent));
    window.addEventListener('keydown', listen);
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true, ...init }));
    window.removeEventListener('keydown', listen);
    return free;
  };

  it('is free from plain content, but not from fields, open dialogs or anything that used it', () => {
    document.body.innerHTML = '<main><p id="p">Hi</p><input id="i"><div open><button id="b">x</button></div></main>';
    expect(esc(document.getElementById('p')!)).toBe(true);
    expect(esc(document.getElementById('i')!)).toBe(false);
    expect(esc(document.getElementById('b')!)).toBe(false);
    const used = document.getElementById('p')!;
    used.addEventListener('keydown', (e) => e.preventDefault(), { once: true });
    expect(esc(used)).toBe(false);
  });
});

describe('findPages', () => {
  it('finds menu pages across apps by any of their words, each opening its location', () => {
    expect(findPages(manifest, 'labels new')).toEqual([{ id: '/board/labels/new', title: 'New', detail: 'Board · Labels', kind: 'page' }]);
    expect(findPages(manifest, 'PALETTE').map((r) => r.id)).toEqual(['/board/colours']);
    expect(findPages(manifest, 'board').length).toBe(4);
    expect(findPages(manifest, '  ')).toEqual([]);
    expect(findPages(manifest, 'nothing like it')).toEqual([]);
  });
});
