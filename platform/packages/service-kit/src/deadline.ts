/**
 * Every call one service makes to another has a deadline (PER-213). Without one, a service that hangs
 * holds every request that asks it for as long as Node waits, which is minutes; with one, the caller
 * gives up after a few seconds and answers that the other service can't be reached right now, which
 * is what the helpers' `*Unavailable` errors already say and the routes already turn into a 503.
 */

/** Five seconds: far longer than a healthy service takes, short enough that a person isn't left waiting. */
export const DEFAULT_SERVICE_TIMEOUT_MS = 5_000;

/**
 * How long a call to another service may take, start to end of its answer: SERVICE_CALL_TIMEOUT_SECONDS
 * (AUGUR’s docs, Limits and health), or five seconds when it is unset, empty or not a positive number.
 */
export const serviceTimeoutMs = (env: Record<string, string | undefined> = process.env): number => {
  const seconds = Number(env.SERVICE_CALL_TIMEOUT_SECONDS);
  return env.SERVICE_CALL_TIMEOUT_SECONDS?.trim() && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_SERVICE_TIMEOUT_MS;
};

/**
 * `fetchImpl` with a deadline: the call is abandoned with a TimeoutError once `timeoutMs` have passed,
 * reading the answer's body included, or sooner if the caller's own signal fires. A helper's existing
 * catch turns that into its "could not be reached" error.
 */
export const withDeadline =
  (fetchImpl: typeof fetch = fetch, timeoutMs: number = serviceTimeoutMs()): typeof fetch =>
  (input, init = {}) => {
    const deadline = AbortSignal.timeout(timeoutMs);
    return fetchImpl(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
  };
