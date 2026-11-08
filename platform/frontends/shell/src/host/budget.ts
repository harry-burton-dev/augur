/**
 * What an app may draw (spec 6.9): no more than so many nodes in one flush of its mutations, and no
 * more than so many alive in all its roots at once. Lists and tables send rows as one property, so
 * a well-made screen stays far inside both; an app past either has stopped answering usefully, and the
 * host stops it, with the reason, before it can slow the shell or anyone else's app.
 *
 * The host keeps the shape of each root's tree (ids only) to count what a removal takes away. It
 * holds the app to that shape: an insert that reuses an id, names a parent it doesn't know or an index
 * outside the children is refused, so the count and what is drawn can't drift apart. Everything the
 * app sends (each record, each message) also counts against a rate, so a flood of small updates is
 * stopped as surely as one large one.
 */
export interface Budgets {
  /** Nodes one flush may insert. */
  perFlush: number;
  /** Nodes alive across the app's roots. */
  live: number;
  /** Records and messages one second may bring. */
  perSecond: number;
  /** After first paint, how long the app may go without answering the host's check. */
  hangMs: number;
  /** First paint after this long says the app is slow to open. */
  slowMs: number;
  /** No first paint after this long: the app failed to open. */
  failMs: number;
}

/** The spec's starting budgets (6.9). */
export const DEFAULT_BUDGETS: Budgets = { perFlush: 2000, live: 50_000, perSecond: 20_000, hangMs: 10_000, slowMs: 5000, failMs: 30_000 };

interface Serialized {
  id: string;
  children?: Serialized[];
}

/** Why a flush broke the budget, or undefined while it holds. */
export type Overrun =
  | { kind: 'flush'; nodes: number; limit: number }
  | { kind: 'live'; nodes: number; limit: number }
  | { kind: 'rate'; nodes: number; limit: number }
  | { kind: 'malformed'; problem: string };

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
   * or the shape broke, if it did; the host then stops the app without drawing the flush.
   */
  take(root: string, records: readonly unknown[]): Overrun | undefined {
    let inserted = 0;
    for (const r of records) if (Array.isArray(r) && r[0] === 0) inserted += size(r[2] as Serialized);
    if (inserted > this.budgets.perFlush) return { kind: 'flush', nodes: inserted, limit: this.budgets.perFlush };
    // A flush that breaks the budget or the shape stops the app, so its count is never used again.
    let tree = this.#trees.get(root);
    if (!tree) this.#trees.set(root, (tree = new Map([[ROOT, []]])));
    const kidsOf = (id: string) => tree.get(id);
    let live = this.#live;
    for (const r of records) {
      if (!Array.isArray(r)) return { kind: 'malformed', problem: 'a change the shell couldn’t read' };
      if (r[0] === 0) {
        const kids = kidsOf(String(r[1]));
        if (!kids) return { kind: 'malformed', problem: 'a change to something it hadn’t drawn' };
        const at = r[3] === undefined ? kids.length : r[3];
        if (!Number.isInteger(at) || (at as number) < 0 || (at as number) > kids.length) return { kind: 'malformed', problem: 'a change at a place that isn’t there' };
        const node = r[2] as Serialized;
        if (!fresh(tree, node)) return { kind: 'malformed', problem: 'two things under one name' };
        kids.splice(at as number, 0, node.id);
        live += add(tree, node);
      } else if (r[0] === 1) {
        const kids = kidsOf(String(r[1]));
        const at = r[2];
        if (!kids || !Number.isInteger(at) || (at as number) < 0 || (at as number) >= kids.length) return { kind: 'malformed', problem: 'a change at a place that isn’t there' };
        live -= drop(tree, kids.splice(at as number, 1)[0]!);
      }
    }
    if (live > this.budgets.live) return { kind: 'live', nodes: live, limit: this.budgets.live };
    this.#live = live;
    return undefined;
  }
}

/**
 * Everything an app sends, against `perSecond`: each message counts one, and each record in a flush
 * one more. A screen that redraws as the person types stays far inside it.
 */
export class RateBudget {
  #since = -Infinity;
  #count = 0;

  constructor(
    private readonly limit: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  take(weight: number): Overrun | undefined {
    const t = this.now();
    if (t - this.#since >= 1000) {
      this.#since = t;
      this.#count = 0;
    }
    this.#count += weight;
    return this.#count > this.limit ? { kind: 'rate', nodes: this.#count, limit: this.limit } : undefined;
  }
}

/** Whether no id in `node` is drawn already, or repeated inside it. */
function fresh(tree: Map<string, string[]>, node: Serialized | undefined, seen = new Set<string>()): boolean {
  if (!node || typeof node.id !== 'string' || node.id === ROOT || tree.has(node.id) || seen.has(node.id)) return false;
  seen.add(node.id);
  return (node.children ?? []).every((c) => fresh(tree, c, seen));
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
