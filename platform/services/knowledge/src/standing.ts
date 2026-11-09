import type { FloorLookup, PrincipalLookup } from '@augur/service-kit';

/** A floor as the store keeps it: its kind and the floor right above it. */
export interface FloorRow {
  id: string;
  kind: 'org' | 'team' | 'personal';
  parent?: string;
}

/** Where a person stands, as identity says: the floors from the org down (parents first), and the ones they are a member of. */
export interface Standing {
  floors: FloorRow[];
  memberOf: string[];
}

/** Where a person stands now. Throws an `…Unavailable` error when identity can't be asked. */
export type StandingLookup = (person: string) => Promise<Standing>;

/**
 * Asks identity where a person stands: who they stand for (`/people/{id}/principals`: each team they are on,
 * and the org) and where each of those floors sits (`/workspaces/{id}`). Both answers are kept for 30
 * seconds by the service kit, so someone taken off a team loses it here within that time. A person's own
 * floor isn't among them: identity names it only to its owner, and the gateway passes it on when they stand there.
 */
export const identityStanding = ({ principals, places }: { principals: PrincipalLookup; places: FloorLookup }): StandingLookup => async (person) => {
  const mine = await principals(person);
  const teams = mine.filter((p) => p.startsWith('team:')).map((p) => p.slice('team:'.length));
  const org = await places('org');
  if (!org) throw new Error('Identity has no organisation floor.');
  const found = (await Promise.all(teams.map((t) => places(t)))).filter((p) => p !== undefined && !p.archivedAt);
  const floors = new Map<string, FloorRow>([[org.id, { id: org.id, kind: 'org' }]]);
  // Each team's path runs from the org down to it, so every floor above a team comes with it.
  for (const place of found.sort((a, b) => a!.path.length - b!.path.length)) {
    place!.path.forEach((id, i) => {
      if (!floors.has(id)) floors.set(id, { id, kind: i === 0 ? 'org' : 'team', ...(i > 0 ? { parent: place!.path[i - 1] } : {}) });
    });
  }
  const depth = (f: FloorRow): number => (f.parent ? 1 + depth(floors.get(f.parent)!) : 0);
  return {
    floors: [...floors.values()].sort((a, b) => depth(a) - depth(b)),
    memberOf: [org.id, ...found.map((p) => p!.id)],
  };
};
