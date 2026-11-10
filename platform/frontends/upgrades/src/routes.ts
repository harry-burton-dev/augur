/**
 * Where a path below `/<id>` takes the person. A question that may need the password again has a path
 * of its own (`/augur/upgrade/0.25.0`), so signing in again comes back to it open: the host owns the
 * address, and only the path survives the trip.
 */
export type Ask = { kind: 'upgrade' | 'roll-back' | 'test'; version: string };
export type Route =
  | { page: 'overview' }
  | { page: 'augur'; ask?: Ask }
  /** `address` opens installing from a release file's address: empty asks for one. */
  | { page: 'apps'; address?: string }
  | { page: 'app'; app: string; install?: string }
  | { page: 'health' }
  | { page: 'backups' }
  | { page: 'channel' }
  | { page: 'settings'; edit?: string };

/** The places the manifest declares, by id; each is a path below `/<id>`. */
export const PLACES = { overview: '/', augur: '/augur', apps: '/apps', health: '/health', backups: '/backups', channel: '/release-channel', settings: '/settings' } as const;

/** Where installing from an address lives: beside Apps, as an app may be called anything. */
const FROM_ADDRESS = 'install-from-address';

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
  if (first === FROM_ADDRESS) return { page: 'apps', address: second ?? '' };
  if (first === 'health') return { page: 'health' };
  if (first === 'backups') return { page: 'backups' };
  if (first === 'release-channel') return { page: 'channel' };
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
      return r.address === undefined ? PLACES.apps : `/${FROM_ADDRESS}${r.address ? `/${e(r.address)}` : ''}`;
    case 'app':
      return r.install ? `/apps/${e(r.app)}/install/${e(r.install)}` : `/apps/${e(r.app)}`;
    case 'health':
      return PLACES.health;
    case 'backups':
      return PLACES.backups;
    case 'channel':
      return PLACES.channel;
    case 'settings':
      return r.edit ? `/settings/${e(r.edit)}` : PLACES.settings;
  }
};

/** Where a unit's page is: AUGUR's own, or an app's under Apps. */
export const unitPath = (unit: string, augur: string): string => (unit === augur ? PLACES.augur : pathOf({ page: 'app', app: unit }));
