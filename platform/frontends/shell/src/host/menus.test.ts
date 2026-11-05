import type { AppManifestEntry } from '@augur/mfe-sdk';
import { describe, expect, it } from 'vitest';
import type { MenuCategory } from '@augur/shell-kit';
import { areaOf, backFrom, navsFor, navTarget, escapeIsFree, findPages, orbitIndexOf, orbitMenu, productName, screenFor, titleFor, titleMenu, titleTarget, upFrom } from './index.js';

const app = (id: string, route: string, extra: Partial<AppManifestEntry> = {}): AppManifestEntry => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  route,
  entry: `/apps/${id}/entry.js`,
  version: '0.1.0',
  sdk: '^1.0.0 || ^2.0.0',
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
/** Keeps its menu inside it: the shell shows no Orbit for it. */
const shelf = app('shelf', '/shelf', { orbit: false, menu: board.menu });
/** Two areas, so Title lists them; groups listed out of area order. */
const desk = app('desk', '/desk', {
  icon: 'admin',
  areas: [
    { id: 'org', label: 'Organisation', icon: 'structure', detail: 'People and teams' },
    { id: 'sys', label: 'System', icon: 'server' },
  ],
  menu: [
    { label: 'People', icon: 'people', area: 'org', items: [{ label: 'Everyone', icon: 'list', path: '/people' }, { label: 'Add', icon: 'plus', path: '/people/new' }] },
    { label: 'Apps', icon: 'apps', area: 'sys', items: [{ label: 'All apps', icon: 'list', path: '/apps', detail: 'On or off' }] },
    { label: 'Teams', icon: 'department', area: 'org', items: [{ label: 'All teams', icon: 'list', path: '/teams' }, { label: 'New team', icon: 'plus', path: '/teams/new' }] },
  ],
});
const manifest = [home, board, shelf, desk];

/** Every child in a menu next to the parent it sits under, chapter or group first. */
const pairs = (menu: MenuCategory[], parent?: { label: string; icon?: string }) =>
  menu.flatMap((c) => [...(parent ? [[parent, c]] : []), ...c.items.map((it) => [c, it])]) as [{ label: string; icon?: string }, { label: string; icon?: string }][];

describe('screenFor', () => {
  it('shows Title at the root, Orbit at a root with a menu, and the app everywhere else', () => {
    expect(screenFor(manifest, '/')).toEqual({ kind: 'title' });
    expect(screenFor(manifest, '/board')).toEqual({ kind: 'orbit', app: board });
    // An intent raised for it goes to the app, to answer it.
    expect(screenFor(manifest, '/board', true)).toEqual({ kind: 'app', app: board, path: '/' });
    expect(screenFor(manifest, '/board/labels')).toEqual({ kind: 'app', app: board, path: '/labels' });
    expect(screenFor(manifest, '/home')).toEqual({ kind: 'app', app: home, path: '/' });
    expect(screenFor(manifest, '/nowhere')).toBeUndefined();
  });

  it('opens an app that keeps its own menu straight away at its root', () => {
    expect(screenFor(manifest, '/shelf')).toEqual({ kind: 'app', app: shelf, path: '/' });
  });
});

describe('titleMenu', () => {
  it('lists an app’s areas, and shows an app with fewer than two as itself', () => {
    const title = titleMenu(manifest);
    expect(title.map((c) => c.label)).toEqual(['Home', 'Board', 'Shelf', 'Desk']);
    expect(title[0]).toMatchObject({ id: 'home', label: 'Home', icon: 'home', detail: 'What needs you', items: [] });
    // a menu with no areas stays in Orbit: Title never lists groups
    expect(title[1].items).toEqual([]);
    expect(title[1].keywords).toContain('palette');
    expect(title[3].items.map((i) => [i.id, i.label, i.icon, i.detail])).toEqual([
      ['desk/org', 'Organisation', 'structure', 'People and teams'],
      ['desk/sys', 'System', 'server', 'Apps'],
    ]);
  });

  it('leads an app to its start, and an area to its first group in Orbit', () => {
    const title = titleMenu(manifest);
    expect(titleTarget(manifest, { id: 'board', label: 'Board' })).toEqual({ app: board, category: 0 });
    expect(titleTarget(manifest, title[3].items[0])).toEqual({ app: desk, category: 0 });
    expect(titleTarget(manifest, title[3].items[1])).toEqual({ app: desk, category: 2 });
    expect(titleTarget(manifest, { label: 'Gone', id: 'gone/x' })).toBeUndefined();
  });

  it('opens an app that keeps its own menu at the area’s first page', () => {
    const own = app('own', '/own', { orbit: false, areas: desk.areas, menu: desk.menu });
    expect(titleTarget([own], { id: 'own/sys', label: 'System' })).toEqual({ app: own, category: 2, path: '/apps' });
    expect(titleTarget([own], { id: 'own', label: 'Own' })).toEqual({ app: own, category: 0 });
  });

  it('never repeats a parent’s label or icon, for any app here', () => {
    for (const menu of [titleMenu(manifest), ...manifest.map(orbitMenu)])
      for (const [parent, child] of pairs(menu)) {
        expect(child.label, `${parent.label} > ${child.label}`).not.toBe(parent.label);
        expect(child.icon, `${parent.label} > ${child.label}`).not.toBe(parent.icon);
      }
  });
});

describe('orbitMenu', () => {
  it('carries each item’s path as its id, without borrowing the group’s icon', () => {
    const orbit = orbitMenu(board);
    expect(orbit[0].items[1]).toMatchObject({ id: '/labels/new', label: 'New', icon: 'arrow' });
  });

  it('makes a group with one page that page', () => {
    const colours = orbitMenu(board)[1];
    expect(colours).toMatchObject({ id: '/colours', label: 'Colours', icon: 'apps', items: [] });
  });

  it('keeps an area’s groups together, each naming its area', () => {
    const orbit = orbitMenu(desk);
    expect(orbit.map((c) => [c.section, c.label])).toEqual([
      ['Organisation', 'People'],
      ['Organisation', 'Teams'],
      ['System', 'Apps'],
    ]);
    expect(orbitMenu(board).map((c) => c.section)).toEqual([undefined, undefined]);
  });

  it('finds the group and area a page is in', () => {
    expect(orbitIndexOf(desk, '/teams/new')).toBe(1);
    expect(orbitIndexOf(desk, '/apps')).toBe(2);
    expect(orbitIndexOf(desk, '/nowhere')).toBe(0);
    expect(areaOf(desk, '/apps')?.label).toBe('System');
    expect(areaOf(board, '/labels')).toBeUndefined();
  });
});

describe('navsFor', () => {
  it('offers Home and every app from any screen, marking the one you’re on', () => {
    const all = [home, board, shelf];
    const ids = (screen: Parameters<typeof navsFor>[0]) => navsFor(screen, all).map((n) => `${n.id}${n.current ? '*' : ''}`);
    expect(ids({ kind: 'title' })).toEqual(['home', 'title*']);
    expect(ids({ kind: 'app', app: home, path: '/' })).toEqual(['home*', 'title']);
    expect(ids({ kind: 'app', app: shelf, path: '/labels' })).toEqual(['home', 'title']);
    expect(ids({ kind: 'orbit', app: board })).toEqual(['home', 'title']);
    expect(navTarget('home', all)).toBe('/home');
    expect(navTarget('title', all)).toBe('/');
  });

  it('keeps Home where a floor hasn’t got it, and says why', () => {
    expect(navsFor({ kind: 'title' }, [board])[0]).toMatchObject({ id: 'home', unavailable: 'Home isn’t on this floor' });
    expect(navTarget('home', [board])).toBeUndefined();
  });
});

describe('backFrom', () => {
  it('goes from inside an app to its Orbit, and from Orbit or a menu-less app to Title', () => {
    expect(backFrom({ kind: 'app', app: board, path: '/labels' })).toBe('/board');
    expect(backFrom({ kind: 'orbit', app: board })).toBe('/');
    expect(backFrom({ kind: 'app', app: home, path: '/' })).toBe('/');
    expect(backFrom({ kind: 'title' })).toBeUndefined();
  });

  it('never steps out of an app that keeps its own menu', () => {
    expect(backFrom({ kind: 'app', app: shelf, path: '/labels' })).toBeUndefined();
    expect(backFrom({ kind: 'app', app: shelf, path: '/' })).toBeUndefined();
  });
});

describe('upFrom', () => {
  it('is always one level up, and says where, for Back', () => {
    expect(upFrom({ kind: 'app', app: board, path: '/labels' })).toEqual({ to: '/board', label: `${board.name}’s menu` });
    expect(upFrom({ kind: 'orbit', app: board })).toEqual({ to: '/', label: 'all apps' });
    expect(upFrom({ kind: 'app', app: home, path: '/' })).toEqual({ to: '/', label: 'all apps' });
    expect(upFrom({ kind: 'title' })).toBeUndefined();
  });

  it('takes an app that keeps its own menu, and keeps Esc, back to Title', () => {
    expect(upFrom({ kind: 'app', app: shelf, path: '/labels' })).toEqual({ to: '/', label: 'all apps' });
  });

  it('agrees with Esc everywhere Esc is the shell’s', () => {
    const screens = [{ kind: 'app' as const, app: board, path: '/labels' }, { kind: 'orbit' as const, app: board }, { kind: 'app' as const, app: home, path: '/' }, { kind: 'title' as const }];
    for (const s of screens) expect(backFrom(s)).toBe(upFrom(s)?.to);
  });
});

describe('productName', () => {
  it('is the deployment’s, from the page, and AUGUR without one', () => {
    const page = (content?: string) => ({ querySelector: () => (content === undefined ? null : { content }) }) as unknown as Pick<Document, 'querySelector'>;
    expect(productName(page(' Example, built on AUGUR '))).toBe('Example, built on AUGUR');
    expect(productName(page(''))).toBe('AUGUR');
    expect(productName(page())).toBe('AUGUR');
    expect(productName(undefined)).toBe('AUGUR');
  });
});

describe('titleFor', () => {
  it('names the page, the app, the floor and AUGUR, most specific first', () => {
    expect(titleFor({ kind: 'app', app: board, path: '/labels' }, 'Finance')).toBe(`${board.menu![0].items.find((i) => i.path === '/labels')!.label} · ${board.name} · Finance · AUGUR`);
    expect(titleFor({ kind: 'orbit', app: board }, 'Finance')).toBe(`${board.name} · Finance · AUGUR`);
    expect(titleFor({ kind: 'title' }, 'Finance')).toBe('Finance · AUGUR');
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
    expect(findPages([home, board], 'labels new')).toEqual([{ id: '/board/labels/new', title: 'New', detail: 'Board · Labels', kind: 'page' }]);
    expect(findPages([home, board], 'PALETTE').map((r) => r.id)).toEqual(['/board/colours']);
    expect(findPages([home, board], 'board').length).toBe(4);
    expect(findPages([home, board], '  ')).toEqual([]);
    expect(findPages([home, board], 'nothing like it')).toEqual([]);
  });
});
