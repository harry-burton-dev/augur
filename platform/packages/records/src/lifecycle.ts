import { reaches, type Level } from './access.js';

/** One step of a lifecycle. */
export interface StateDef<S extends string = string> {
  id: S;
  /** What people call it, such as "In review". */
  name: string;
  /** What it means, in a line, for whoever is choosing it. */
  meaning: string;
}

/** A way from one state to another, and how far in you have to be to take it. */
export interface MoveDef<S extends string = string> {
  /** Where it starts; `*` from any state. */
  from: S | '*';
  to: S;
  needs: Level;
}

export interface LifecycleDef<S extends string = string> {
  states: readonly StateDef<S>[];
  /** Where something new starts. */
  initial: S;
  moves: readonly MoveDef<S>[];
  /** The states someone picking a filter is offered first. Those left out are still there, just not ticked. */
  defaultFilter?: readonly S[];
}

export class BadMoveError extends Error {}

export interface Lifecycle<S extends string = string> {
  readonly states: readonly StateDef<S>[];
  readonly initial: S;
  readonly defaultFilter: readonly S[];
  is(id: unknown): id is S;
  get(id: S): StateDef<S>;
  /** How far in you have to be to move from one state to another, or undefined when there’s no such move. */
  needs(from: S, to: S): Level | undefined;
  /** Where someone that far in may move it from `from`. */
  movesFrom(from: S, level: Level | undefined): S[];
  /** Throws a BadMoveError, in words a person can act on, unless someone that far in may make the move. */
  check(from: S, to: S, level: Level | undefined): void;
  /** Whether a state passes a filter: the set of states someone chose to let through. */
  passes(filter: Iterable<S>, state: S): boolean;
  /** States in a filter, in the lifecycle’s own order, without repeats or strangers. */
  tidy(filter: Iterable<unknown>): S[];
}

/** A lifecycle from its states and the moves between them. */
export const defineLifecycle = <S extends string>({ states, initial, moves, defaultFilter }: LifecycleDef<S>): Lifecycle<S> => {
  const byId = new Map(states.map((s) => [s.id, s]));
  if (!byId.has(initial)) throw new Error(`${initial} isn’t one of the states.`);
  for (const m of moves) if ((m.from !== '*' && !byId.has(m.from)) || !byId.has(m.to)) throw new Error(`A move from ${m.from} to ${m.to} goes outside the states.`);
  const get = (id: S) => {
    const s = byId.get(id);
    if (!s) throw new BadMoveError(`There’s no such state as ${id}.`);
    return s;
  };
  /** The least that lets someone make the move, when there’s a choice of ways. */
  const needs = (from: S, to: S) => {
    if (from === to) return undefined;
    const ways = moves.filter((m) => m.to === to && (m.from === from || m.from === '*')).map((m) => m.needs);
    return ways.find((l) => l === 'read') ?? ways.find((l) => l === 'edit') ?? ways.find((l) => l === 'manage');
  };
  const order = (filter: Iterable<unknown>) => {
    const wanted = new Set(filter);
    return states.map((s) => s.id).filter((id) => wanted.has(id));
  };
  return {
    states,
    initial,
    defaultFilter: order(defaultFilter ?? states.map((s) => s.id)),
    is: (id: unknown): id is S => typeof id === 'string' && byId.has(id as S),
    get,
    needs,
    movesFrom: (from, level) => states.map((s) => s.id).filter((to) => {
      const need = needs(from, to);
      return Boolean(need && reaches(level, need));
    }),
    check: (from, to, level) => {
      const need = needs(from, to);
      if (!need) throw new BadMoveError(from === to ? `It’s already ${get(to).name}.` : `Something ${get(from).name} can’t become ${get(to).name}.`);
      if (!reaches(level, need)) throw new BadMoveError(`Only whoever ${need === 'manage' ? 'manages' : 'can change'} it can make it ${get(to).name}.`);
    },
    passes: (filter, state) => new Set(filter).has(state),
    tidy: order,
  };
};

/** One version of something, as a lifecycle filter sees it. */
export interface Staged<S extends string = string> {
  number: number;
  state: S;
}

/**
 * The newest version that passes a filter: what someone the filter lets in sees
 * of it. Undefined when none does, and then they don’t see it at all.
 */
export const newestPassing = <S extends string, V extends Staged<S>>(versions: readonly V[], filter: Iterable<S>): V | undefined => {
  const wanted = new Set(filter);
  return versions.filter((v) => wanted.has(v.state)).reduce<V | undefined>((best, v) => (!best || v.number > best.number ? v : best), undefined);
};

/** One move kept on the record. */
export interface StateChange<S extends string = string> {
  from?: S;
  to: S;
  by: string;
  at: string;
  /** Why, when they said. */
  note?: string;
}

/**
 * The lifecycle Artifacts gives a file’s versions, and the one to start from
 * for any app’s content: worked on, looked over, finished, put out as final,
 * and set aside. Each version has its own, so working on the next one never
 * takes back the one people already have.
 */
export const CONTENT_LIFECYCLE = defineLifecycle<ContentState>({
  states: [
    { id: 'in-progress', name: 'In progress', meaning: 'Being worked on.' },
    { id: 'in-review', name: 'In review', meaning: 'Ready for others to look over.' },
    { id: 'complete', name: 'Complete', meaning: 'Finished, and checked.' },
    { id: 'issued', name: 'Issued', meaning: 'Put out as final.' },
    { id: 'retired', name: 'Retired', meaning: 'Superseded or withdrawn: kept, but no longer current.' },
  ],
  initial: 'in-progress',
  moves: [
    { from: 'in-progress', to: 'in-review', needs: 'edit' },
    { from: 'in-progress', to: 'complete', needs: 'edit' },
    { from: 'in-review', to: 'in-progress', needs: 'edit' },
    { from: 'in-review', to: 'complete', needs: 'edit' },
    { from: 'complete', to: 'in-progress', needs: 'edit' },
    { from: 'complete', to: 'in-review', needs: 'edit' },
    { from: 'in-progress', to: 'issued', needs: 'manage' },
    { from: 'in-review', to: 'issued', needs: 'manage' },
    { from: 'complete', to: 'issued', needs: 'manage' },
    { from: '*', to: 'retired', needs: 'manage' },
    { from: 'retired', to: 'issued', needs: 'manage' },
  ],
  defaultFilter: ['issued'],
});
export type ContentState = 'in-progress' | 'in-review' | 'complete' | 'issued' | 'retired';

/**
 * The lifecycle Artifacts gives everything that holds content (a collection,
 * a series): open to more, closed to more, or put away. Archiving hides it
 * from the usual views and deletes nothing.
 */
export const CONTAINER_LIFECYCLE = defineLifecycle<ContainerState>({
  states: [
    { id: 'open', name: 'Open', meaning: 'Taking new things.' },
    { id: 'closed', name: 'Closed', meaning: 'Kept as it is: nothing new goes in.' },
    { id: 'archived', name: 'Archived', meaning: 'Put away: off the usual views, with nothing deleted.' },
  ],
  initial: 'open',
  moves: [
    { from: 'open', to: 'closed', needs: 'manage' },
    { from: 'closed', to: 'open', needs: 'manage' },
    { from: '*', to: 'archived', needs: 'manage' },
    { from: 'archived', to: 'open', needs: 'manage' },
  ],
});
export type ContainerState = 'open' | 'closed' | 'archived';
