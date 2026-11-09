/**
 * Reads a release file from an address an admin pasted (Admin → Apps, spec 9.4). The host name is resolved
 * here and every address it gives is checked before the connection is made to one of them, so a name that
 * points at this machine or the deployment's own networks is refused, and nothing can swap the address
 * between the check and the call. Redirects aren't followed, and the body is cut off past `bytes`.
 */
import { lookup } from 'node:dns';
import { request } from 'node:https';
import type { LookupFunction } from 'node:net';
import { addressProblem, type OwnNetworks } from './upstreams.ts';

/** The body was larger than a release file may be. */
export class TooLarge extends Error {}

/** Reads `url` as the registry does for a pasted address: a Response, or a throw saying why not. */
export type ReleaseFetch = (url: string, own: OwnNetworks) => Promise<Response>;

export const releaseFileFetch =
  ({ bytes, ms }: { bytes: number; ms: number }): ReleaseFetch =>
  (url, own) =>
    new Promise((resolve, reject) => {
      const checked: LookupFunction = (host, options, done) =>
        lookup(host, { all: true }, (err, addresses) => {
          if (err) return done(err, '', 4);
          const bad = addresses.map((a) => addressProblem(a.address, own)).find(Boolean);
          if (bad) return done(new Error(bad), '', 4);
          if (options.all) return (done as unknown as (e: null, a: typeof addresses) => void)(null, addresses);
          done(null, addresses[0]!.address, addresses[0]!.family);
        });
      const req = request(url, { method: 'GET', lookup: checked, timeout: ms, headers: { accept: 'application/json, application/octet-stream' } }, (res) => {
        const chunks: Buffer[] = [];
        let seen = 0;
        res.on('data', (chunk: Buffer) => {
          seen += chunk.length;
          if (seen > bytes) {
            req.destroy(new TooLarge(`larger than ${bytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const headers = new Headers();
          for (const [k, v] of Object.entries(res.headers)) if (typeof v === 'string') headers.set(k, v);
          resolve(new Response(res.statusCode === 204 || res.statusCode === 304 ? null : Buffer.concat(chunks), { status: res.statusCode ?? 502, headers }));
        });
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(Object.assign(new Error('timed out'), { name: 'TimeoutError' })));
      req.on('error', reject);
      req.end();
    });
