import { describe, expect, it } from 'vitest';
import { floorBySlug, floorFromPath, floorHref, ownFloor } from './floors.js';
import type { Workspace } from '@augur/mfe-sdk';

const floors: Workspace[] = [
  { id: 'w-me', kind: 'personal', name: 'You', slug: 'me', path: [], role: 'lead' },
  { id: 'w-fin', kind: 'team', name: 'Finance', slug: 'finance', path: [], role: 'member' },
];

describe('floor locations', () => {
  it('reads the floor and the path on it', () => {
    expect(floorFromPath('/@finance/library/doc/1')).toEqual({ slug: 'finance', path: '/library/doc/1' });
    expect(floorFromPath('/@me')).toEqual({ slug: 'me', path: '/' });
    expect(floorFromPath('/@me/')).toEqual({ slug: 'me', path: '/' });
    expect(floorFromPath('/library')).toEqual({ path: '/library' });
    expect(floorFromPath('/')).toEqual({ path: '/' });
    expect(floorFromPath('/@caf%C3%A9/x')).toEqual({ slug: 'café', path: '/x' });
  });

  it('builds locations back', () => {
    expect(floorHref('finance', '/library/doc/1')).toBe('/@finance/library/doc/1');
    expect(floorHref('me')).toBe('/@me');
    expect(floorFromPath(floorHref('finance', '/admin'))).toEqual({ slug: 'finance', path: '/admin' });
  });

  it('finds floors', () => {
    expect(ownFloor(floors)?.id).toBe('w-me');
    expect(floorBySlug(floors, 'finance')?.id).toBe('w-fin');
    expect(floorBySlug(floors, 'legal')).toBeUndefined();
    expect(floorBySlug(floors, undefined)).toBeUndefined();
  });
});
