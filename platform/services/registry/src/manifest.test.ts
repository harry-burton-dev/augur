import { describe, expect, it } from 'vitest';
import { menuWarnings, platformApps, type AppEntry } from './manifest.ts';

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
