import semver from 'semver';
import { SCOPES, type Scope } from '@augur/service-kit';
import { PLATFORM_APP_VERSIONS } from './platform-app-versions.js';

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
  /** The broad parts of what the app covers, which Title lists under it. Menu groups name theirs in `area`. */
  areas?: AppArea[];
  /** false: the app keeps its own menu inside it and the shell never shows its Orbit. */
  orbit?: boolean;
  /** true: the app shows the same on every floor, so the shell's floor gauge rests while it's open and says why. */
  sameOnEveryFloor?: boolean;
  /** true: the app can narrow what it shows to a working context, from ctx.focus (SDK 1.10). Reserved: nothing sets one yet (ADR 0029). */
  focus?: boolean;
  /** What the app's service asks to do on the platform, such as "notifications:send". */
  scopes?: Scope[];
  /** The kinds of floor the app works on. Without it, every kind. */
  floors?: FloorKind[];
  /** What the app shows on each kind of floor, for the shell to place. */
  surfaces?: Surface[];
  /** The app's service answers GET /v1/search?q=, and the shell's Find asks it. */
  search?: boolean;
  /** The storage the app keeps on the platform: its own database schema, its own bucket. See docs/app-storage.md. */
  storage?: { database?: boolean; bucket?: boolean };
  /** The largest request body, in MB, the gateway lets through to the app's service. An admin can lower it. Without it, DEFAULT_UPLOAD_MB. */
  maxUpload?: number;
  /** The app's own settings, which admins set in Admin, Apps and its service reads from the registry. */
  settings?: AppSetting[];
  /** Features the app has ready to try before they're everyone's (SDK 1.7): admins say who gets each, people opt in. */
  previews?: FeaturePreview[];
}

/**
 * A feature an app is trying out (SDK 1.7). Off for everyone until an admin says otherwise, or opt-in
 * by default on a preview server; the app asks `ctx.previewOn(id)` and keeps working without it.
 */
export interface FeaturePreview {
  /** How the app names it: "board-view". */
  id: string;
  name: string;
  /** A sentence on what it changes, for the person choosing it. */
  detail?: string;
  /** The last day it runs, YYYY-MM-DD: after it, it's off for everyone and Admin says the app should drop it or ship it. */
  until?: string;
}

/**
 * One setting an app offers admins, such as how long it keeps deleted things. A whole number
 * between `min` and `max`, `default` until an admin changes it.
 */
export interface AppSetting {
  /** How the app's service names it: "retentionDays". */
  id: string;
  label: string;
  /** A sentence on what it changes. */
  detail?: string;
  type: 'integer';
  /** What the number counts, shown after it: "days". */
  unit?: string;
  min: number;
  max: number;
  default: number;
}

/** How many settings one app may offer. */
export const MAX_SETTINGS = 10;
/** How many feature previews one app may offer at once. */
export const MAX_FEATURE_PREVIEWS = 8;

/** What an app may be sent in one request when its manifest doesn't say: enough for any form, not for files. */
export const DEFAULT_UPLOAD_MB = 10;
/** The most any app may ask for. */
export const MAX_UPLOAD_MB = 2048;

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
  area?: string;
  items: AppMenuItem[];
}

export interface AppArea {
  id: string;
  label: string;
  icon?: string;
  detail?: string;
}

/**
 * Where an app's menu breaks the shell principles (docs/shell-principles.md):
 * something repeating the label or icon of what it sits under, a group naming
 * an area the app doesn't have, an area with no groups. These are warnings:
 * the manifest is still accepted, so released apps keep working, but the
 * shell draws them less clearly. An icon left out isn't counted, since the
 * shell gives it one of its own.
 */
export const menuWarnings = (entry: Pick<AppEntry, 'name' | 'icon' | 'menu' | 'areas'>): string[] => {
  const out: string[] = [];
  const same = (a: { label: string; icon?: string }, b: { label: string; icon?: string }) =>
    a.label.trim().toLowerCase() === b.label.trim().toLowerCase() ? 'label' : a.icon && a.icon === b.icon ? 'icon' : undefined;
  const app = { label: entry.name, icon: entry.icon };
  const areas = entry.areas ?? [];
  const ids = new Set<string>();
  for (const area of areas) {
    if (ids.has(area.id)) out.push(`${entry.name} has the area "${area.id}" twice.`);
    ids.add(area.id);
    const clash = same(area, app);
    if (clash) out.push(`${entry.name}'s area "${area.label}" has the app's own ${clash}.`);
    if (!entry.menu?.some((c) => c.area === area.id)) out.push(`${entry.name}'s area "${area.label}" has no menu groups.`);
  }
  for (const group of entry.menu ?? []) {
    const area = areas.find((a) => a.id === group.area);
    if (group.area && !area) out.push(`${entry.name}'s menu group "${group.label}" names the area "${group.area}", which the app doesn't have.`);
    const parent = area ?? app;
    const clash = same(group, parent);
    if (clash) out.push(`${entry.name}'s menu group "${group.label}" has the ${clash} of ${area ? `its area "${area.label}"` : 'the app'}.`);
    for (const item of group.items) {
      const itemClash = same(item, group);
      if (itemClash) out.push(`${entry.name}'s menu item "${item.label}" has the ${itemClash} of its group "${group.label}".`);
    }
  }
  if (areas.length && entry.menu?.some((c) => !c.area)) out.push(`${entry.name} has areas, but some menu groups don't name one; they show with no area.`);
  return out;
};

/**
 * The platform's own apps. They ship with the platform, so they live in code, not in the catalogue table.
 * "/" is the shell's own: Title, where every app is a chapter.
 */
export const platformApps: AppEntry[] = [
  { id: 'home', name: 'Home', route: '/home', entry: '/apps/home/entry.js', version: PLATFORM_APP_VERSIONS.home, sdk: '^1.0.0', icon: 'home', description: 'What needs you' },
  {
    id: 'admin',
    name: 'Admin',
    route: '/admin',
    entry: '/apps/admin/entry.js',
    version: PLATFORM_APP_VERSIONS.admin,
    sdk: '^1.0.0',
    icon: 'admin',
    description: 'People, departments, apps, status, updates and activity',
    requiredRole: 'admin',
    // people, departments, apps and the system are the organisation's, whichever floor you stand on
    sameOnEveryFloor: true,
    areas: [
      { id: 'organisation', label: 'Organisation', icon: 'structure', detail: 'People and departments' },
      { id: 'system', label: 'System', icon: 'server', detail: 'Apps, status, updates and activity' },
    ],
    menu: [
      {
        label: 'People',
        icon: 'people',
        area: 'organisation',
        items: [
          { label: 'Everyone', icon: 'list', path: '/people', detail: 'Roles, departments, sign-in', keywords: 'users accounts roles disable' },
          { label: 'Add a person', icon: 'user-plus', path: '/people/new', keywords: 'invite create user' },
        ],
      },
      {
        label: 'Departments',
        icon: 'department',
        area: 'organisation',
        items: [
          { label: 'All departments', icon: 'list', path: '/departments', detail: 'Names and members', keywords: 'groups teams' },
          { label: 'New department', icon: 'plus', path: '/departments/new', keywords: 'create group team' },
        ],
      },
      {
        label: 'Apps',
        icon: 'apps',
        area: 'system',
        items: [{ label: 'All apps', icon: 'list', path: '/apps', detail: 'Versions, on or off', keywords: 'catalogue registry enable disable' }],
      },
      {
        label: 'AUGUR',
        icon: 'pulse',
        area: 'system',
        items: [
          { label: 'Status', icon: 'gauge', path: '/status', detail: 'Is everything running', keywords: 'health services down up uptime' },
          { label: 'Upgrade Centre', icon: 'download', path: '/updates', detail: 'From dev to production, and upgrading', keywords: 'updates upgrade release version new dev preview production pipeline' },
          { label: 'Activity', icon: 'clock', path: '/activity', detail: 'Who changed what', keywords: 'audit log history changes' },
        ],
      },
    ],
  },
  {
    id: 'upgrades',
    name: 'Upgrade Centre',
    route: '/upgrades',
    entry: '/apps/upgrades/entry.js',
    version: PLATFORM_APP_VERSIONS.upgrades,
    sdk: '^1.9.0',
    icon: 'download',
    description: 'What this deployment runs, and upgrading it',
    requiredRole: 'admin',
    // what a deployment runs is the deployment's, whichever floor you stand on
    sameOnEveryFloor: true,
    // its sections are in its own rail (ADR 0030)
    orbit: false,
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
    search: { type: 'boolean' },
    storage: { type: 'object', additionalProperties: false, properties: { database: { type: 'boolean' }, bucket: { type: 'boolean' } } },
    maxUpload: { type: 'integer', minimum: 1, maximum: MAX_UPLOAD_MB },
    previews: {
      type: 'array',
      maxItems: MAX_FEATURE_PREVIEWS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,39}$' },
          name: { type: 'string', minLength: 1, maxLength: 60 },
          detail: { type: 'string', maxLength: 200 },
          until: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        },
      },
    },
    settings: {
      type: 'array',
      maxItems: MAX_SETTINGS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'type', 'min', 'max', 'default'],
        properties: {
          id: { type: 'string', pattern: '^[a-z][a-zA-Z0-9]{0,39}$' },
          label: { type: 'string', minLength: 1, maxLength: 60 },
          detail: { type: 'string', maxLength: 200 },
          type: { enum: ['integer'] },
          unit: { type: 'string', maxLength: 20 },
          min: { type: 'integer' },
          max: { type: 'integer' },
          default: { type: 'integer' },
        },
      },
    },
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
    orbit: { type: 'boolean' },
    sameOnEveryFloor: { type: 'boolean' },
    focus: { type: 'boolean' },
    areas: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label'],
        properties: {
          id: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,39}$' },
          label: { type: 'string', minLength: 1, maxLength: 40 },
          icon: { type: 'string', maxLength: 40 },
          detail: { type: 'string', maxLength: 60 },
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
          area: { type: 'string', maxLength: 40 },
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

/** What's wrong with the settings and feature previews an app offers, or undefined when nothing is. */
export const settingsProblem = (entry: AppEntry): string | undefined => {
  const previews = new Set<string>();
  for (const preview of entry.previews ?? []) {
    if (previews.has(preview.id)) return `${entry.name} offers the preview "${preview.id}" twice.`;
    previews.add(preview.id);
    if (preview.until && Number.isNaN(Date.parse(`${preview.until}T00:00:00Z`))) return `${entry.name}'s preview "${preview.id}" runs until "${preview.until}", which isn't a day.`;
  }
  const seen = new Set<string>();
  for (const setting of entry.settings ?? []) {
    if (seen.has(setting.id)) return `${entry.name} offers the setting "${setting.id}" twice.`;
    seen.add(setting.id);
    if (setting.min > setting.max) return `${entry.name}'s setting "${setting.id}" has a min above its max.`;
    if (setting.default < setting.min || setting.default > setting.max) return `${entry.name}'s setting "${setting.id}" defaults to ${setting.default}, outside ${setting.min} to ${setting.max}.`;
  }
  return undefined;
};

/** Why an app can't take the id or route it asked for, or undefined when it can. */
export const conflictFor = (entry: AppEntry, others: AppEntry[]): string | undefined => {
  const platform = platformApps.find((a) => a.id === entry.id);
  if (platform) return `"${entry.id}" is one of AUGUR's own apps.`;
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
    return `${entry.name}'s entry "${entry.entry}" is neither a path on AUGUR's own address nor a full web address.`;
  }
  if (allowed.includes(url.origin)) return undefined;
  return `${entry.name} loads from ${url.origin}, which isn't a place apps are allowed to load from. An admin can allow it in Admin, Apps.`;
};
