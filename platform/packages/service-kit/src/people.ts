import { serviceHeaders, type ServiceCredentials } from './service.js';
import { withDeadline } from './deadline.js';
import { BoundedMap } from './cache.js';

/** Identity could not say who someone is; the call should be refused for now, not let through. */
export class PeopleUnavailable extends Error {}

export interface PeopleOptions {
  /** Identity's internal address, e.g. http://identity:8081. */
  identityUrl: string;
  /** This service's own credentials. An app needs the `people:read` scope. */
  credentials: ServiceCredentials;
  ttlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Who someone stands for, as principals to match against who may see
 * something: `person:<id>`, `team:<id>` for each team they're on, `tree:<id>`
 * for each of those teams and every team above it, and `org`.
 */
export type PrincipalLookup = (person: string) => Promise<string[]>;

const ask = async (fetchImpl: typeof fetch, url: string | URL, credentials: ServiceCredentials) => {
  let res: Response;
  try {
    res = await withDeadline(fetchImpl)(url, { headers: await serviceHeaders(credentials) });
  } catch (err) {
    throw new PeopleUnavailable(`Identity could not be reached (${(err as Error).message}).`);
  }
  if (!res.ok) throw new PeopleUnavailable(`Identity answered ${res.status}.`);
  return res.json() as Promise<unknown>;
};

/**
 * Asks identity who a person stands for, and remembers each answer for 30
 * seconds, so someone added to or taken off a team counts within that time. A
 * failed lookup isn't remembered.
 */
export const identityPrincipals = ({ identityUrl, credentials, ttlMs = 30_000, fetchImpl = fetch, now = Date.now }: PeopleOptions): PrincipalLookup => {
  const cache = new BoundedMap<string, { principals: string[]; at: number }>();
  return async (person) => {
    const hit = cache.get(person);
    if (hit && now() - hit.at < ttlMs) return hit.principals;
    const { principals } = (await ask(fetchImpl, `${identityUrl.replace(/\/$/, '')}/v1/people/${encodeURIComponent(person)}/principals`, credentials)) as { principals: string[] };
    cache.set(person, { principals, at: now() });
    return principals;
  };
};

export interface DirectoryPerson {
  id: string;
  name: string;
  email?: string;
}

export interface DirectoryTeam {
  id: string;
  name: string;
  /** The names of the teams it sits in, from the top down; the org's left out. */
  within: string[];
  /** The ids of those teams, then its own: whether one team sits inside another. Identity 1.9. */
  path?: string[];
}

export interface DirectoryResult {
  people: DirectoryPerson[];
  teams: DirectoryTeam[];
}

/** Finds people and teams by name (`q`), or names the ones given by id (`ids`). */
export type DirectorySearch = (query: { q?: string; ids?: readonly string[]; limit?: number }) => Promise<DirectoryResult>;

export const identityDirectory = ({ identityUrl, credentials, fetchImpl = fetch }: Omit<PeopleOptions, 'ttlMs' | 'now'>): DirectorySearch => async ({ q, ids, limit }) => {
  const url = new URL(`${identityUrl.replace(/\/$/, '')}/v1/directory`);
  if (q) url.searchParams.set('q', q);
  if (ids) {
    if (!ids.length) return { people: [], teams: [] };
    url.searchParams.set('ids', ids.join(','));
  }
  if (limit) url.searchParams.set('limit', String(limit));
  return (await ask(fetchImpl, url, credentials)) as DirectoryResult;
};

/** Who an audience reaches: the ids of everyone who stands for at least one of the principals, whose sign-in works. */
export type AudienceLookup = (principals: readonly string[]) => Promise<string[]>;

export const identityAudience = ({ identityUrl, credentials, fetchImpl = fetch }: Omit<PeopleOptions, 'ttlMs' | 'now'>): AudienceLookup => async (principals) => {
  if (!principals.length) return [];
  const url = new URL(`${identityUrl.replace(/\/$/, '')}/v1/members`);
  url.searchParams.set('principals', principals.join(','));
  return ((await ask(fetchImpl, url, credentials)) as { people: string[] }).people;
};
