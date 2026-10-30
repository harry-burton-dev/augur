import type { Floor } from './access.js';

/**
 * Publishing up the floors. Something made on a floor is published to a floor
 * above it, through a filter (the lifecycle states that floor may see): that's
 * a placement. A floor that has received it may publish it further up, never
 * with a wider filter than it received. Nothing is copied: a placement is a
 * live window onto the record, so what's added later shows through too.
 *
 * There is only ever one owner. Until it's published it's its own floor's;
 * after, the floor highest up that it has reached owns it, and every step on
 * the way is kept.
 */
export interface Placement<S extends string = string> {
  id: string;
  /** The record published: the top of what the window shows. */
  record: string;
  /** The floor it was published from: the record's own, or the floor that received it below. */
  from: string;
  /** The floor it was published to. */
  to: string;
  /** How high `to` sits: `floorRank` of it. */
  rank: number;
  /** The states that floor sees. */
  filter: readonly S[];
  /** The placement it came up through; none when it was published from its own floor. */
  via?: string;
  by: string;
  at: string;
  /** When it was taken back. A placement taken back takes back every one above it that came through it. */
  endedAt?: string;
}

/**
 * How high a floor sits, lower is higher: the org is 0, a team is how deep it
 * is (1 for a top team), and someone's own floor is lowest of all.
 */
export const floorRank = (floor: Pick<Floor, 'kind' | 'path'>) => (floor.kind === 'org' ? 0 : floor.kind === 'team' ? Math.max(1, floor.path.length) : Number.MAX_SAFE_INTEGER);

/**
 * The floors above `from` that it can be published to. Above a team are the
 * teams it sits in and the org; above someone's own floor are the teams they're
 * on (`team:` and `tree:` principals name them) and the org. Never sideways.
 */
export const floorsAbove = (from: Pick<Floor, 'id' | 'kind' | 'path'>, principals: readonly string[] = []): string[] => {
  if (from.kind === 'org') return [];
  const teams =
    from.kind === 'team'
      ? from.path.filter((id) => id !== from.id)
      : [...new Set(principals.filter((p) => p.startsWith('team:') || p.startsWith('tree:')).map((p) => p.slice(p.indexOf(':') + 1)))];
  return [...teams, 'org'];
};

export const live = <P extends Pick<Placement, 'endedAt'>>(placements: readonly P[]) => placements.filter((p) => !p.endedAt);

/** The steps a placement came up by, from the record's own floor up to it. */
export const chainOf = <P extends Placement>(placements: readonly P[], id: string): P[] => {
  const byId = new Map(placements.map((p) => [p.id, p]));
  const chain: P[] = [];
  const seen = new Set<string>();
  for (let at = byId.get(id); at && !seen.has(at.id); at = at.via ? byId.get(at.via) : undefined) {
    seen.add(at.id);
    chain.unshift(at);
  }
  return chain;
};

/** The highest of these, the earliest first among equals, or undefined when there are none. */
export const highest = <P extends Pick<Placement, 'rank' | 'at' | 'id'>>(placements: readonly P[]): P | undefined =>
  [...placements].sort((a, b) => a.rank - b.rank || a.at.localeCompare(b.at) || a.id.localeCompare(b.id))[0];

/**
 * Who owns a record now: the floor its highest live placement reached, or its
 * own floor while it hasn't been published. One owner, whatever the branches.
 */
export const ownerOf = (own: string, placements: readonly Placement[]) => highest(live(placements))?.to ?? own;

/** The live placements that came up through `id`, however far: what taking it back takes back too. */
export const above = <P extends Placement>(placements: readonly P[], id: string): P[] => {
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of placements)
      if (!p.endedAt && p.via && ids.has(p.via) && !ids.has(p.id)) {
        ids.add(p.id);
        grew = true;
      }
  }
  ids.delete(id);
  return placements.filter((p) => ids.has(p.id));
};

/** States in `wanted` that `received` doesn't let through: a floor can't show more than it was shown. */
export const wider = <S extends string>(wanted: readonly S[], received: readonly S[]) => wanted.filter((s) => !received.includes(s));

/**
 * Why a record can't be published that way, in words a person can act on, or
 * undefined when it can. `via` is the placement the publishing floor received
 * it by, when it isn't the record's own floor.
 */
export const placementRefusal = <S extends string>({
  from,
  to,
  principals,
  filter,
  via,
  existing,
}: {
  from: Pick<Floor, 'id' | 'kind' | 'path'>;
  to: string;
  principals?: readonly string[];
  filter: readonly S[];
  via?: Pick<Placement<S>, 'filter' | 'to' | 'endedAt'>;
  /** The record's placements so far. */
  existing: readonly Pick<Placement, 'to' | 'endedAt'>[];
}): string | undefined => {
  if (!filter.length) return 'Choose at least one state for them to see.';
  if (via && (via.endedAt || via.to !== from.id)) return 'That floor no longer has it to publish.';
  if (!floorsAbove(from, principals).includes(to)) return 'Publish up to a floor above this one: a team it’s in, or the org. To show a floor beside it, share it instead.';
  if (via && wider(filter, via.filter).length) return 'A floor can’t show more than it was shown: choose from the states it received.';
  if (live(existing).some((p) => p.to === to)) return 'It’s already on that floor. Change what it shows there instead.';
  return undefined;
};

/**
 * What someone sees of a record they reach only through placements: the one
 * place they see it (the highest floor that shows it to them) and every state
 * any of those floors lets them see, each with the highest floor that shows it.
 */
export const viewFor = <S extends string, P extends Placement<S>>(reaching: readonly P[]): { place: P; states: Map<S, P> } | undefined => {
  const shown = live(reaching);
  const place = highest(shown);
  if (!place) return undefined;
  const states = new Map<S, P>();
  for (const p of [...shown].sort((a, b) => a.rank - b.rank || a.at.localeCompare(b.at)))
    for (const s of p.filter) if (!states.has(s)) states.set(s, p);
  return { place, states };
};
