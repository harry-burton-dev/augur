/**
 * Where a path below `/<id>` takes the person. Each person, department, app and Activity entry has a page of
 * its own, and a change that may need the password again has a path of its own too, so signing in again comes
 * back to it open: the host owns the address, and only the path survives the trip.
 */
export type Section = 'people' | 'departments' | 'organisation' | 'apps' | 'activity';

/** A security or retention change, asked before it's made: which rule, and the value it changes to. */
export type SecurityAsk = { key: 'twoStepForAll' | 'leaverRetentionDays' | 'activityRetentionDays'; value: string };

export type Route =
  | { page: 'people' }
  | { page: 'person-new' }
  | { page: 'person'; id: string; ask?: 'delete' }
  | { page: 'departments' }
  | { page: 'department-new' }
  | { page: 'department'; id: string }
  | { page: 'organisation'; ask?: SecurityAsk }
  | { page: 'apps' }
  | { page: 'app'; id: string }
  | { page: 'activity' }
  | { page: 'entry'; id: string };

/** The places the manifest declares, by id; each is a path below `/<id>`. */
export const PLACES: Record<Section, string> = { people: '/people', departments: '/departments', organisation: '/organisation', apps: '/apps', activity: '/activity' };

const SECURITY_KEYS = new Set<SecurityAsk['key']>(['twoStepForAll', 'leaverRetentionDays', 'activityRetentionDays']);

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

/** Which page a path opens. Anything unknown opens People. */
export const routeFor = (path: string): Route => {
  const [first, second, third, fourth] = segments(path);
  switch (first) {
    case 'departments':
      return !second ? { page: 'departments' } : second === 'new' ? { page: 'department-new' } : { page: 'department', id: second };
    case 'organisation':
      return second === 'security' && third && fourth !== undefined && SECURITY_KEYS.has(third as SecurityAsk['key'])
        ? { page: 'organisation', ask: { key: third as SecurityAsk['key'], value: fourth } }
        : { page: 'organisation' };
    case 'apps':
      return second ? { page: 'app', id: second } : { page: 'apps' };
    case 'activity':
      return second ? { page: 'entry', id: second } : { page: 'activity' };
    default:
      if (first === 'people' && second === 'new') return { page: 'person-new' };
      if (first === 'people' && second) return third === 'delete' ? { page: 'person', id: second, ask: 'delete' } : { page: 'person', id: second };
      return { page: 'people' };
  }
};

/** The path of a route, the way `routeFor` reads it back. */
export const pathOf = (r: Route): string => {
  const e = encodeURIComponent;
  switch (r.page) {
    case 'people':
      return PLACES.people;
    case 'person-new':
      return '/people/new';
    case 'person':
      return `/people/${e(r.id)}${r.ask ? `/${r.ask}` : ''}`;
    case 'departments':
      return PLACES.departments;
    case 'department-new':
      return '/departments/new';
    case 'department':
      return `/departments/${e(r.id)}`;
    case 'organisation':
      return r.ask ? `/organisation/security/${r.ask.key}/${e(r.ask.value)}` : PLACES.organisation;
    case 'apps':
      return PLACES.apps;
    case 'app':
      return `/apps/${e(r.id)}`;
    case 'activity':
      return PLACES.activity;
    case 'entry':
      return `/activity/${e(r.id)}`;
  }
};

/** The section a route belongs to, for its title. */
export const sectionOf = (r: Route): Section =>
  r.page.startsWith('person') || r.page === 'people'
    ? 'people'
    : r.page.startsWith('department')
      ? 'departments'
      : r.page === 'organisation'
        ? 'organisation'
        : r.page === 'app' || r.page === 'apps'
          ? 'apps'
          : 'activity';
