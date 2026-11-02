import { useMemo, useState, type ReactNode } from 'react';
import { Button as AriaButton, Tree as AriaTree, TreeItem, TreeItemContent, type Key, type Selection } from 'react-aria-components';
import { Icon, IconButton, cx, type IconName } from '@augur/kit-common';

export interface TreeNode {
  id: string;
  label: string;
  /** A kit icon before the label. */
  icon?: IconName;
  /** A count or a word at the end. */
  meta?: string;
  children?: TreeNode[];
}

/** The ids from the top of the tree down to `id`, itself included, or [] when it isn't there. */
export const treePath = (items: readonly TreeNode[], id: string): string[] => {
  for (const item of items) {
    if (item.id === id) return [id];
    const below = treePath(item.children ?? [], id);
    if (below.length) return [item.id, ...below];
  }
  return [];
};

const find = (items: readonly TreeNode[], id: string): TreeNode | undefined => {
  for (const item of items) {
    if (item.id === id) return item;
    const below = find(item.children ?? [], id);
    if (below) return below;
  }
  return undefined;
};

export interface TreeProps {
  /** What the tree is, read aloud: "Folders". */
  label: string;
  /** A small-capitals line above the rows, when the tree needs one on screen. */
  heading?: string;
  items: TreeNode[];
  selected?: string;
  /** Rows open at the start; the selected row's parents always open. */
  open?: string[];
  onSelect?: (item: TreeNode) => void;
  onToggle?: (item: TreeNode, open: boolean) => void;
  /** Icons only, one per top-level row, its name on hover: for a folded rail. */
  compact?: boolean;
  className?: string;
}

/**
 * Things inside things, such as a library's folders: one row each, indented
 * under its parent, with a chevron to open or close what's inside. The rows
 * above the selected one open by themselves. Keyboard and the ARIA tree
 * pattern come from React Aria.
 */
export function Tree({ label, heading, items, selected = '', open: initial = [], onSelect, onToggle, compact, className }: TreeProps) {
  const path = useMemo(() => treePath(items, selected).slice(0, -1), [items, selected]);
  const [expanded, setExpanded] = useState<Set<Key>>(() => new Set([...initial, ...path]));
  const shownOpen = new Set([...expanded, ...path]);
  if (compact)
    return (
      <div className={cx('quill-tree-compact', className)} aria-label={label} role="group">
        {items.map((item) => (
          <IconButton key={item.id} icon={item.icon ?? 'folder'} label={item.label} size="sm" aria-current={item.id === selected ? 'page' : undefined} onPress={() => onSelect?.(item)} />
        ))}
      </div>
    );
  const node = (item: TreeNode): ReactNode => (
    <TreeItem key={item.id} id={item.id} textValue={item.label} className="quill-tree-item">
      <TreeItemContent>
        {({ hasChildItems, isExpanded, level }) => (
          <div className="quill-tree-item-row" style={{ paddingInlineStart: `calc(var(--space-4) * ${level - 1})` }}>
            {hasChildItems ? (
              <AriaButton slot="chevron" className="quill-tree-chevron" data-open={isExpanded ? '' : undefined} aria-label={isExpanded ? `Close ${item.label}` : `Open ${item.label}`}>
                <Icon name="chevron-down" size={14} />
              </AriaButton>
            ) : (
              <span className="quill-tree-chevron" aria-hidden="true" />
            )}
            {item.icon ? <Icon name={item.icon} size={16} className="quill-tree-icon" /> : null}
            <span className="quill-tree-item-label">{item.label}</span>
            {item.meta ? <span className="quill-tree-item-meta">{item.meta}</span> : null}
          </div>
        )}
      </TreeItemContent>
      {(item.children ?? []).map(node)}
    </TreeItem>
  );
  return (
    <div className={cx('quill-tree', className)}>
      {heading ? <div className="quill-label quill-tree-heading">{heading}</div> : null}
      <AriaTree
        aria-label={label}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={selected ? [selected] : []}
        onSelectionChange={(keys: Selection) => {
          const id = keys === 'all' ? undefined : [...keys][0];
          const item = id !== undefined ? find(items, String(id)) : undefined;
          if (item && item.id !== selected) onSelect?.(item);
        }}
        expandedKeys={shownOpen}
        onExpandedChange={(keys) => {
          const next = new Set(keys);
          for (const id of new Set([...next, ...shownOpen])) {
            const was = shownOpen.has(id);
            const now = next.has(id);
            const item = find(items, String(id));
            if (item && was !== now) onToggle?.(item, now);
          }
          setExpanded(next);
        }}
      >
        {items.map(node)}
      </AriaTree>
    </div>
  );
}
