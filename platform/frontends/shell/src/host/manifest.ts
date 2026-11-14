import { SDK_VERSION, type AppManifestEntry } from '@augur/mfe-sdk';
import semver from 'semver';
import { fromCatalogue3, isCatalogue3, isWorkerApp } from './apps3.js';

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
  // An app on the app contract arrives as its manifest (spec 9.6); one with no frontend has nothing to open.
  return (body as unknown[]).map((a) => (isCatalogue3(a) ? fromCatalogue3(a) : a)).filter(
    (a): a is AppManifestEntry =>
      !!a && typeof a === 'object' && typeof (a as AppManifestEntry).id === 'string' && typeof (a as AppManifestEntry).route === 'string' && !!(a as AppManifestEntry).entry && typeof (a as AppManifestEntry).entry === 'string',
  );
}

/**
 * The topics that say the catalogue may have changed: an app added or given a new version (once its service
 * registers it), turned off or on, blocked, its floor rule cleared, or removed.
 */
export const CATALOGUE_TOPICS = ['added', 'updated', 'turned-off', 'turned-on', 'removed', 'blocked', 'rule-cleared'].map((t) => `platform.app.${t}`);

/**
 * The catalogue loaded again, keeping each entry that hasn't changed as the one the shell already holds, and
 * the whole list when nothing changed: an open app stays open, and only what changed is drawn again.
 */
export const keepSame = (was: readonly AppManifestEntry[], now: AppManifestEntry[]): AppManifestEntry[] => {
  const before = new Map(was.map((a) => [a.id, a]));
  const kept = now.map((a) => {
    const old = before.get(a.id);
    return old && JSON.stringify(old) === JSON.stringify(a) ? old : a;
  });
  return kept.length === was.length && kept.every((a, i) => a === was[i]) ? (was as AppManifestEntry[]) : kept;
};

/** A catalogue entry the registry allows into the shell's own page: AUGUR's own frontends, and IN_PAGE_APPS. */
export type InPageApp = AppManifestEntry & { inPage?: boolean };

/**
 * Why the shell won't load an app into its own page, or undefined when it may. Code loaded there runs as the
 * shell, with the person's sign-in, so only an app the registry marks `inPage` loads there (ADR 0076); any
 * other app runs in the sandbox on the app contract.
 */
export const inPageRefusal = (app: InPageApp): string | undefined =>
  isWorkerApp(app) || app.inPage === true
    ? undefined
    : `${app.name} loads into AUGUR's own page, which only AUGUR's own apps may. Its team needs to release it on the app contract; until then an admin can allow it on this deployment with IN_PAGE_APPS.`;

/**
 * Why this shell can't open an app, or undefined when it can: one it may not load into its page (inPageRefusal),
 * or one made for other SDK releases. An app names the
 * SDK releases it works with; a shell whose SDK is outside that range would
 * hand it a mount context it doesn't expect, so it refuses instead.
 */
export const incompatibility = (app: AppManifestEntry, sdkVersion = SDK_VERSION): string | undefined => {
  const outside = inPageRefusal(app);
  if (outside) return outside;
  const range = typeof app.sdk === 'string' ? semver.validRange(app.sdk) : null;
  if (!range) return `${app.name} doesn't say which versions of AUGUR it works with, so it can't be opened. Its team needs to release it again.`;
  if (semver.satisfies(sdkVersion, range, { includePrerelease: true })) return undefined;
  return semver.gtr(sdkVersion, range)
    ? `${app.name} was made for an older version of AUGUR and hasn't been updated yet. Its team needs to release a version for this one.`
    : `${app.name} needs a newer version of AUGUR than this one. Ask an admin to upgrade AUGUR.`;
};
