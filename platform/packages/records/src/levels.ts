/**
 * The levels an app’s records are built from, such as Artifacts' collection ›
 * subcollection › series › subseries › file. The levels give records their
 * form: each one says what may sit directly inside it, and which may sit at
 * the top. A level can be skipped (a file straight in a collection) but never
 * turned round (a collection inside a series).
 */
export interface LevelDef<L extends string = string> {
  id: L;
  /** What people call one, such as "Collection". */
  name: string;
  /** And several, such as "Collections". */
  plural: string;
  /** What may sit directly inside one. Empty for the level that holds the content itself. */
  holds: readonly L[];
}

/** What people may call a level instead, where an org renames them. */
export interface LevelName {
  name: string;
  plural: string;
}

/** The longest a level’s name may be. */
export const MAX_LEVEL_NAME = 30;

export class BadLevelError extends Error {}

export interface Levels<L extends string = string> {
  /** Top first, in the order they nest. */
  readonly all: readonly LevelDef<L>[];
  /** What may sit at the top, with nothing above it. */
  readonly top: readonly L[];
  /** A level by id; throws for one that isn't. */
  get(id: L): LevelDef<L>;
  is(id: unknown): id is L;
  /** Whether `child` may sit directly in `parent`, or at the top when there’s no parent. */
  canHold(parent: L | undefined, child: L): boolean;
  /** Why `child` can’t go there, in words a person can act on, or undefined when it can. */
  refusal(parent: L | undefined, child: L): string | undefined;
  /** The same levels, called what an org calls them. Names left out keep their own. */
  named(names: Partial<Record<L, LevelName>>): Levels<L>;
}

const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Checks a name people gave a level, and tidies its spaces. */
export const checkLevelName = (name: LevelName): LevelName => {
  const out = { name: cleanName(name.name), plural: cleanName(name.plural) };
  for (const n of [out.name, out.plural]) if (!n || n.length > MAX_LEVEL_NAME) throw new BadLevelError(`A level’s name is 1 to ${MAX_LEVEL_NAME} characters.`);
  return out;
};

/** "a collection", "an issue". */
const one = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name.toLowerCase()}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Levels from their definitions, top first. Every level a level holds must come
 * after it, so nothing can end up inside itself.
 */
export const defineLevels = <L extends string>(all: readonly LevelDef<L>[], top: readonly L[]): Levels<L> => {
  const byId = new Map(all.map((l, i) => [l.id, { def: l, at: i }]));
  for (const [i, l] of all.entries())
    for (const h of l.holds) {
      const held = byId.get(h);
      if (!held) throw new Error(`${l.id} holds ${h}, which isn’t a level.`);
      if (held.at <= i) throw new Error(`${l.id} holds ${h}, which comes before it.`);
    }
  for (const t of top) if (!byId.has(t)) throw new Error(`${t} isn’t a level.`);
  const get = (id: L) => {
    const found = byId.get(id);
    if (!found) throw new BadLevelError(`There’s no such level as ${id}.`);
    return found.def;
  };
  const canHold = (parent: L | undefined, child: L) => (parent ? get(parent).holds.includes(child) : top.includes(child));
  return {
    all,
    top,
    get,
    is: (id: unknown): id is L => typeof id === 'string' && byId.has(id as L),
    canHold,
    refusal: (parent, child) => {
      if (canHold(parent, child)) return undefined;
      const c = one(get(child).name);
      if (!parent) return `${capital(c)} has to go inside something: only ${top.map((t) => get(t).plural.toLowerCase()).join(' and ')} sit at the top.`;
      const p = get(parent);
      const fits = p.holds.map((h) => get(h).plural.toLowerCase());
      return fits.length ? `${capital(c)} can’t go in ${one(p.name)}: only ${fits.join(', ')} can.` : `Nothing can go in ${one(p.name)}.`;
    },
    named: (names) =>
      defineLevels(
        all.map((l) => (names[l.id] ? { ...l, ...checkLevelName(names[l.id]!) } : l)),
        top,
      ),
  };
};

/** Where a record sits, as a tree of them is walked: its id, its level and what it’s in. */
export interface Placed<L extends string = string> {
  id: string;
  level: L;
  parent?: string;
}

/** The records from the top down to `id`, itself included; empty when it isn’t among them. A loop stops the walk. */
export const pathTo = <T extends Placed>(records: readonly T[], id: string): T[] => {
  const byId = new Map(records.map((r) => [r.id, r]));
  const path: T[] = [];
  const seen = new Set<string>();
  for (let at = byId.get(id); at && !seen.has(at.id); at = at.parent ? byId.get(at.parent) : undefined) {
    seen.add(at.id);
    path.unshift(at);
  }
  return path;
};

/** `id` and every record inside it, however deep. */
export const within = <T extends Placed>(records: readonly T[], id: string): Set<string> => {
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of records)
      if (r.parent && ids.has(r.parent) && !ids.has(r.id)) {
        ids.add(r.id);
        grew = true;
      }
  }
  return ids;
};
