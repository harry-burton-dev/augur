import type { AppManifestEntry } from '@augur/mfe-sdk';

export interface RouteMatch {
  app: AppManifestEntry;
  /** The path below the app's route prefix, always starting with "/". */
  path: string;
}

const normalise = (route: string) => (route === '/' ? '/' : route.replace(/\/+$/, ''));

/** The app whose route prefix is the longest match for a location path. "/" is the fallback. */
export function matchRoute(manifest: AppManifestEntry[], pathname: string): RouteMatch | undefined {
  let best: AppManifestEntry | undefined;
  for (const app of manifest) {
    const route = normalise(app.route);
    const fits = route === '/' || pathname === route || pathname.startsWith(`${route}/`);
    if (fits && (!best || route.length > normalise(best.route).length)) best = app;
  }
  if (!best) return undefined;
  const route = normalise(best.route);
  const rest = route === '/' ? pathname : pathname.slice(route.length);
  return { app: best, path: rest.startsWith('/') ? rest : `/${rest}` };
}

/** The location path for an app and a path inside it. */
export function hrefFor(app: AppManifestEntry, path = '/'): string {
  const route = normalise(app.route);
  const inner = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return route === '/' ? inner || '/' : `${route}${inner}`;
}
