import createClient, { type Client, type ClientOptions } from 'openapi-fetch';

/** Where the gateway serves AUGUR's APIs, relative to the page: `/api/<service>/v1/…`. */
export const DEFAULT_GATEWAY = '/api';

export interface ServiceClientOptions extends ClientOptions {
  /**
   * The gateway's API root, `/api` by default (the page's own origin). A service or script outside the
   * browser passes its deployment's, e.g. from config: `${process.env.GATEWAY_URL}/api`.
   */
  gateway?: string;
  /** The whole base URL, to call somewhere other than the gateway. Wins over `gateway`. */
  baseUrl?: string;
}

/** A typed client for one service's API: `/api/<service><prefix>` behind the gateway, unless the options say otherwise. */
export const serviceClient = <Paths extends object>(service: string, prefix: string, { gateway = DEFAULT_GATEWAY, baseUrl, ...options }: ServiceClientOptions = {}): Client<Paths> =>
  createClient<Paths>({ ...options, baseUrl: baseUrl ?? `${gateway.replace(/\/$/, '')}/${service}${prefix}` });

/** A fetch that takes a path, like an app's `ctx.fetch` (which adds the person's token and floor). */
export type PathFetch = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Lets a client call through a path-taking fetch such as `ctx.fetch`, so the person's token and the
 * current floor go with every request: `eventsClient({ fetch: throughPathFetch(ctx.fetch) })`.
 * A request to the page's own origin is sent as its path; any other keeps its full URL.
 */
export const throughPathFetch =
  (fetchPath: PathFetch) =>
  async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const sameOrigin = typeof location !== 'undefined' && url.origin === location.origin;
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
    return fetchPath(sameOrigin ? `${url.pathname}${url.search}` : request.url, {
      method: request.method,
      headers: request.headers,
      body: body?.byteLength ? body : undefined,
      signal: request.signal,
    });
  };
