import { describe, expect, it } from 'vitest';
import {
  above,
  BadLevelError,
  BadMoveError,
  BadTagNameError,
  chainOf,
  CONTAINER_LIFECYCLE,
  CONTENT_LIFECYCLE,
  defineLevels,
  fits,
  floorLevel,
  floorPrincipal,
  floorRank,
  floorsAbove,
  hasAll,
  isRecordRef,
  levelDown,
  newestPassing,
  ownerOf,
  pathTo,
  placementRefusal,
  reaches,
  sameTag,
  tagName,
  tagsDown,
  viewFor,
  within,
  type Placement,
} from './index.js';

const levels = defineLevels(
  [
    { id: 'collection', name: 'Collection', plural: 'Collections', holds: ['subcollection', 'series', 'file'] },
    { id: 'subcollection', name: 'Subcollection', plural: 'Subcollections', holds: ['series', 'file'] },
    { id: 'series', name: 'Series', plural: 'Series', holds: ['subseries', 'file'] },
    { id: 'subseries', name: 'Subseries', plural: 'Subseries', holds: ['file'] },
    { id: 'file', name: 'File', plural: 'Files', holds: [] },
  ],
  ['collection'],
);

describe('levels', () => {
  it('lets a level be skipped but never turned round', () => {
    expect(levels.canHold('collection', 'file')).toBe(true);
    expect(levels.canHold('collection', 'series')).toBe(true);
    expect(levels.canHold('series', 'collection')).toBe(false);
    expect(levels.canHold(undefined, 'collection')).toBe(true);
    expect(levels.canHold(undefined, 'file')).toBe(false);
  });

  it('says why something can’t go somewhere', () => {
    expect(levels.refusal('series', 'subcollection')).toBe('A subcollection can’t go in a series: only subseries, files can.');
    expect(levels.refusal(undefined, 'file')).toBe('A file has to go inside something: only collections sit at the top.');
    expect(levels.refusal('subseries', 'subseries')).toBe('A subseries can’t go in a subseries: only files can.');
    expect(levels.refusal('collection', 'file')).toBeUndefined();
  });

  it('can be called what an org calls them', () => {
    const named = levels.named({ collection: { name: '  Programme ', plural: 'Programmes' } });
    expect(named.get('collection').name).toBe('Programme');
    expect(named.get('series').name).toBe('Series');
    expect(named.refusal(undefined, 'series')).toContain('only programmes sit at the top');
    expect(() => levels.named({ file: { name: '', plural: 'x' } })).toThrow(BadLevelError);
  });

  it('refuses levels that could nest inside themselves', () => {
    expect(() => defineLevels([{ id: 'a', name: 'A', plural: 'As', holds: ['a'] }], ['a'])).toThrow();
  });

  it('walks a tree', () => {
    const tree = [
      { id: 'c', level: 'collection' },
      { id: 's', level: 'series', parent: 'c' },
      { id: 'f', level: 'file', parent: 's' },
      { id: 'g', level: 'file', parent: 'c' },
    ];
    expect(pathTo(tree, 'f').map((r) => r.id)).toEqual(['c', 's', 'f']);
    expect([...within(tree, 's')]).toEqual(['s', 'f']);
    expect(pathTo(tree, 'nope')).toEqual([]);
  });
});

describe('access', () => {
  it('reaches as far as the furthest grant on the way down', () => {
    const me = ['person:sam', 'team:ops', 'org'];
    expect(levelDown([[{ principal: 'team:ops', level: 'read' }], [], [{ principal: 'person:sam', level: 'edit' }]], me)).toBe('edit');
    expect(levelDown([[{ principal: 'team:hr', level: 'manage' }]], me)).toBeUndefined();
    expect(levelDown([], me, 'read')).toBe('read');
    expect(reaches('edit', 'read')).toBe(true);
    expect(reaches(undefined, 'read')).toBe(false);
  });

  it('names who a floor lets in', () => {
    expect(floorPrincipal({ id: 'o', kind: 'org' })).toBe('org');
    expect(floorPrincipal({ id: 'ops', kind: 'team' })).toBe('tree:ops');
    expect(floorPrincipal({ id: 'p1', kind: 'personal' }, 'sam')).toBe('person:sam');
    expect(floorLevel('lead')).toBe('manage');
    expect(floorLevel('member')).toBe('read');
    expect(floorLevel('member', { membersEdit: true })).toBe('edit');
  });
});

describe('lifecycle', () => {
  it('moves between working states with edit, and to issued or retired only with manage', () => {
    expect(CONTENT_LIFECYCLE.needs('in-progress', 'in-review')).toBe('edit');
    expect(CONTENT_LIFECYCLE.needs('complete', 'issued')).toBe('manage');
    expect(CONTENT_LIFECYCLE.needs('issued', 'retired')).toBe('manage');
    expect(CONTENT_LIFECYCLE.needs('issued', 'in-progress')).toBeUndefined();
    expect(CONTENT_LIFECYCLE.movesFrom('in-progress', 'edit')).toEqual(['in-review', 'complete']);
    expect(CONTENT_LIFECYCLE.movesFrom('in-progress', 'manage')).toEqual(['in-review', 'complete', 'issued', 'retired']);
    expect(() => CONTENT_LIFECYCLE.check('complete', 'issued', 'edit')).toThrow(BadMoveError);
    expect(() => CONTENT_LIFECYCLE.check('complete', 'complete', 'manage')).toThrow('already Complete');
    expect(() => CONTENT_LIFECYCLE.check('complete', 'issued', 'manage')).not.toThrow();
  });

  it('tidies filters into its own order', () => {
    expect(CONTENT_LIFECYCLE.tidy(['issued', 'nope', 'in-review', 'issued'])).toEqual(['in-review', 'issued']);
    expect(CONTENT_LIFECYCLE.defaultFilter).toEqual(['issued']);
    expect(CONTAINER_LIFECYCLE.initial).toBe('open');
  });

  it('shows the newest version that passes', () => {
    const versions = [
      { number: 1, state: 'issued' as const },
      { number: 2, state: 'complete' as const },
      { number: 3, state: 'in-progress' as const },
    ];
    expect(newestPassing(versions, ['issued'])?.number).toBe(1);
    expect(newestPassing(versions, ['issued', 'complete'])?.number).toBe(2);
    expect(newestPassing(versions, ['retired'])).toBeUndefined();
  });
});

const place = (p: Partial<Placement> & Pick<Placement, 'id' | 'to' | 'rank'>): Placement => ({ record: 'r', from: 'me', filter: ['issued'], by: 'sam', at: `2026-10-30T10:0${p.id.length}:00Z`, ...p });

describe('placements', () => {
  const ops = { id: 'ops', kind: 'team' as const, path: ['dept', 'ops'] };
  const mine = { id: 'p-sam', kind: 'personal' as const, path: [] };

  it('only goes up', () => {
    expect(floorsAbove(ops)).toEqual(['dept', 'org']);
    expect(floorsAbove(mine, ['person:sam', 'team:ops', 'tree:dept', 'tree:ops', 'org'])).toEqual(['ops', 'dept', 'org']);
    expect(floorsAbove({ id: 'o', kind: 'org', path: [] })).toEqual([]);
    expect(floorRank({ kind: 'org', path: [] })).toBe(0);
    expect(floorRank(ops)).toBe(2);
    expect(floorRank(mine)).toBeGreaterThan(100);
  });

  it('says why a placement can’t be made', () => {
    expect(placementRefusal({ from: ops, to: 'dept', filter: [], existing: [] })).toContain('at least one state');
    expect(placementRefusal({ from: ops, to: 'hr', filter: ['issued'], existing: [] })).toContain('share it instead');
    expect(placementRefusal({ from: ops, to: 'org', filter: ['issued', 'complete'], via: { to: 'ops', filter: ['issued'] }, existing: [] })).toContain('can’t show more');
    expect(placementRefusal({ from: ops, to: 'org', filter: ['issued'], existing: [{ to: 'org' }] })).toContain('already on that floor');
    expect(placementRefusal({ from: ops, to: 'org', filter: ['issued'], existing: [{ to: 'org', endedAt: 'x' }] })).toBeUndefined();
    expect(placementRefusal({ from: ops, to: 'org', filter: ['issued'], via: { to: 'ops', filter: ['issued'], endedAt: 'x' }, existing: [] })).toContain('no longer has it');
  });

  it('gives the record one owner: the highest floor it reached', () => {
    const toOps = place({ id: 'a', to: 'ops', rank: 2 });
    const toOrg = place({ id: 'bb', from: 'ops', to: 'org', rank: 0, via: 'a' });
    expect(ownerOf('me', [])).toBe('me');
    expect(ownerOf('me', [toOps])).toBe('ops');
    expect(ownerOf('me', [toOps, toOrg])).toBe('org');
    expect(ownerOf('me', [toOps, { ...toOrg, endedAt: 'x' }])).toBe('ops');
    expect(chainOf([toOps, toOrg], 'bb').map((p) => p.to)).toEqual(['ops', 'org']);
    expect(above([toOps, toOrg], 'a').map((p) => p.id)).toEqual(['bb']);
  });

  it('shows it in one place, with everything any floor lets them see', () => {
    const toOps = place({ id: 'a', to: 'ops', rank: 2, filter: ['in-progress', 'in-review', 'complete'] });
    const toOrg = place({ id: 'bb', from: 'ops', to: 'org', rank: 0, via: 'a', filter: ['complete'] });
    const view = viewFor([toOps, toOrg])!;
    expect(view.place.to).toBe('org');
    expect(view.states.get('complete')?.to).toBe('org');
    expect(view.states.get('in-review')?.to).toBe('ops');
    expect(viewFor([])).toBeUndefined();
  });
});

describe('tags', () => {
  it('tidies names and matches them whatever their case', () => {
    expect(tagName('  cash   report ')).toBe('cash report');
    expect(() => tagName(' ')).toThrow(BadTagNameError);
    expect(sameTag('Policy', 'policy')).toBe(true);
    expect(tagsDown([['a'], ['b', 'a'], ['c']])).toEqual(['a', 'b', 'c']);
    expect(hasAll(['a', 'b'], ['b'])).toBe(true);
    expect(hasAll(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('relations', () => {
  it('checks what a link points at', () => {
    expect(isRecordRef({ app: 'atlas', kind: 'entity', id: 'ent_1' })).toBe(true);
    expect(isRecordRef({ app: 'Atlas', kind: 'entity', id: 'x' })).toBe(false);
    expect(isRecordRef({ app: 'folio', kind: 'unit', id: '' })).toBe(false);
    expect(fits('about', { app: 'atlas', kind: 'entity' }, 'folio')).toBe(true);
    expect(fits('supersedes', { app: 'atlas', kind: 'entity' }, 'folio')).toBe(false);
    expect(fits('supersedes', { app: 'folio', kind: 'unit' }, 'folio')).toBe(true);
    expect(fits('serves', { app: 'mandate', kind: 'intent' }, 'folio')).toBe(true);
  });
});
