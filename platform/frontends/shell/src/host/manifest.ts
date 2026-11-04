import { SDK_VERSION, type AppManifestEntry } from '@augur/mfe-sdk';
import semver from 'semver';

export class ManifestError extends Error {}

/** Loads the role-filtered app list from the registry, through the gateway. */
export async function loadManifest(fetchImpl: typeof fetch, url: string, token: string, workspace?: string): Promise<AppManifestEntry[]> {
  let res: Response;
  try {
    // On a floor, the catalogue is that floor's: the apps on there for this person.
    const target = workspace ? `${url}${url.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(workspace)}` : url;
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: 'application/json', ...(workspace ? { 'x-workspace-id': workspace } : {}) };
    res = await fetchImpl(target, { headers });
  } catch {
    throw new ManifestError("Can't reach the app catalogue. Nothing was lost; try again.");
  }
  if (!res.ok) throw new ManifestError(`The app catalogue answered ${res.status}. Try again, or ask an admin if it keeps happening.`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new ManifestError('The app catalogue sent something the shell could not read.');
  return body.filter(
    (a): a is AppManifestEntry =>
      !!a && typeof a === 'object' && typeof a.id === 'string' && typeof a.route === 'string' && typeof a.entry === 'string',
  );
}

/**
 * Why this shell can't open an app, or undefined when it can. An app names the
 * SDK releases it works with; a shell whose SDK is outside that range would
 * hand it a mount context it doesn't expect, so it refuses instead.
 */
export const incompatibility = (app: AppManifestEntry, sdkVersion = SDK_VERSION): string | undefined => {
  const range = typeof app.sdk === 'string' ? semver.validRange(app.sdk) : null;
  if (!range) return `${app.name} doesn't say which versions of AUGUR it works with, so it can't be opened. Its team needs to release it again.`;
  if (semver.satisfies(sdkVersion, range, { includePrerelease: true })) return undefined;
  return semver.gtr(sdkVersion, range)
    ? `${app.name} was made for an older version of AUGUR and hasn't been updated yet. Its team needs to release a version for this one.`
    : `${app.name} needs a newer version of AUGUR than this one. Ask an admin to upgrade AUGUR.`;
};
