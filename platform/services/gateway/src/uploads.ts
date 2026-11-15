import { Transform } from 'node:stream';
import { callerHeaders, signedCallerHeaders, withDeadline, type Caller, type CallerSigner } from '@augur/service-kit';

/** What an app may be sent in one request when the registry doesn't say: the registry's own default. */
export const DEFAULT_UPLOAD_MB = 10;

/** What the gateway knows of an app someone may use: what it's called, for what they read, and its limit. */
export type AppAllowed = { name?: string; maxUpload?: number };

/**
 * The apps one person may use on one floor (the caller's `workspace`, or none), by app id, with what
 * each may be sent in one request, in MB, where it says. Throws when that can't be found out. Given the `app` the
 * caller wants, an answer that doesn't have it is asked again sooner, since that app may have just been installed.
 */
export type AppAccess = (caller: Caller, app?: string) => Promise<Map<string, AppAllowed>>;

export class AppAccessUnavailable extends Error {}

export interface RegistryAppAccessOptions {
  registryUrl: string;
  /** Signs the person for the registry, which believes no other. */
  signer?: CallerSigner;
  /** How long one person's apps on one floor are trusted before the registry is asked again. */
  ttlMs?: number;
  /** How soon one person's apps are asked again for an app their last answer didn't have, at most once in this time. */
  missMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** People and floors to remember at once; past this the oldest is forgotten first. */
const MAX_REMEMBERED = 5000;

/**
 * Reads the catalogue the registry gives the person on the floor, the same one their shell gets: an
 * app turned off, blocked on that floor, or needing a role they don't have isn't in it. Each app's
 * limit (`maxUpload`, lowered by an admin) comes with it. Remembered for a short while, so turning an
 * app off reaches the gateway within `ttlMs`.
 */
export const registryAppAccess = ({ registryUrl, signer, ttlMs = 30_000, missMs = 2_000, fetchImpl = fetch, now = Date.now }: RegistryAppAccessOptions): AppAccess => {
  const remembered = new Map<string, { apps: Promise<Map<string, AppAllowed>>; at: number }>();
  const ask = (caller: Caller, key: string) => {
    const floor = caller.workspace?.id;
    const apps = (async () => {
      let res: Response;
      try {
        const headers = { ...callerHeaders(caller), ...(signer ? await signedCallerHeaders(signer, caller, 'registry') : {}) };
        res = await withDeadline(fetchImpl)(`${registryUrl.replace(/\/$/, '')}/v1/manifest${floor ? `?workspace=${encodeURIComponent(floor)}` : ''}`, { headers });
      } catch (err) {
        throw new AppAccessUnavailable(`the registry could not be reached (${(err as Error).message})`);
      }
      if (!res.ok) throw new AppAccessUnavailable(`the registry answered ${res.status}`);
      const list = (await res.json()) as { id: string; name?: string; maxUpload?: number }[];
      return new Map(list.map((a) => [a.id, { ...(a.name ? { name: a.name } : {}), ...(typeof a.maxUpload === 'number' ? { maxUpload: a.maxUpload } : {}) }]));
    })();
    remembered.delete(key);
    remembered.set(key, { apps, at: now() });
    apps.catch(() => remembered.get(key)?.apps === apps && remembered.delete(key));
    if (remembered.size > MAX_REMEMBERED) remembered.delete(remembered.keys().next().value!);
    return apps;
  };
  return async (caller, app) => {
    const key = `${caller.id} ${caller.workspace?.id ?? ''}`;
    const hit = remembered.get(key);
    if (!hit || now() - hit.at >= ttlMs) return ask(caller, key);
    const apps = await hit.apps;
    // An app their last answer didn't have may have just been installed: asked again, at most once each `missMs`.
    if (app === undefined || apps.has(app) || now() - hit.at < missMs) return apps;
    // Another call may have asked again meanwhile; it joins that ask.
    const current = remembered.get(key);
    return current && current !== hit ? current.apps : ask(caller, key);
  };
};

export class TooLarge extends Error {}

/** Passes a body on as it arrives, never holding it, and fails once it has passed `bytes`. */
export const capped = (bytes: number) => {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      seen += chunk.length;
      if (seen > bytes) return done(new TooLarge(`more than ${bytes} bytes`));
      done(null, chunk);
    },
  });
};
