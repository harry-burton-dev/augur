import type { Workspace } from './contract.js';

/** The header that names the floor a request is for. The gateway checks it and services trust only its copy. */
export const WORKSPACE_HEADER = 'X-Workspace-Id';

/** Stands in for the page's origin where there is no page (tests, workers without one), so a relative path still counts as ours. */
const NO_ORIGIN = 'http://augur.invalid';

/** Whether a request goes to the page's own origin, the gateway, rather than to another site. */
const isSameOrigin = (url: string): boolean => {
  const here = globalThis.location?.origin ?? NO_ORIGIN;
  try {
    return new URL(url, here).origin === here;
  } catch {
    return false;
  }
};

/**
 * Makes `ctx.fetch`: the browser's fetch with the person's token and the
 * current floor added, unless the caller set them itself. Only a request to
 * the page's own origin (the gateway) carries them: one to another site goes
 * as it is, so the token never leaves AUGUR (SDK 1.11).
 */
export const floorFetch =
  (getToken: () => Promise<string>, getWorkspace: () => Workspace, fetchImpl: typeof fetch = (...args) => fetch(...args)) =>
  async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!isSameOrigin(path)) return fetchImpl(path, init);
    const headers = new Headers(init.headers);
    if (!headers.has('authorization')) headers.set('authorization', `Bearer ${await getToken()}`);
    if (!headers.has(WORKSPACE_HEADER)) headers.set(WORKSPACE_HEADER, getWorkspace().id);
    return fetchImpl(path, { ...init, headers });
  };
