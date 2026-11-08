/**
 * `ctx.fetch` across the bridge (spec 6.6): what a call may name, how its request and its answer
 * travel as plain values and bytes, and the `Response` the app gets back. The worker has no network
 * of its own; the host makes the call with the person's token, the floor and the app's header.
 */

/** A request as it crosses the bridge. */
export interface WireRequest {
  path: string;
  method: string;
  headers: [string, string][];
  body: ArrayBuffer | string | null;
}

/** An answer as it crosses back. */
export interface WireResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: ArrayBuffer | null;
}

/**
 * Why a path can't be fetched, or undefined when it can: only a path under the gateway's `/api/`, on
 * the shell's own origin. An absolute URL, a protocol-relative one and a path that climbs out of
 * `/api/` are refused. Both ends check: the app's to say so early, the host's because it trusts nothing.
 */
export function pathProblem(path: unknown): string | undefined {
  if (typeof path !== 'string') return 'ctx.fetch takes a path, such as /api/notes/v1/notes.';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return `ctx.fetch takes a path under /api/, not an address: ${path.slice(0, 80)}`;
  let resolved: URL;
  try {
    resolved = new URL(path, 'http://augur.invalid');
  } catch {
    return `ctx.fetch couldn't read the path ${path.slice(0, 80)}.`;
  }
  if (resolved.origin !== 'http://augur.invalid' || !resolved.pathname.startsWith('/api/')) return `ctx.fetch reaches only the gateway, under /api/: ${path.slice(0, 80)}`;
  return undefined;
}

/** The request headers the host sets itself, whatever the app sends: who is calling, for which app, on which floor. */
export const HOST_HEADERS: readonly string[] = ['authorization', 'cookie', 'x-augur-app', 'x-workspace-id', 'x-workspace-kind', 'x-workspace-role', 'x-request-id', 'forwarded', 'x-real-ip'];

/** Whether a request header is the host's to set (or the gateway's), never the app's. */
export const isHostHeader = (name: string) => {
  const n = name.toLowerCase();
  // Who the person is and where they called from are the proxies' to say: x-forwarded-* too.
  return HOST_HEADERS.includes(n) || n.startsWith('x-user-') || n.startsWith('x-augur-') || n.startsWith('x-forwarded-');
};

/** The Content-Type fetch would have given a body the app sent without one: a form's, or a Blob's own. */
function impliedType(body: unknown): string | undefined {
  if (body instanceof URLSearchParams) return 'application/x-www-form-urlencoded;charset=UTF-8';
  if (typeof body === 'string') return 'text/plain;charset=UTF-8';
  if (typeof Blob !== 'undefined' && body instanceof Blob && body.type) return body.type;
  return undefined;
}

/** A request's body as bytes or text, ready to cross. Anything else is refused with what to use instead. */
async function bodyOf(body: unknown): Promise<ArrayBuffer | string | null> {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof ArrayBuffer) return body.slice(0);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength).slice().buffer;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.arrayBuffer();
  throw new TypeError('ctx.fetch takes a body of text, bytes, a Blob or URLSearchParams; send files with ctx.files.upload.');
}

/** The app's `fetch(path, init)` as plain values for the bridge. */
export async function toWire(path: string, init: RequestInit = {}): Promise<WireRequest> {
  const problem = pathProblem(path);
  if (problem) throw new TypeError(problem);
  const given = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  const sends = method !== 'GET' && method !== 'HEAD';
  const implied = sends ? impliedType(init.body) : undefined;
  if (implied && !given.has('content-type')) given.set('content-type', implied);
  const headers = pairsOf(given).filter(([name]) => !isHostHeader(name));
  return { path, method, headers, body: sends ? await bodyOf(init.body) : null };
}

/** A Headers' pairs, without leaning on its iterator. */
const pairsOf = (headers: Headers) => {
  const out: [string, string][] = [];
  headers.forEach((value, name) => out.push([name, value]));
  return out;
};

/** Statuses a `Response` must have no body for. */
const NO_BODY = new Set([101, 103, 204, 205, 304]);

/** The answer the app gets: a real `Response`, its body built from the bytes that crossed. */
export function fromWire(wire: WireResponse): Response {
  // A Response can only carry 200 to 599; anything else is the gateway failing, which is what it says.
  const status = wire.status >= 200 && wire.status <= 599 ? wire.status : 502;
  return new Response(NO_BODY.has(status) ? null : wire.body, { status, statusText: wire.statusText, headers: wire.headers });
}

/** The host's side: the answer as plain values, its body read whole as bytes. */
export async function responseToWire(res: Response): Promise<WireResponse> {
  return { status: res.status, statusText: res.statusText, headers: pairsOf(res.headers), body: NO_BODY.has(res.status) ? null : await res.arrayBuffer() };
}
