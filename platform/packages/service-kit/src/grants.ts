import type { Scope } from './apps.js';
import { serviceHeaders, type ServiceCredentials } from './service.js';

/** The registry could not say what an app is granted; the call should be refused for now, not let through. */
export class GrantsUnavailable extends Error {}

export interface GrantsOptions {
  /** The registry's internal address, e.g. http://registry:8082. */
  registryUrl: string;
  /** This service's own credentials: only platform services may ask. */
  credentials: ServiceCredentials;
  ttlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** What an app is granted on a floor (or anywhere, with no floor). */
export type GrantLookup = (app: string, workspace?: string) => Promise<readonly Scope[]>;

/**
 * Asks the registry what an app is granted on a floor, and remembers each
 * answer for 30 seconds, so a change in the registry reaches every service
 * within that time. A failed lookup isn't remembered.
 */
export const registryGrants = ({ registryUrl, credentials, ttlMs = 30_000, fetchImpl = fetch, now = Date.now }: GrantsOptions): GrantLookup => {
  const cache = new Map<string, { scopes: readonly Scope[]; at: number }>();
  return async (app, workspace) => {
    const key = `${app} ${workspace ?? ''}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.scopes;
    const url = new URL(`${registryUrl.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(app)}/grants`);
    if (workspace) url.searchParams.set('workspace', workspace);
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: await serviceHeaders(credentials) });
    } catch (err) {
      throw new GrantsUnavailable(`The registry could not be reached (${(err as Error).message}).`);
    }
    let scopes: readonly Scope[];
    if (res.status === 404) scopes = [];
    else if (res.ok) scopes = ((await res.json()) as { scopes: Scope[] }).scopes;
    else throw new GrantsUnavailable(`The registry answered ${res.status}.`);
    cache.set(key, { scopes, at: now() });
    return scopes;
  };
};
