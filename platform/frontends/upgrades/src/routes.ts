/**
 * Where a path below `/<id>` takes the person. A question that may need the password again has a path
 * of its own (`/augur/upgrade/0.25.0`), so signing in again comes back to it open: the host owns the
 * address, and only the path survives the trip.
 */
export type Ask = { kind: 'upgrade' | 'roll-back' | 'test'; version: string };
export type Route =
  | { page: 'overview' }
  | { page: 'augur'; ask?: Ask }
  | { page: 'apps' }
  | { page: 'app'; app: string; install?: string }
  | { page: 'settings'; edit?: string };

/** The places the manifest declares, by id; each is a path below `/<id>`. */
export const PLACES = { overview: '/', augur: '/augur', apps: '/apps', settings: '/settings' } as const;

const ASKS = new Set<Ask['kind']>(['upgrade', 'roll-back', 'test']);

const segments = (path: string) =>
  path
    .split(/[?#]/, 1)[0]!
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });

/** Which page a path opens. Anything unknown opens the overview. */
export const routeFor = (path: string): Route => {
  const [first, second, third, fourth] = segments(path);
  if (first === 'augur') return second && third && ASKS.has(second as Ask['kind']) ? { page: 'augur', ask: { kind: second as Ask['kind'], version: third } } : { page: 'augur' };
  if (first === 'apps') {
    if (!second) return { page: 'apps' };
    return third === 'install' && fourth ? { page: 'app', app: second, install: fourth } : { page: 'app', app: second };
  }
  if (first === 'settings') return second ? { page: 'settings', edit: second } : { page: 'settings' };
  return { page: 'overview' };
};

/** The path of a route, the way `routeFor` reads it back. */
export const pathOf = (r: Route): string => {
  const e = encodeURIComponent;
  switch (r.page) {
    case 'overview':
      return PLACES.overview;
    case 'augur':
      return r.ask ? `/augur/${r.ask.kind}/${e(r.ask.version)}` : PLACES.augur;
    case 'apps':
      return PLACES.apps;
    case 'app':
      return r.install ? `/apps/${e(r.app)}/install/${e(r.install)}` : `/apps/${e(r.app)}`;
    case 'settings':
      return r.edit ? `/settings/${e(r.edit)}` : PLACES.settings;
  }
};

/** Where a unit's page is: AUGUR's own, or an app's under Apps. */
export const unitPath = (unit: string, augur: string): string => (unit === augur ? PLACES.augur : pathOf({ page: 'app', app: unit }));
