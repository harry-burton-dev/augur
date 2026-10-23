import { serviceHeaders, type ServiceCredentials } from './service.js';

/** Where a floor sits, as identity tells the platform's services. */
export interface FloorPlace {
  id: string;
  kind: 'org' | 'personal' | 'team';
  /** Ids from the floor's root down to it, itself included. A personal floor is alone on its path. */
  path: string[];
  /** The org's id: every rule starts there, a personal floor's included. */
  org: string;
  archivedAt?: string;
}

/** Identity could not say where a floor sits; the call should be refused for now, not let through. */
export class FloorsUnavailable extends Error {}

export interface FloorPlacesOptions {
  /** Identity's internal address, e.g. http://identity:8081. */
  identityUrl: string;
  /** This service's own credentials: only platform services may ask. */
  credentials: ServiceCredentials;
  ttlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** Where a floor sits, or undefined when there is no such floor. */
export type FloorLookup = (id: string) => Promise<FloorPlace | undefined>;

/**
 * Asks identity where a floor sits, and remembers each answer for 30 seconds,
 * so a team moved in identity reaches every service within that time. A failed
 * lookup isn't remembered.
 */
export const floorPlaces = ({ identityUrl, credentials, ttlMs = 30_000, fetchImpl = fetch, now = Date.now }: FloorPlacesOptions): FloorLookup => {
  const cache = new Map<string, { place: FloorPlace | undefined; at: number }>();
  return async (id) => {
    const hit = cache.get(id);
    if (hit && now() - hit.at < ttlMs) return hit.place;
    let res: Response;
    try {
      res = await fetchImpl(`${identityUrl.replace(/\/$/, '')}/v1/workspaces/${encodeURIComponent(id)}`, { headers: await serviceHeaders(credentials) });
    } catch (err) {
      throw new FloorsUnavailable(`Identity could not be reached (${(err as Error).message}).`);
    }
    let place: FloorPlace | undefined;
    if (res.status === 404) place = undefined;
    else if (res.ok) place = (await res.json()) as FloorPlace;
    else throw new FloorsUnavailable(`Identity answered ${res.status}.`);
    cache.set(id, { place, at: now() });
    return place;
  };
};

/** The floors a rule can come from for this one, from the org down to it: a personal floor sits under the org for rules, though nobody else stands on it. */
export const ruleChain = (place: FloorPlace) => (place.kind === 'personal' ? [place.org, place.id] : place.path);

/** Everyone who can stand on a team, asked fresh each time: team notices go only to who is on it now. */
export type MemberLookup = (team: string) => Promise<string[]>;

export const floorMembers = ({ identityUrl, credentials, fetchImpl = fetch }: Omit<FloorPlacesOptions, 'ttlMs' | 'now'>): MemberLookup => async (team) => {
  let res: Response;
  try {
    res = await fetchImpl(`${identityUrl.replace(/\/$/, '')}/v1/workspaces/${encodeURIComponent(team)}/people`, { headers: await serviceHeaders(credentials) });
  } catch (err) {
    throw new FloorsUnavailable(`Identity could not be reached (${(err as Error).message}).`);
  }
  if (res.status === 404) return [];
  if (!res.ok) throw new FloorsUnavailable(`Identity answered ${res.status}.`);
  return ((await res.json()) as { people: string[] }).people;
};
