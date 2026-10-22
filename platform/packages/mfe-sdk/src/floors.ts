import type { Workspace } from './contract.js';

/** The header that names the floor a request is for. The gateway checks it and services trust only its copy. */
export const WORKSPACE_HEADER = 'X-Workspace-Id';

/**
 * Makes `ctx.fetch`: the browser's fetch with the person's token and the
 * current floor added, unless the caller set them itself.
 */
export const floorFetch =
  (getToken: () => Promise<string>, getWorkspace: () => Workspace, fetchImpl: typeof fetch = (...args) => fetch(...args)) =>
  async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (!headers.has('authorization')) headers.set('authorization', `Bearer ${await getToken()}`);
    if (!headers.has(WORKSPACE_HEADER)) headers.set(WORKSPACE_HEADER, getWorkspace().id);
    return fetchImpl(path, { ...init, headers });
  };
