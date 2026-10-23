import { callerHeaders, signedCallerHeaders, type Caller, type CallerSigner, type CallerWorkspace } from '@augur/service-kit';

/** A floor the caller can stand on, as identity's `GET /v1/me/workspaces` lists it. */
export type FloorAccess = CallerWorkspace;

/** Every floor a caller can stand on. Throws when that can't be found out. */
export type FloorLookup = (caller: Caller) => Promise<FloorAccess[]>;

export class FloorLookupError extends Error {}

export interface IdentityFloorsOptions {
  identityUrl: string;
  /** Signs the caller for identity, which believes no other. */
  signer?: CallerSigner;
  /** How long one person's floors are trusted before identity is asked again. */
  ttlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** People to remember at once; past this the oldest is forgotten first. */
const MAX_REMEMBERED = 5000;

/**
 * Asks identity which floors someone is on, and remembers the answer for a
 * short while so most requests cost nothing. Taking someone off a team
 * therefore reaches the gateway within `ttlMs`.
 */
export const identityFloors = ({ identityUrl, signer, ttlMs = 30_000, fetchImpl = fetch, now = Date.now }: IdentityFloorsOptions): FloorLookup => {
  const remembered = new Map<string, { floors: Promise<FloorAccess[]>; until: number }>();
  return (caller) => {
    const hit = remembered.get(caller.id);
    if (hit && hit.until > now()) return hit.floors;
    const floors = (async () => {
      let res: Response;
      try {
        const asked = { ...caller, workspace: undefined };
        const headers = { ...callerHeaders(asked), ...(signer ? await signedCallerHeaders(signer, asked, 'identity') : {}) };
        res = await fetchImpl(`${identityUrl.replace(/\/$/, '')}/v1/me/workspaces`, { headers });
      } catch (err) {
        throw new FloorLookupError(`identity could not be reached (${(err as Error).message})`);
      }
      if (!res.ok) throw new FloorLookupError(`identity answered ${res.status}`);
      const body = (await res.json()) as { workspaces: FloorAccess[] };
      return body.workspaces.map(({ id, kind, role }) => ({ id, kind, role }));
    })();
    remembered.delete(caller.id);
    remembered.set(caller.id, { floors, until: now() + ttlMs });
    // A failed lookup is not remembered: the next request asks again.
    floors.catch(() => remembered.get(caller.id)?.floors === floors && remembered.delete(caller.id));
    if (remembered.size > MAX_REMEMBERED) remembered.delete(remembered.keys().next().value!);
    return floors;
  };
};
