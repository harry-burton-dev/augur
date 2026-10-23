import { beforeEach, describe, expect, it } from 'vitest';
import './tree.js';
import { treePath, type TreeItem, type UiTree } from './tree.js';

let tree: UiTree;
const root = () => tree.shadowRoot!;
const rows = () => [...root().querySelectorAll<HTMLElement>('[role="treeitem"]')];
const names = () => rows().map((r) => r.querySelector('.name')!.textContent);
const key = async (k: string) => {
  (root().activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  await tree.updateComplete;
};
const items: TreeItem[] = [
  { id: 'p', label: 'Policies', icon: 'folder', children: [{ id: 'hr', label: 'HR', icon: 'folder', children: [{ id: 'leave', label: 'Leave' }] }, { id: 'it', label: 'IT' }] },
  { id: 'r', label: 'Reports', meta: '3' },
];

beforeEach(async () => {
  document.body.innerHTML = '<ui-tree label="Folders"></ui-tree>';
  tree = document.querySelector('ui-tree')!;
  tree.items = items;
  await tree.updateComplete;
});

describe('ui-tree', () => {
  it('finds the path down to a row', () => {
    expect(treePath(items, 'leave')).toEqual(['p', 'hr', 'leave']);
    expect(treePath(items, 'nope')).toEqual([]);
  });

  it('shows the top rows closed, and opens the parents of the selected row', async () => {
    expect(names()).toEqual(['Policies', 'Reports']);
    expect(rows()[0].getAttribute('aria-expanded')).toBe('false');
    expect(rows()[1].hasAttribute('aria-expanded')).toBe(false);
    tree.selected = 'leave';
    await tree.updateComplete;
    expect(names()).toEqual(['Policies', 'HR', 'Leave', 'IT', 'Reports']);
    expect(rows()[2].getAttribute('aria-selected')).toBe('true');
    expect(rows()[2].getAttribute('aria-level')).toBe('3');
    expect(rows().filter((r) => r.tabIndex === 0).map((r) => r.dataset.id)).toEqual(['leave']);
  });

  it('selects a row on click, and opens or closes it with its chevron', async () => {
    const seen: string[] = [];
    tree.addEventListener('ui-select', (e) => seen.push(`select ${(e as CustomEvent).detail.item.id}`));
    tree.addEventListener('ui-toggle', (e) => seen.push(`toggle ${(e as CustomEvent).detail.item.id} ${(e as CustomEvent).detail.open}`));
    rows()[1].click();
    (rows()[0].querySelector('.chev') as HTMLElement).click();
    await tree.updateComplete;
    expect(names()).toEqual(['Policies', 'HR', 'IT', 'Reports']);
    rows()[3].click();
    expect(seen).toEqual(['select r', 'toggle p true']);
    expect(tree.selected).toBe('r');
  });

  it('moves, opens, closes and selects from the keyboard', async () => {
    const chosen: string[] = [];
    tree.addEventListener('ui-select', (e) => chosen.push((e as CustomEvent).detail.item.id));
    tree.focus();
    expect((root().activeElement as HTMLElement).dataset.id).toBe('p');
    await key('ArrowRight');
    expect(names()).toEqual(['Policies', 'HR', 'IT', 'Reports']);
    await key('ArrowRight');
    expect((root().activeElement as HTMLElement).dataset.id).toBe('hr');
    await key('ArrowDown');
    expect((root().activeElement as HTMLElement).dataset.id).toBe('it');
    await key('ArrowLeft');
    expect((root().activeElement as HTMLElement).dataset.id).toBe('p');
    await key('ArrowLeft');
    expect(names()).toEqual(['Policies', 'Reports']);
    await key('End');
    await key('Enter');
    expect(chosen).toEqual(['r']);
  });
});
