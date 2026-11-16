import { callerHeaders, GATEWAY_CALLER, signedCallerHeaders, withDeadline, type CallerSigner } from '@augur/service-kit';

/** The organisation's floor's id as the gateway knows it now, or undefined while identity hasn't said. Never waits. */
export type OrganisationFloor = () => string | undefined;

/**
 * The organisation's floor's id, which the gateway signs on the callers it passes on as `org`. It is read from
 * identity in the background, so no call waits for it: the first read starts at once, and a failed one is tried again
 * at the first call `retryMs` after it. A known id is read again at the first call `refreshMs` after the last read, so
 * a re-seeded identity is caught without a restart.
 * Until identity answers (it is down, or older than the `id` on its organisation), callers go without `org`.
 */
export const identityOrganisationFloor = ({
  identityUrl,
  signer,
  fetchImpl = fetch,
  retryMs = 5_000,
  refreshMs = 10 * 60_000,
  timeoutMs = 5_000,
  now = Date.now,
}: {
  identityUrl: string;
  signer?: CallerSigner;
  fetchImpl?: typeof fetch;
  retryMs?: number;
  refreshMs?: number;
  timeoutMs?: number;
  now?: () => number;
}): OrganisationFloor & { settled: () => Promise<void> } => {
  const call = withDeadline(fetchImpl, timeoutMs);
  let known: string | undefined;
  let triedAt: number | undefined;
  let asking: Promise<void> | undefined;
  const ask = async () => {
    triedAt = now();
    try {
      const headers = { ...callerHeaders(GATEWAY_CALLER), ...(signer ? await signedCallerHeaders(signer, GATEWAY_CALLER, 'identity') : {}) };
      const res = await call(`${identityUrl.replace(/\/$/, '')}/v1/organisation`, { headers });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id?: unknown };
      if (typeof id === 'string' && id) known = id;
    } catch {
      // Tried again after retryMs; callers go without `org`, or with the id known before, meanwhile.
    }
  };
  const due = () => triedAt === undefined || now() - triedAt >= (known ? refreshMs : retryMs);
  const floor = () => {
    if (!asking && due()) asking = ask().finally(() => (asking = undefined));
    return known;
  };
  floor();
  /** For tests: until the read under way, if any, has answered. */
  const settled = async () => {
    await asking;
  };
  return Object.assign(floor, { settled });
};
