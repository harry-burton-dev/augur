import { callerHeaders, GATEWAY_CALLER, isPlatformScope, scopeWords, signedCallerHeaders, withDeadline, type CallerSigner, type PlatformScope } from '@augur/service-kit';

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
  /** AUGUR's own admin scopes (ADR 0083): only one of AUGUR's own frontends has any, and only for a person's call made through it. */
  platformScopes?: readonly PlatformScope[];
  /** The kind of the floor the grant was read on, when the registry knows it, so the call carries that floor to the service. */
  floorKind?: 'personal' | 'team' | 'org';
  /** The app contract the app is on (3); absent for an app on contract 2, whose part checks callers for its bare id. */
  contract?: number;
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
      const body = (await res.json()) as { name?: string; on?: boolean; scopes?: string[]; platformScopes?: string[]; floorKind?: AppGrant['floorKind']; contract?: number };
      // A registry from before contract 3 doesn't say whether the app is on; it isn't said off, and its scopes still bound the call.
      // Only names AUGUR knows as platform scopes are kept from what the registry says, and never among the app's scopes.
      const platformScopes = (body.platformScopes ?? []).filter(isPlatformScope);
      grant = {
        ...(body.name ? { name: body.name } : {}),
        on: body.on ?? true,
        scopes: (body.scopes ?? []).filter((s) => !isPlatformScope(s)),
        ...(platformScopes.length ? { platformScopes } : {}),
        ...(body.floorKind ? { floorKind: body.floorKind } : {}),
        ...(typeof body.contract === 'number' ? { contract: body.contract } : {}),
      };
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
  // The browser stream (/domain-events/stream) is the shell's; an app reads events page by page.
  { method: /^GET$/, path: /^\/api\/events\/v1\/domain-events\/?$/, scope: 'events:subscribe' },
  { method: /^(GET|PUT|PATCH)$/, path: /^\/api\/events\/v1\/inbox\/items\//, scope: 'inbox:write' },
  { method: /^GET$/, path: /^\/api\/identity\/v1\/(people\/[^/]+\/principals|directory|members)\/?$/, scope: 'people:read' },
  { method: /^POST$/, path: /^\/api\/models\/v1\/(chat|embeddings)\/?$/, scope: 'models:use' },
  // The knowledge graph (ADR 0079): its reads, the POST ones included, then its actions. retain is the one that
  // extracts, as its declaration in GET /actions says; the service checks each action's own scope again.
  { method: /^GET$/, path: /^\/api\/knowledge\/v1\/(meta|floors|actions|ontology)(\/|$)/, scope: 'knowledge:read' },
  { method: /^POST$/, path: /^\/api\/knowledge\/v1\/floors\/[^/]+\/(query|recall|known-entities)\/?$/, scope: 'knowledge:read' },
  { method: /^POST$/, path: /^\/api\/knowledge\/v1\/actions\/retain\/?$/, scope: 'knowledge:extract' },
  { method: /^POST$/, path: /^\/api\/knowledge\/v1\/actions\/[^/]+\/?$/, scope: 'knowledge:act' },
  // AUGUR's own admin APIs (ADR 0083), held only by AUGUR's own frontends, for a person's call; the service still checks their roles.
  // Admin: who and what is allowed.
  { method: /^(GET|POST|PATCH|PUT|DELETE)$/, path: /^\/api\/identity\/v1\/admin\/(people|leave-requests|lifecycle|roles|departments|levels)(\/|$)/, scope: 'people:manage' },
  { method: /^(GET|PUT)$/, path: /^\/api\/events\/v1\/team-notices\/[^/]+\/?$/, scope: 'people:manage' },
  // Roles made in AUGUR and the grants that give them (ADR 0085). Never the persona routes: only the shell starts "Act as".
  { method: /^(GET|POST|DELETE)$/, path: /^\/api\/permissions\/v1\/(roles|grants)(\/|$)/, scope: 'people:manage' },
  { method: /^(GET|PATCH|PUT|DELETE)$/, path: /^\/api\/identity\/v1\/admin\/organisation(\/|$)/, scope: 'org:manage' },
  { method: /^(GET|PUT)$/, path: /^\/api\/models\/v1\/settings\/?$/, scope: 'org:manage' },
  { method: /^GET$/, path: /^\/api\/models\/v1\/usage\/?$/, scope: 'org:manage' },
  { method: /^GET$/, path: /^\/api\/events\/v1\/audit(\/export)?\/?$/, scope: 'audit:read' },
  // The Upgrade Centre: what runs, and changing it. Installing and removing apps, before who may use them.
  { method: /^POST$/, path: /^\/api\/identity\/v1\/admin\/apps\/[^/]+\/credential\/?$/, scope: 'deployment:apps' },
  { method: /^(GET|POST|PUT|DELETE)$/, path: /^\/api\/registry\/v1\/(app-runner|origins)(\/|$)/, scope: 'deployment:apps' },
  { method: /^DELETE$/, path: /^\/api\/registry\/v1\/apps\/[^/]+\/?$/, scope: 'deployment:apps' },
  { method: /^(PUT|DELETE)$/, path: /^\/api\/registry\/v1\/apps\/[^/]+\/pin\/?$/, scope: 'deployment:apps' },
  { method: /^GET$/, path: /^\/api\/registry\/v1\/apps\/[^/]+\/versions\/?$/, scope: 'deployment:apps' },
  { method: /^GET$/, path: /^\/api\/registry\/v1\/apps\/?$/, scope: 'apps:manage' },
  { method: /^(PATCH)$/, path: /^\/api\/registry\/v1\/apps\/[^/]+\/?$/, scope: 'apps:manage' },
  { method: /^(GET|PUT)$/, path: /^\/api\/registry\/v1\/apps\/[^/]+\/(feature-previews|floors|settings|scopes|upload-limit)(\/|$)/, scope: 'apps:manage' },
  { method: /^GET$/, path: /^\/api\/registry\/v1\/platform\/reporting(\/export)?\/?$/, scope: 'deployment:settings' },
  { method: /^(GET|POST|PUT|DELETE)$/, path: /^\/api\/registry\/v1\/platform\/(upgrade|go-back|updates|units|overview|results)(\/|$)/, scope: 'deployment:upgrade' },
  { method: /^GET$/, path: /^\/api\/registry\/v1\/upstreams\/?$/, scope: 'deployment:health' },
  { method: /^GET$/, path: /^\/api\/events\/v1\/deliveries(\/|$)/, scope: 'deployment:health' },
];

/** Whether a grant holds a scope: an app's own scopes, or for one of AUGUR's own frontends, its platform scopes (ADR 0083). */
export const holds = (grant: Pick<AppGrant, 'scopes' | 'platformScopes'>, scope: string): boolean =>
  isPlatformScope(scope) ? (grant.platformScopes ?? []).includes(scope) : grant.scopes.includes(scope);

/** What a scope lets an app do, in words for a refusal: "send notifications (notifications:send)". */
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
  if (name === 'registry' && new RegExp(`^/api/registry/v1/apps/${app}(/|$)`).test(path)) return null;
  return ROUTE_SCOPES.find((r) => r.method.test(method) && r.path.test(path))?.scope;
};

/** Why an app's call is refused, in the words of spec 8.3. */
export const notAllowed = (appName: string, scope: string | undefined, path: string): string =>
  scope ? `${appName} isn’t allowed to ${scopeWords(scope)} (${scope}).` : `${appName} isn’t allowed to call ${path.split('?')[0]}.`;
