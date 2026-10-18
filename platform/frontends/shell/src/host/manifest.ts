import type { AppManifestEntry } from '@platform/mfe-sdk';

export class ManifestError extends Error {}

/** Loads the role-filtered app list from the registry, through the gateway. */
export async function loadManifest(fetchImpl: typeof fetch, url: string, token: string): Promise<AppManifestEntry[]> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
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
