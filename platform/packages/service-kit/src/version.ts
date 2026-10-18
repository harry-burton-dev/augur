import { readFileSync } from 'node:fs';

/**
 * The release version of the package a module belongs to, read from its
 * package.json one level up (src/ in development, dist/ when built). Changesets
 * sets that version when a release is cut, so it is the one place it lives.
 */
export const packageVersion = (moduleUrl: string): string => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', moduleUrl), 'utf8')) as { version?: string };
  if (!pkg.version) throw new Error(`No version in the package.json next to ${moduleUrl}.`);
  return pkg.version;
};

export interface Health {
  status: 'ok';
  service: string;
  /** The service's release, e.g. "0.3.1". */
  version: string;
  /** The major version of the HTTP API it serves, which is also its path prefix: "v1" serves /v1/*. The gateway has none of its own. */
  api?: string;
}

/** What every service answers on GET /healthz, so operators can see what is deployed. */
export const health = (service: string, version: string, api?: string): Health => ({ status: 'ok', service, version, ...(api ? { api } : {}) });
