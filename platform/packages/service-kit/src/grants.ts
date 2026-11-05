import type { Scope } from './apps.js';
import { serviceHeaders, type ServiceCredentials } from './service.js';
import { withDeadline } from './deadline.js';
import { BoundedMap } from './cache.js';

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
  const cache = new BoundedMap<string, { scopes: readonly Scope[]; at: number }>();
  return async (app, workspace) => {
    const key = `${app} ${workspace ?? ''}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.scopes;
    const url = new URL(`${registryUrl.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(app)}/grants`);
    if (workspace) url.searchParams.set('workspace', workspace);
    let res: Response;
    try {
      res = await withDeadline(fetchImpl)(url, { headers: await serviceHeaders(credentials) });
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

/** The ids of the inbox kinds an app's manifest declares; undefined from a registry too old to say. */
export type InboxKindsLookup = (app: string) => Promise<string[] | undefined>;
/** The ids of the notification kinds an app's manifest declares; undefined from a registry too old to say. */
export type NotificationKindsLookup = InboxKindsLookup;

/** Asks the registry for one list of kinds an app declares, with the same call as its grants, remembering each answer for 30 seconds. */
const registryKinds =
  (field: 'inboxKinds' | 'notificationKinds') =>
  ({ registryUrl, credentials, ttlMs = 30_000, fetchImpl = fetch, now = Date.now }: GrantsOptions): InboxKindsLookup => {
    const cache = new BoundedMap<string, { kinds: string[] | undefined; at: number }>();
    return async (app) => {
      const hit = cache.get(app);
      if (hit && now() - hit.at < ttlMs) return hit.kinds;
      let res: Response;
      try {
        res = await withDeadline(fetchImpl)(`${registryUrl.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(app)}/grants`, { headers: await serviceHeaders(credentials) });
      } catch (err) {
        throw new GrantsUnavailable(`The registry could not be reached (${(err as Error).message}).`);
      }
      let kinds: string[] | undefined;
      if (res.status === 404) kinds = [];
      else if (res.ok) kinds = ((await res.json()) as Partial<Record<typeof field, string[]>>)[field];
      else throw new GrantsUnavailable(`The registry answered ${res.status}.`);
      cache.set(app, { kinds, at: now() });
      return kinds;
    };
  };

/** Which inbox kinds an app declares (its `inbox.kinds`). An app that isn't registered has none. */
export const registryInboxKinds = registryKinds('inboxKinds');

/** Which notification kinds an app declares (its `notifications.kinds`). An app that isn't registered has none. */
export const registryNotificationKinds = registryKinds('notificationKinds');
