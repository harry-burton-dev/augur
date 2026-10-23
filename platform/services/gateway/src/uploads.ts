import { Transform } from 'node:stream';
import { callerHeaders, signedCallerHeaders, type Caller, type CallerSigner } from '@augur/service-kit';

/** What an app may be sent in one request when the registry doesn't say: the registry's own default. */
export const DEFAULT_UPLOAD_MB = 10;

/** How much one person may send each app in one request, in MB, by app id. Throws when that can't be found out. */
export type UploadLimits = (caller: Caller) => Promise<Map<string, number>>;

export class UploadLimitsUnavailable extends Error {}

export interface RegistryUploadLimitsOptions {
  registryUrl: string;
  /** Signs the person for the registry, which believes no other. */
  signer?: CallerSigner;
  /** How long one person's limits are trusted before the registry is asked again. */
  ttlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** People to remember at once; past this the oldest is forgotten first. */
const MAX_REMEMBERED = 5000;

/**
 * Reads each app's limit (`maxUpload`, lowered by an admin) from the catalogue
 * the registry gives the person, the same one their shell gets, and remembers
 * it for a short while. Only requests that carry a body ask.
 */
export const registryUploadLimits = ({ registryUrl, signer, ttlMs = 30_000, fetchImpl = fetch, now = Date.now }: RegistryUploadLimitsOptions): UploadLimits => {
  const remembered = new Map<string, { limits: Promise<Map<string, number>>; until: number }>();
  return (caller) => {
    const hit = remembered.get(caller.id);
    if (hit && hit.until > now()) return hit.limits;
    const limits = (async () => {
      const asked = { ...caller, workspace: undefined };
      let res: Response;
      try {
        const headers = { ...callerHeaders(asked), ...(signer ? await signedCallerHeaders(signer, asked, 'registry') : {}) };
        res = await fetchImpl(`${registryUrl.replace(/\/$/, '')}/v1/manifest`, { headers });
      } catch (err) {
        throw new UploadLimitsUnavailable(`the registry could not be reached (${(err as Error).message})`);
      }
      if (!res.ok) throw new UploadLimitsUnavailable(`the registry answered ${res.status}`);
      const apps = (await res.json()) as { id: string; maxUpload?: number }[];
      return new Map(apps.filter((a) => typeof a.maxUpload === 'number').map((a) => [a.id, a.maxUpload!]));
    })();
    remembered.delete(caller.id);
    remembered.set(caller.id, { limits, until: now() + ttlMs });
    limits.catch(() => remembered.get(caller.id)?.limits === limits && remembered.delete(caller.id));
    if (remembered.size > MAX_REMEMBERED) remembered.delete(remembered.keys().next().value!);
    return limits;
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
