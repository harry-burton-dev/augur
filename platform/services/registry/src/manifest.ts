import semver from 'semver';
import { SCOPES, type Scope } from '@platform/service-kit';

/** One app in the catalogue, as the app itself describes it in its manifest.json. */
export interface AppEntry {
  id: string;
  name: string;
  route: string;
  entry: string;
  /** The app's release, semver. */
  version: string;
  /** The SDK releases the app works with, a semver range such as "^1.2.0". */
  sdk: string;
  description?: string;
  icon?: string;
  requiredRole?: string;
  handles?: string[];
  ai?: boolean;
  menu?: AppMenuCategory[];
  /** What the app's service asks to do on the platform, such as "notifications:send". */
  scopes?: Scope[];
  /** The kinds of floor the app works on. Without it, every kind. */
  floors?: FloorKind[];
  /** What the app shows on each kind of floor, for the shell to place. */
  surfaces?: Surface[];
}

export const FLOOR_KINDS = ['personal', 'team', 'org'] as const;
export type FloorKind = (typeof FLOOR_KINDS)[number];

/** Where on the shell a surface goes: a whole page, a card on a floor's page, a side panel, the floor's settings, or Admin. */
export const SURFACE_SLOTS = ['page', 'card', 'panel', 'settings', 'admin'] as const;

/**
 * One thing an app shows on one kind of floor. Several surfaces can share a
 * module, and the app's route is the same on every floor. When several match,
 * the most specific floor wins, then a role condition, then manifest order.
 */
export interface Surface {
  /** "team" means any team, at any depth. */
  floor: FloorKind;
  slot: (typeof SURFACE_SLOTS)[number];
  /** The module the app's entry exposes for it. */
  module: string;
  /** Only for people with this role on the floor. */
  role?: 'member' | 'lead';
  /** Shows this floor and the teams below it that the person is on, using the platform's roll-up. */
  rollup?: boolean;
}

/** The kinds of floor an app works on. */
export const floorKindsOf = (entry: Pick<AppEntry, 'floors'>): readonly FloorKind[] => entry.floors ?? FLOOR_KINDS;

export interface AppMenuItem {
  id?: string;
  label: string;
  icon?: string;
  detail?: string;
  keywords?: string;
  ai?: boolean;
  path: string;
}

export interface AppMenuCategory {
  id?: string;
  label: string;
  icon?: string;
  ai?: boolean;
  items: AppMenuItem[];
}

/**
 * The platform's own apps. They ship with the platform, so they live in code, not in the catalogue table.
 * "/" is the shell's own: Title, where every app is a chapter.
 */
export const platformApps: AppEntry[] = [
  { id: 'home', name: 'Home', route: '/home', entry: '/apps/home/entry.js', version: '0.1.0', sdk: '^1.0.0', icon: 'home', description: 'What needs you' },
  {
    id: 'admin',
    name: 'Admin',
    route: '/admin',
    entry: '/apps/admin/entry.js',
    version: '0.1.0',
    sdk: '^1.0.0',
    icon: 'admin',
    description: 'People, departments, apps, status and activity',
    requiredRole: 'admin',
    menu: [
      {
        label: 'People',
        icon: 'people',
        items: [
          { label: 'Everyone', icon: 'people', path: '/people', detail: 'Roles, departments, sign-in', keywords: 'users accounts roles disable' },
          { label: 'Add a person', icon: 'user-plus', path: '/people/new', keywords: 'invite create user' },
        ],
      },
      {
        label: 'Departments',
        icon: 'department',
        items: [
          { label: 'All departments', icon: 'department', path: '/departments', detail: 'Names and members', keywords: 'groups teams' },
          { label: 'New department', icon: 'plus', path: '/departments/new', keywords: 'create group team' },
        ],
      },
      {
        label: 'Apps',
        icon: 'apps',
        items: [{ label: 'All apps', icon: 'apps', path: '/apps', detail: 'Versions, on or off', keywords: 'catalogue registry enable disable' }],
      },
      {
        label: 'Platform',
        icon: 'pulse',
        items: [
          { label: 'Status', icon: 'pulse', path: '/status', detail: 'Is everything running', keywords: 'health services down up uptime' },
          { label: 'Activity', icon: 'clock', path: '/activity', detail: 'Who changed what', keywords: 'audit log history changes' },
        ],
      },
    ],
  },
];

/**
 * Platform apps whose frontend hasn't shipped yet. Their ids and routes stay
 * reserved, but the manifest leaves them out so no one is offered a dead end.
 */
export const unbuiltApps = new Set<string>();

/** What a registering app may send. Mirrors AppManifestEntry in contracts/registry.openapi.yaml. */
export const appEntrySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'route', 'entry', 'version', 'sdk'],
  properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' },
    name: { type: 'string', minLength: 1, maxLength: 60 },
    route: { type: 'string', pattern: '^/[a-z0-9][a-z0-9/-]*$', maxLength: 100 },
    entry: { type: 'string', minLength: 1, maxLength: 500 },
    version: { type: 'string', minLength: 1, maxLength: 40 },
    sdk: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 140 },
    icon: { type: 'string', maxLength: 40 },
    requiredRole: { type: 'string', maxLength: 60 },
    handles: { type: 'array', maxItems: 50, items: { type: 'string', pattern: '^[a-z][a-z0-9.-]*$', maxLength: 80 } },
    ai: { type: 'boolean' },
    scopes: { type: 'array', uniqueItems: true, maxItems: SCOPES.length, items: { enum: [...SCOPES] } },
    floors: { type: 'array', minItems: 1, uniqueItems: true, maxItems: FLOOR_KINDS.length, items: { enum: [...FLOOR_KINDS] } },
    surfaces: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['floor', 'slot', 'module'],
        properties: {
          floor: { enum: [...FLOOR_KINDS] },
          slot: { enum: [...SURFACE_SLOTS] },
          module: { type: 'string', pattern: '^[A-Za-z0-9_./-]+$', maxLength: 100 },
          role: { enum: ['member', 'lead'] },
          rollup: { type: 'boolean' },
        },
      },
    },
    menu: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'items'],
        properties: {
          id: { type: 'string', maxLength: 40 },
          label: { type: 'string', minLength: 1, maxLength: 40 },
          icon: { type: 'string', maxLength: 40 },
          ai: { type: 'boolean' },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 12,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'path'],
              properties: {
                id: { type: 'string', maxLength: 40 },
                label: { type: 'string', minLength: 1, maxLength: 60 },
                icon: { type: 'string', maxLength: 40 },
                detail: { type: 'string', maxLength: 60 },
                keywords: { type: 'string', maxLength: 140 },
                ai: { type: 'boolean' },
                path: { type: 'string', pattern: '^/.+', maxLength: 200 },
              },
            },
          },
        },
      },
    },
  },
} as const;

/** Why an app's versions can't be read, or undefined when they can. The shell compares them with semver. */
export const versionProblem = (entry: AppEntry): string | undefined => {
  if (!semver.valid(entry.version)) return `"${entry.version}" is not a semver version such as 1.2.0.`;
  if (!semver.validRange(entry.sdk)) return `"${entry.sdk}" is not a semver range of SDK versions such as ^1.0.0.`;
  return undefined;
};

/** Why an app's surfaces don't fit the floors it says it works on, or undefined when they do. */
export const surfaceProblem = (entry: AppEntry): string | undefined => {
  const kinds = floorKindsOf(entry);
  const stray = entry.surfaces?.find((s) => !kinds.includes(s.floor));
  return stray ? `${entry.name} has a ${stray.slot} for the ${stray.floor} floor, but its floors don't include ${stray.floor}.` : undefined;
};

/** Why an app can't take the id or route it asked for, or undefined when it can. */
export const conflictFor = (entry: AppEntry, others: AppEntry[]): string | undefined => {
  const platform = platformApps.find((a) => a.id === entry.id);
  if (platform) return `"${entry.id}" is one of the platform's own apps.`;
  const route = trimRoute(entry.route);
  const all = [...platformApps, ...others].filter((a) => a.id !== entry.id);
  const sameRoute = all.find((a) => trimRoute(a.route) === route);
  if (sameRoute) return `${sameRoute.name} already lives at ${entry.route}.`;
  // The shell opens the app with the longest matching route, so a route inside another
  // app's would take over those pages: an app at /admin/people would be what admins see.
  const inside = all.find((a) => route.startsWith(`${trimRoute(a.route)}/`));
  if (inside) return `${entry.route} is inside ${inside.name}'s pages at ${inside.route}. Choose a route of its own.`;
  const around = all.find((a) => trimRoute(a.route).startsWith(`${route}/`));
  if (around) return `${entry.route} would hold ${around.name}'s pages at ${around.route}. Choose a route of its own.`;
  return undefined;
};

const trimRoute = (route: string) => route.replace(/\/+$/, '') || '/';

/**
 * The origin of an address an admin wants apps to load from, such as
 * "https://apps.example.org", or why it can't be one. Only HTTPS, except
 * http://localhost for development.
 */
export const parseOrigin = (input: string): { origin: string } | { problem: string } => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { problem: `"${input}" isn't a web address such as https://apps.example.org.` };
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return { problem: 'Apps can only load over HTTPS.' };
  if (url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    return { problem: `Give just the site, such as ${url.origin}, without a path.` };
  }
  return { origin: url.origin };
};

/**
 * Why an app may not load from where its entry is, or undefined when it may.
 * A path ("/apps/x/entry.js") is served by the platform itself and always may;
 * a full address must be on an origin an admin has allowed.
 */
export const entryOriginProblem = (entry: Pick<AppEntry, 'name' | 'entry'>, allowed: string[]): string | undefined => {
  if (entry.entry.startsWith('/') && !entry.entry.startsWith('//')) return undefined;
  let url: URL;
  try {
    url = new URL(entry.entry);
  } catch {
    return `${entry.name}'s entry "${entry.entry}" is neither a path on the platform nor a full web address.`;
  }
  if (allowed.includes(url.origin)) return undefined;
  return `${entry.name} loads from ${url.origin}, which isn't a place apps are allowed to load from. An admin can allow it in Admin, Apps.`;
};
