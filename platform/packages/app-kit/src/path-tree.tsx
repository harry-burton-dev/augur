import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cx, Icon, type IconName } from '@augur/kit-common';
import { useRingTarget, type RingSubject } from './radial-menu.js';

/** One thing in the tree. */
export interface PathNode {
  id: string;
  label: string;
  icon?: IconName;
  /** How many things are inside, shown at the end of the row. */
  count?: number;
  /** What's inside. Only the nodes on the path are opened, so the rest can leave this out. */
  children?: PathNode[];
  /** Locked to the person: kept in the tree, marked, with why on hover and focus. */
  locked?: string;
}

/** How the rows beside the path look. */
export type PathLight =
  /** Harry's: the rows beside the path are dimmed, so only the path you took is lit. */
  | 'path'
  /** Everything at full strength: a plain tree. */
  | 'flat';

export interface PathTreeProps {
  /** What the tree is, read aloud ("Your collections"). */
  label: string;
  nodes: PathNode[];
  /** The ids from the top of the tree down to where the person is. The last is the current one. */
  path: string[];
  onOpen: (node: PathNode) => void;
  /** What the radial menu offers on a row. Leave out for no menu. */
  ringFor?: (node: PathNode) => RingSubject | undefined;
  light?: PathLight;
}

interface Row {
  node: PathNode;
  level: number;
  lit: boolean;
  current: boolean;
  /** Inside the current one: what you opened, so it isn't dimmed. */
  inside: boolean;
}

/** The rows to draw: every node on the path is opened in place, nothing else is. */
const rowsOf = (nodes: PathNode[], path: string[], level = 0, out: Row[] = [], inside = false) => {
  for (const node of nodes) {
    const lit = path.includes(node.id);
    const current = path.at(-1) === node.id;
    out.push({ node, level, lit, current, inside });
    if (lit && node.children?.length) rowsOf(node.children, path, level + 1, out, current);
  }
  return out;
};

/** A piece of the lit line, at the indent of the row it comes down from. */
interface Guide {
  level: number;
  /** `start`: from the middle of the lit row down; `through`: the whole row; `end`: down to the middle, then across to the lit child. */
  part: 'start' | 'through' | 'end';
}

/** Where the lit line runs: from each lit row down to the lit row inside it. */
const guidesOf = (rows: Row[]) => {
  const out: Guide[][] = rows.map(() => []);
  rows.forEach((row, i) => {
    if (!row.lit || row.current) return;
    const j = rows.findIndex((r, k) => k > i && r.lit && r.level === row.level + 1);
    if (j < 0) return;
    out[i]!.push({ level: row.level, part: 'start' });
    for (let k = i + 1; k < j; k++) out[k]!.push({ level: row.level, part: 'through' });
    out[j]!.push({ level: row.level, part: 'end' });
  });
  return out;
};

/**
 * The navigation path (PDR-010): a tree that opens the thing you chose in
 * place and dims its neighbours, so only the path you took is lit, joined by
 * a line from the top down to where you are. Nothing is hidden: the
 * neighbours stay where they were, readable, and come up on hover and focus.
 *
 * Keys follow the tree pattern: ↑ ↓ move, → goes into the row (opens it), ←
 * goes to its parent, Home and End jump, Enter opens. Right-click (or the
 * context-menu key) opens the row's radial menu.
 */
export function PathTree({ label, nodes, path, onOpen, ringFor, light = 'path' }: PathTreeProps) {
  const rows = rowsOf(nodes, path);
  const guides = guidesOf(rows);
  const current = Math.max(0, rows.findIndex((r) => r.current));
  const [focus, setFocus] = useState<number | null>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const at = focus ?? current;

  const go = (i: number) => {
    const n = Math.min(Math.max(i, 0), rows.length - 1);
    setFocus(n);
    refs.current[n]?.focus();
  };
  const parentOf = (i: number) => {
    for (let j = i - 1; j >= 0; j--) if (rows[j]!.level < rows[i]!.level) return j;
    return -1;
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const row = rows[i]!;
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(rows.length - 1);
    else if (e.key === 'ArrowLeft') {
      const p = parentOf(i);
      if (p >= 0) go(p);
    } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      if (e.key === 'ArrowRight' && row.lit && row.node.children?.length) go(i + 1);
      else if (!row.current) onOpen(row.node);
    } else return;
    e.preventDefault();
  };

  return (
    <div className="quill-tree" role="tree" aria-label={label} data-light={light}>
      {rows.map((row, i) => (
        <TreeRow
          key={row.node.id}
          row={row}
          rowRef={(el) => void (refs.current[i] = el)}
          tabbable={i === at}
          ringFor={ringFor}
          onOpen={onOpen}
          onKey={(e) => onKey(e, i)}
          onFocus={() => setFocus(i)}
          guides={guides[i]!}
        />
      ))}
    </div>
  );
}

interface TreeRowProps {
  row: Row;
  rowRef: (el: HTMLDivElement | null) => void;
  tabbable: boolean;
  ringFor?: (node: PathNode) => RingSubject | undefined;
  onOpen: (node: PathNode) => void;
  onKey: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  guides: Guide[];
}

function TreeRow({ row, rowRef, tabbable, ringFor, onOpen, onKey, onFocus, guides }: TreeRowProps) {
  const { node, level, lit, current } = row;
  const ring = useRingTarget(() => ringFor?.(node));
  const keys = ring.onKeyDown;
  return (
    <div
      ref={rowRef}
      role="treeitem"
      aria-level={level + 1}
      aria-expanded={node.children?.length ? lit : undefined}
      aria-current={current ? 'page' : undefined}
      aria-selected={current}
      aria-disabled={node.locked ? true : undefined}
      tabIndex={tabbable ? 0 : -1}
      title={node.locked}
      className={cx('quill-tree-row', lit ? 'quill-tree-lit' : undefined, row.inside ? 'quill-tree-inside' : undefined)}
      data-current={current ? '' : undefined}
      data-level={level}
      style={{ '--tree-level': level } as CSSProperties}
      {...ring}
      onKeyDown={(e) => {
        keys(e);
        if (!e.defaultPrevented) onKey(e);
      }}
      onFocus={onFocus}
      onClick={() => {
        if (!current) onOpen(node);
      }}
    >
      {guides.map((g) => (
        <span key={`${g.level}-${g.part}`} className="quill-tree-line" aria-hidden="true" data-part={g.part} style={{ '--line-level': g.level } as CSSProperties} />
      ))}
      <span className="quill-tree-dot" aria-hidden="true" />
      {node.icon ? <Icon name={node.locked ? 'lock' : node.icon} size={16} className="quill-tree-icon" /> : null}
      <span className="quill-tree-label">{node.label}</span>
      {node.count != null ? <span className="quill-tree-count">{node.count}</span> : null}
    </div>
  );
}
