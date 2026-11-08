/**
 * What an app may draw (spec 6.9): no more than so many nodes in one flush of its mutations, and no
 * more than so many alive in all its roots at once. Lists and tables send rows as one property, so
 * a well-made screen stays far inside both; an app past either has stopped answering usefully, and the
 * host stops it, with the reason, before it can slow the shell or anyone else's app.
 *
 * The host keeps the shape of each root's tree (ids only) to count what a removal takes away.
 */
export interface Budgets {
  /** Nodes one flush may insert. */
  perFlush: number;
  /** Nodes alive across the app's roots. */
  live: number;
  /** First paint after this long says the app is slow to open. */
  slowMs: number;
  /** No first paint after this long: the app failed to open. */
  failMs: number;
}

/** The spec's starting budgets (6.9). */
export const DEFAULT_BUDGETS: Budgets = { perFlush: 2000, live: 50_000, slowMs: 5000, failMs: 30_000 };

interface Serialized {
  id: string;
  children?: Serialized[];
}

/** Why a flush broke the budget, or undefined while it holds. */
export type Overrun = { kind: 'flush'; nodes: number; limit: number } | { kind: 'live'; nodes: number; limit: number };

const ROOT = '~';

export class NodeBudget {
  /** Each node's children by id, per root; the root itself is '~'. */
  readonly #trees = new Map<string, Map<string, string[]>>();
  #live = 0;

  constructor(private readonly budgets: Pick<Budgets, 'perFlush' | 'live'> = DEFAULT_BUDGETS) {}

  get live() {
    return this.#live;
  }

  /**
   * Takes one flush of `root`'s records into the count, before they are drawn. Says how the budget
   * broke, if it did; the flush is then not counted, since the host won't draw it.
   */
  take(root: string, records: readonly unknown[]): Overrun | undefined {
    let inserted = 0;
    for (const r of records) if (Array.isArray(r) && r[0] === 0) inserted += size(r[2] as Serialized);
    if (inserted > this.budgets.perFlush) return { kind: 'flush', nodes: inserted, limit: this.budgets.perFlush };
    let tree = this.#trees.get(root);
    if (!tree) this.#trees.set(root, (tree = new Map([[ROOT, []]])));
    let live = this.#live;
    for (const r of records) {
      if (!Array.isArray(r)) continue;
      if (r[0] === 0) {
        const kids = (tree.get(String(r[1])) ?? []) as string[];
        if (!tree.has(String(r[1]))) tree.set(String(r[1]), kids);
        const at = typeof r[3] === 'number' ? Math.min(r[3], kids.length) : kids.length;
        kids.splice(at, 0, (r[2] as Serialized).id);
        live += add(tree, r[2] as Serialized);
      } else if (r[0] === 1) {
        const kids = tree.get(String(r[1]));
        const gone = kids?.splice(Number(r[2]), 1)[0];
        if (gone !== undefined) live -= drop(tree, gone);
      }
    }
    if (live > this.budgets.live) return { kind: 'live', nodes: live, limit: this.budgets.live };
    this.#live = live;
    return undefined;
  }
}

function size(node: Serialized | undefined): number {
  if (!node) return 0;
  let n = 1;
  for (const child of node.children ?? []) n += size(child);
  return n;
}

function add(tree: Map<string, string[]>, node: Serialized): number {
  tree.set(node.id, (node.children ?? []).map((c) => c.id));
  let n = 1;
  for (const child of node.children ?? []) n += add(tree, child);
  return n;
}

function drop(tree: Map<string, string[]>, id: string): number {
  const kids = tree.get(id);
  tree.delete(id);
  let n = 1;
  for (const child of kids ?? []) n += drop(tree, child);
  return n;
}
