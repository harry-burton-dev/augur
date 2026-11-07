import type { AppManifestEntry } from '@augur/mfe-sdk';
import { describe, expect, it } from 'vitest';
import { areaOf, findPages, groupOf, groupsFor, pageAt, pagesOf, productName, screenFor, titleFor, toShellApp } from './index.js';

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
/** Says it keeps its menu inside it (`orbit: false`): read, no longer drawn (PDR-020 D5). */
const shelf = app('shelf', '/shelf', { orbit: false, menu: board.menu });
/** Two areas; groups listed out of area order. */
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

describe('screenFor', () => {
  it('shows the desktop at the root, and the app everywhere else, its root included', () => {
    expect(screenFor(manifest, '/')).toEqual({ kind: 'desk' });
    expect(screenFor(manifest, '/board')).toEqual({ kind: 'app', app: board, path: '/' });
    expect(screenFor(manifest, '/board/labels')).toEqual({ kind: 'app', app: board, path: '/labels' });
    expect(screenFor(manifest, '/shelf')).toEqual({ kind: 'app', app: shelf, path: '/' });
    expect(screenFor(manifest, '/nowhere')).toBeUndefined();
  });
});

describe('the app bar’s groups', () => {
  const admin = app('admin', '/admin', { category: 'platform' });
  const folio = app('folio', '/folio', { category: 'pillar' });
  it('puts each app in its category’s group, and the rest in Apps (D1)', () => {
    expect([admin, folio, board].map(groupOf)).toEqual(['platform', 'pillar', 'apps']);
    expect(groupsFor([board, folio, admin], 'Example').map((g) => [g.id, g.name])).toEqual([
      ['platform', 'Platform'],
      ['pillar', 'Pillars'],
      ['apps', 'Apps'],
    ]);
    expect(groupsFor([admin], 'Example')[0]!.line).toContain('Example');
  });

  it('offers only the groups that hold an app on this floor', () => {
    expect(groupsFor([board]).map((g) => g.id)).toEqual(['apps']);
    expect(groupsFor([])).toEqual([]);
  });
});

describe('the rail’s pages', () => {
  it('has one page per menu item, in the app’s order, named by the path it opens (D2)', () => {
    expect(pagesOf(board)).toEqual([
      { id: '/labels', name: 'All labels', icon: 'star' },
      { id: '/labels/new', name: 'New', icon: 'star' },
      { id: '/archive', name: 'Archive', icon: 'star' },
      { id: '/colours', name: 'Browse', icon: 'arrow' },
    ]);
    expect(toShellApp(board)).toMatchObject({ id: 'board', group: 'apps', pages: pagesOf(board) });
  });

  it('shows no page list for an app with one page or none', () => {
    expect(pagesOf(home)).toEqual([]);
    expect(pagesOf(app('one', '/one', { menu: [{ label: 'Only', items: [{ label: 'Start', path: '/' }] }] }))).toEqual([]);
  });

  it('marks the page a path is on, the most specific first', () => {
    expect(pageAt(board, '/labels')).toBe('/labels');
    expect(pageAt(board, '/labels/new')).toBe('/labels/new');
    expect(pageAt(board, '/labels/7')).toBe('/labels');
    expect(pageAt(board, '/')).toBe('');
    expect(pageAt(home, '/')).toBe('');
  });

  it('finds the area a page is in, for the band', () => {
    expect(areaOf(desk, '/apps')?.label).toBe('System');
    expect(areaOf(board, '/labels')).toBeUndefined();
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
    expect(titleFor({ kind: 'app', app: board, path: '/' }, 'Finance')).toBe(`${board.name} · Finance · AUGUR`);
    expect(titleFor({ kind: 'desk' }, 'Finance')).toBe('Finance · AUGUR');
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
