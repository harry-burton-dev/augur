import { describe, expect, it } from 'vitest';
import { conflictFor, menuWarnings, platformApps, type AppEntry } from './manifest.ts';

const app = (over: Partial<AppEntry>): Pick<AppEntry, 'name' | 'icon' | 'menu' | 'areas'> => ({ name: 'Board', icon: 'chart', ...over });

describe('menuWarnings', () => {
  it('finds nothing wrong with the platform’s own apps', () => {
    for (const entry of platformApps) expect(menuWarnings(entry), entry.id).toEqual([]);
  });

  it('warns when something repeats the label or icon of what it sits under', () => {
    expect(
      menuWarnings(
        app({
          areas: [{ id: 'plan', label: 'Board', icon: 'folder' }],
          menu: [
            { label: 'Cards', icon: 'folder', area: 'plan', items: [{ label: 'cards', icon: 'document', path: '/cards' }] },
            { label: 'Labels', icon: 'tag', area: 'plan', items: [{ label: 'All labels', icon: 'tag', path: '/labels' }] },
          ],
        }),
      ),
    ).toEqual([
      'Board\'s area "Board" has the app\'s own label.',
      'Board\'s menu group "Cards" has the icon of its area "Board".',
      'Board\'s menu item "cards" has the label of its group "Cards".',
      'Board\'s menu item "All labels" has the icon of its group "Labels".',
    ]);
  });

  it('compares a group with no area against the app', () => {
    expect(menuWarnings(app({ menu: [{ label: 'Charts', icon: 'chart', items: [{ label: 'All', path: '/' }] }] }))).toEqual([
      'Board\'s menu group "Charts" has the icon of the app.',
    ]);
  });

  it('warns about unknown, unused and missing areas', () => {
    expect(
      menuWarnings(
        app({
          areas: [
            { id: 'plan', label: 'Planning', icon: 'folder' },
            { id: 'ship', label: 'Shipping', icon: 'publish' },
          ],
          menu: [
            { label: 'Cards', icon: 'document', area: 'plan', items: [{ label: 'All cards', icon: 'list', path: '/cards' }] },
            { label: 'Labels', icon: 'tag', area: 'later', items: [{ label: 'All labels', icon: 'list', path: '/labels' }] },
          ],
        }),
      ),
    ).toEqual([
      'Board\'s area "Shipping" has no menu groups.',
      'Board\'s menu group "Labels" names the area "later", which the app doesn\'t have.',
    ]);
  });

  it('leaves icons that aren’t given out of it', () => {
    expect(menuWarnings(app({ icon: undefined, menu: [{ label: 'Cards', items: [{ label: 'All cards', path: '/cards' }] }] }))).toEqual([]);
  });
});

describe('platform apps', () => {
  // They ship with this shell, so each must open in it: a range ahead of the SDK hides the app.
  it('each asks for an SDK this AUGUR speaks', async () => {
    const { SDK_VERSION } = await import('@augur/mfe-sdk');
    const semver = (await import('semver')).default;
    for (const app of platformApps) expect(semver.satisfies(SDK_VERSION, app.sdk), `${app.id} asks for SDK ${app.sdk}, this AUGUR has ${SDK_VERSION}`).toBe(true);
  });
});

describe('an app’s id', () => {
  const entry = (id: string, route = `/${id}`): AppEntry => ({ id, name: 'Notes', route, entry: `/apps/${id}/entry.js`, version: '1.0.0', sdk: '^1.0.0' });

  it('can’t be one AUGUR keeps for a part of itself, and says which', () => {
    expect(conflictFor(entry('events', '/notes'), [])).toBe('"events" is kept for the events service, a part of AUGUR. Choose another id for the app.');
    expect(conflictFor(entry('keycloak', '/notes'), [])).toContain('the sign-in service');
    expect(conflictFor(entry('augur-notes'), [])).toContain('starts with augur-');
    expect(conflictFor(entry('admin'), [])).toBe('"admin" is one of the platform\'s own apps.');
    expect(conflictFor(entry('notes'), [])).toBeUndefined();
  });
});
