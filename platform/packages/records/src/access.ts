/**
 * How far someone is let into a record: read it; edit (add to it and change it);
 * manage (also share it, rename it, move it through the steps only its managers
 * may, and archive it).
 */
export type Level = 'read' | 'edit' | 'manage';
export const LEVELS: readonly Level[] = ['read', 'edit', 'manage'];

/**
 * Who something is let in to, as identity names them (`principalsOf` there):
 * `person:<id>`, `team:<id>` (that team's members), `tree:<id>` (that team and
 * every team below it), or `org`. A caller stands for several at once.
 */
export const PRINCIPAL = /^(?:(?:person|team|tree):[A-Za-z0-9._@-]{1,100}|org)$/;

/** Someone let in that far. */
export interface Grant {
  principal: string;
  level: Level;
}

const RANK: Record<Level, number> = { read: 1, edit: 2, manage: 3 };

/** The furthest of these levels, or none. */
export const furthest = (...levels: (Level | undefined)[]) =>
  levels.reduce<Level | undefined>((best, l) => (l && (!best || RANK[l] > RANK[best]) ? l : best), undefined);

/** How far these grants let in someone who stands for `principals`. */
export const levelFrom = (grants: readonly Grant[], principals: readonly string[]) => furthest(...grants.filter((g) => principals.includes(g.principal)).map((g) => g.level));

/** At least `want`. */
export const reaches = (level: Level | undefined, want: Level) => Boolean(level && RANK[level] >= RANK[want]);

/**
 * How far someone gets into a record down a tree, where a grant on anything
 * above it reaches it too: the furthest of every grant on the way down, and of
 * what its floor already gives them. `chain` is each record's grants, top first.
 */
export const levelDown = (chain: readonly (readonly Grant[])[], principals: readonly string[], fromFloor?: Level) =>
  furthest(fromFloor, ...chain.map((grants) => levelFrom(grants, principals)));

/** A floor as rules need it: identity's FloorPlace has these and more. */
export interface Floor {
  id: string;
  kind: 'org' | 'personal' | 'team';
  /** For a team: ids from the top team down to it, itself included. */
  path: readonly string[];
}

/**
 * Who a floor lets in, as a principal: the owner on someone's own floor, a
 * team's members and those of the teams below it on a team's, everyone on the
 * org's. What's made on a floor can be read by them.
 */
export const floorPrincipal = (floor: Pick<Floor, 'id' | 'kind'>, owner?: string) =>
  floor.kind === 'org' ? 'org' : floor.kind === 'team' ? `tree:${floor.id}` : `person:${owner ?? floor.id}`;

/**
 * What a floor's own people get: its leads manage what's on it, everyone else
 * who stands on it reads it. Apps that let anyone on a floor add to it say so.
 */
export const floorLevel = (role: 'lead' | 'member' | string, { membersEdit = false } = {}): Level => (role === 'lead' ? 'manage' : membersEdit ? 'edit' : 'read');
