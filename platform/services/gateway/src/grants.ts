import { callerHeaders, GATEWAY_CALLER, signedCallerHeaders, withDeadline, type CallerSigner } from '@augur/service-kit';

/**
 * What an app may do (contract 3, spec 8.2 and 8.3). The gateway admits an app's own token only for an app the
 * registry knows and has on, and holds each call to the scopes the app is granted on the floor it is for.
 * The registry's answer is kept for 30 seconds, as the services keep theirs, so a change reaches the gateway
 * in that time.
 */

/** What the registry says of one app: what it is called, whether it is on where the call is for, and its scopes there. */
export interface AppGrant {
  name?: string;
  on: boolean;
  scopes: readonly string[];
}

/** An app's grant on a floor (or on the organisation's, with none); `undefined` for an app the registry doesn't know. */
export type AppGrants = (app: string, workspace?: string) => Promise<AppGrant | undefined>;

/** The registry could not say; the call is refused for now, not let through. */
export class AppGrantsUnavailable extends Error {}

export interface RegistryGrantsOptions {
  registryUrl: string;
  /** Signs the gateway itself for the registry, which believes no other caller. */
  signer?: CallerSigner;
  ttlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** Apps and floors to remember at once; past this the oldest is forgotten first. */
const MAX_REMEMBERED = 5000;

/** Asks the registry what an app is granted where, as the gateway, remembering each answer for `ttlMs`. */
export const registryGrantsFor = ({ registryUrl, signer, ttlMs = 30_000, fetchImpl = fetch, now = Date.now }: RegistryGrantsOptions): AppGrants => {
  const cache = new Map<string, { grant: AppGrant | undefined; at: number }>();
  return async (app, workspace) => {
    const key = `${app} ${workspace ?? ''}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.grant;
    const url = new URL(`${registryUrl.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(app)}/grants`);
    if (workspace) url.searchParams.set('workspace', workspace);
    let res: Response;
    try {
      const headers = { ...callerHeaders(GATEWAY_CALLER), ...(signer ? await signedCallerHeaders(signer, GATEWAY_CALLER, 'registry') : {}) };
      res = await withDeadline(fetchImpl)(url, { headers });
    } catch (err) {
      throw new AppGrantsUnavailable(`the registry could not be reached (${(err as Error).message})`);
    }
    let grant: AppGrant | undefined;
    if (res.status === 404) grant = undefined;
    else if (res.ok) {
      const body = (await res.json()) as { name?: string; on?: boolean; scopes?: string[] };
      // A registry from before contract 3 doesn't say whether the app is on; it isn't said off, and its scopes still bound the call.
      grant = { ...(body.name ? { name: body.name } : {}), on: body.on ?? true, scopes: body.scopes ?? [] };
    } else throw new AppGrantsUnavailable(`the registry answered ${res.status}`);
    cache.delete(key);
    cache.set(key, { grant, at: now() });
    if (cache.size > MAX_REMEMBERED) cache.delete(cache.keys().next().value!);
    return grant;
  };
};

/**
 * Which scope a call to one of AUGUR's APIs needs when an app makes it (spec 8.3), the same scopes the services
 * check as their second line. A route not listed here is not one an app may call: an app reaches AUGUR only
 * for what it can be granted, and reaches its own routes (`/api/<id>/*`) and its own registry entry with no
 * scope at all.
 */
const ROUTE_SCOPES: { method: RegExp; path: RegExp; scope: string }[] = [
  { method: /^POST$/, path: /^\/api\/events\/v1\/notifications\/?$/, scope: 'notifications:send' },
  { method: /^POST$/, path: /^\/api\/events\/v1\/audit\/?$/, scope: 'audit:write' },
  { method: /^POST$/, path: /^\/api\/events\/v1\/domain-events\/?$/, scope: 'events:publish' },
  { method: /^GET$/, path: /^\/api\/events\/v1\/domain-events(\/stream)?\/?$/, scope: 'events:subscribe' },
  { method: /^(PUT|PATCH|DELETE)$/, path: /^\/api\/events\/v1\/inbox\/items\//, scope: 'inbox:write' },
  { method: /^GET$/, path: /^\/api\/identity\/v1\/(people\/[^/]+\/principals|directory|members)\/?$/, scope: 'people:read' },
  { method: /^(GET|POST)$/, path: /^\/api\/models\/v1\/(status|chat|embeddings)\/?$/, scope: 'models:use' },
];

/** What a scope lets an app do, in words for a refusal: "send notifications (notifications:send)". */
export const SCOPE_WORDS: Record<string, string> = {
  'notifications:send': 'send notifications',
  'audit:write': 'write to the audit log',
  'models:use': 'use the models',
  'events:publish': 'publish events',
  'events:subscribe': 'read events',
  'people:read': 'look people up',
  'inbox:write': 'write to inboxes',
};

/**
 * What an app's call to `/api/<service>/…` needs: a scope's name, `null` for a route it may always call (its own
 * routes, its own registry entry), or `undefined` for a route apps don't call.
 */
export const scopeFor = (method: string, url: string, app: string, platformServices: readonly string[]): string | null | undefined => {
  const path = url.split('?')[0]!;
  const name = /^\/api\/([^/?#]+)/.exec(path)?.[1];
  if (!name) return undefined;
  if (name === app) return null;
  if (!platformServices.includes(name)) return undefined;
  if (name === 'registry') return new RegExp(`^/api/registry/v1/apps/${app}(/|$)`).test(path) ? null : undefined;
  return ROUTE_SCOPES.find((r) => r.method.test(method) && r.path.test(path))?.scope;
};

/** Why an app's call is refused, in the words of spec 8.3. */
export const notAllowed = (appName: string, scope: string | undefined, path: string): string =>
  scope ? `${appName} isn’t allowed to ${SCOPE_WORDS[scope] ?? `do that`} (${scope}).` : `${appName} isn’t allowed to call ${path.split('?')[0]}.`;
