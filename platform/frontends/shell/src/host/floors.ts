import type { Workspace } from '@augur/mfe-sdk';

/** Where a location is: the floor its `/@slug` names, if any, and the path on that floor. */
export interface FloorLocation {
  slug?: string;
  /** The rest of the path, always starting with "/". */
  path: string;
}

/** "/@finance/library/doc/1" → finance and "/library/doc/1"; "/library" names no floor. */
export function floorFromPath(pathname: string): FloorLocation {
  const m = pathname.match(/^\/@([^/]+)(\/.*)?$/);
  if (!m) return { path: pathname || '/' };
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // Keep it as written; no floor will match it.
  }
  return { slug, path: m[2] && m[2] !== '/' ? m[2] : '/' };
}

/** The location of a path on a floor: "/@finance/library", or "/@me" for the floor's Title. */
export const floorHref = (slug: string, path = '/') => `/@${encodeURIComponent(slug)}${path === '/' ? '' : path}`;

/** The person's own floor, which every list of floors has. */
export const ownFloor = (floors: Workspace[]) => floors.find((f) => f.kind === 'personal');

/** The floor a slug names among the person's floors. */
export const floorBySlug = (floors: Workspace[], slug: string | undefined) => (slug ? floors.find((f) => f.slug === slug) : undefined);

export class FloorsError extends Error {}

/** The caller's floors from identity, through the gateway. */
export async function loadFloors(fetchImpl: typeof fetch, url: string, token: string): Promise<Workspace[]> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  } catch {
    throw new FloorsError("Can't reach the platform to find your floors. Try again.");
  }
  if (!res.ok) throw new FloorsError(`Finding your floors failed: the platform answered ${res.status}. Try again.`);
  const body = (await res.json()) as { workspaces?: Workspace[] };
  const floors = (body.workspaces ?? []).filter((f) => typeof f?.id === 'string' && typeof f.slug === 'string' && Array.isArray(f.path));
  if (!ownFloor(floors)) throw new FloorsError('The platform sent an answer the shell could not read.');
  return floors.map(({ id, kind, name, slug, path, role, level }) => ({ id, kind, name, slug, path, role, ...(typeof level === 'string' ? { level } : {}) }));
}
