/**
 * An app's manifest.json: what it may say, once. The registry validates PUT /apps/{id} against
 * `appEntrySchema`, its handlers use the `AppEntry` type made from it, and `pnpm manifest-schema`
 * publishes it as contracts/manifest.schema.json for app repositories to check against (ADR 0055).
 */
import Type, { type Static } from 'typebox';
import semver from 'semver';
import { SCOPES } from '@augur/service-kit';
import { PLATFORM_APP_VERSIONS } from './platform-app-versions.js';

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
 * A feature an app is trying out (SDK 1.7). Off for everyone until an admin says otherwise, or opt-in
 * by default on a preview server; the app asks `ctx.previewOn(id)` and keeps working without it.
 */
export const featurePreviewSchema = Type.Object(
  {
    id: Type.String({ pattern: '^[a-z][a-z0-9-]{0,39}$', description: 'How the app names it: "board-view"' }),
    name: Type.String({ minLength: 1, maxLength: 60 }),
    detail: Type.Optional(Type.String({ maxLength: 200, description: 'A sentence on what it changes, for the person choosing it' })),
    until: Type.Optional(
      Type.String({
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: "Its last day, YYYY-MM-DD; after it, it's off for everyone and Admin says the app should drop it or ship it",
      }),
    ),
  },
  { additionalProperties: false },
);
export type FeaturePreview = Static<typeof featurePreviewSchema>;

/**
 * One setting an app offers admins, such as how long it keeps deleted things. A whole number
 * between `min` and `max`, `default` until an admin changes it.
 */
export const appSettingSchema = Type.Object(
  {
    id: Type.String({ pattern: '^[a-z][a-zA-Z0-9]{0,39}$', description: 'How the app\'s service names it: "retentionDays"' }),
    label: Type.String({ minLength: 1, maxLength: 60 }),
    detail: Type.Optional(Type.String({ maxLength: 200, description: 'A sentence on what it changes' })),
    type: Type.Unsafe<'integer'>({ enum: ['integer'] }),
    unit: Type.Optional(Type.String({ maxLength: 20, description: 'What the number counts, shown after it: "days"' })),
    min: Type.Integer(),
    max: Type.Integer(),
    default: Type.Integer({ description: 'Between min and max' }),
  },
  { additionalProperties: false },
);
export type AppSetting = Static<typeof appSettingSchema>;

/**
 * One thing an app shows on one kind of floor. Several surfaces can share a
 * module, and the app's route is the same on every floor. When several match,
 * the most specific floor wins, then a role condition, then manifest order.
 */
export const surfaceSchema = Type.Object(
  {
    floor: Type.Enum([...FLOOR_KINDS], { description: '"team" means any team, at any depth' }),
    slot: Type.Enum([...SURFACE_SLOTS]),
    module: Type.String({ pattern: '^[A-Za-z0-9_./-]+$', maxLength: 100, description: "The module the app's entry exposes for it" }),
    role: Type.Optional(Type.Enum(['member', 'lead'], { description: 'Only for people with this role on the floor' })),
    rollup: Type.Optional(Type.Boolean({ description: "Shows this floor and the teams below it that the person is on, using the platform's roll-up" })),
  },
  { additionalProperties: false },
);
export type Surface = Static<typeof surfaceSchema>;

export const appMenuItemSchema = Type.Object(
  {
    id: Type.Optional(Type.String({ maxLength: 40 })),
    label: Type.String({ minLength: 1, maxLength: 60 }),
    icon: Type.Optional(Type.String({ maxLength: 40, description: 'A UI kit icon name' })),
    detail: Type.Optional(Type.String({ maxLength: 60, description: 'One short fact, never a sentence' })),
    keywords: Type.Optional(Type.String({ maxLength: 140, description: 'Extra words search finds it by' })),
    ai: Type.Optional(Type.Boolean()),
    path: Type.String({ pattern: '^/.+', maxLength: 200, description: "Where in the app it opens, below the app's route" }),
  },
  { additionalProperties: false },
);
export type AppMenuItem = Static<typeof appMenuItemSchema>;

export const appMenuCategorySchema = Type.Object(
  {
    id: Type.Optional(Type.String({ maxLength: 40 })),
    label: Type.String({ minLength: 1, maxLength: 40 }),
    icon: Type.Optional(Type.String({ maxLength: 40, description: 'A UI kit icon name' })),
    ai: Type.Optional(Type.Boolean()),
    area: Type.Optional(Type.String({ maxLength: 40, description: "The id of the app's area the group belongs to (SDK 1.5)" })),
    items: Type.Array(appMenuItemSchema, { minItems: 1, maxItems: 12 }),
  },
  { additionalProperties: false },
);
export type AppMenuCategory = Static<typeof appMenuCategorySchema>;

export const appAreaSchema = Type.Object(
  {
    id: Type.String({ pattern: '^[a-z][a-z0-9-]{0,39}$' }),
    label: Type.String({ minLength: 1, maxLength: 40 }),
    icon: Type.Optional(Type.String({ maxLength: 40, description: "A UI kit icon name, not the app's own" })),
    detail: Type.Optional(Type.String({ maxLength: 60, description: "One line on what's in it" })),
  },
  { additionalProperties: false },
);
export type AppArea = Static<typeof appAreaSchema>;

/**
 * What a registering app may send: its manifest.json, the registry's AppManifestEntry. Published as
 * contracts/manifest.schema.json. The rules a schema can't say are versionProblem, surfaceProblem,
 * settingsProblem and conflictFor (refused) and menuWarnings (accepted, with a warning), below.
 */
export const appEntrySchema = Type.Object(
  {
    $schema: Type.Optional(
      Type.String({ maxLength: 500, description: "Where editors find this schema, contracts/manifest.schema.json: a path or an address. The registry doesn't use it." }),
    ),
    id: Type.String({ pattern: '^[a-z][a-z0-9-]{1,39}$', description:'The app\'s id, such as "board"; its route, client and storage are named after it' }),
    name: Type.String({ minLength: 1, maxLength: 60, description: 'What people call the app' }),
    route: Type.String({ pattern: '^/[a-z0-9][a-z0-9/-]*$', maxLength: 100, description: 'Route prefix the shell maps to this app' }),
    entry: Type.String({ minLength: 1, maxLength: 500, description: "URL of the app's ES module entry" }),
    version: Type.String({ minLength: 1, maxLength: 40, description: "The app's release, semver" }),
    sdk: Type.String({
      minLength: 1,
      maxLength: 100,
      description: 'The @augur/mfe-sdk releases the app works with, a semver range such as ^1.0.0. The shell will not open an app whose range its SDK does not satisfy.',
    }),
    description: Type.Optional(Type.String({ maxLength: 140, description: 'One line shown under the app name in the shell' })),
    icon: Type.Optional(Type.String({ maxLength: 40, description: 'A UI kit icon name' })),
    requiredRole: Type.Optional(Type.String({ maxLength: 60, description: 'Only people with this role can open it' })),
    handles: Type.Optional(
      Type.Array(Type.String({ pattern: '^[a-z][a-z0-9.-]*$', maxLength: 80 }), { maxItems: 50, description: 'Intent types this app handles, such as document.open' }),
    ),
    ai: Type.Optional(Type.Boolean({ description: 'The app is an AI; the menus draw it as a bubble' })),
    search: Type.Optional(
      Type.Boolean({
        description: "The app's service answers GET /v1/search?q= with { results: [{ id, title, detail?, path?, workspace? }] }, and the shell's Find asks it",
      }),
    ),
    storage: Type.Optional(
      Type.Object(
        { database: Type.Optional(Type.Boolean()), bucket: Type.Optional(Type.Boolean()) },
        {
          additionalProperties: false,
          description:
            'The storage the app keeps on the platform: its own database schema, its own bucket. An admin adds the app to APP_STORAGE and its service gets DATABASE_URL (a login owning one schema) and S3_* (its own bucket). See docs/app-storage.md.',
        },
      ),
    ),
    maxUpload: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: MAX_UPLOAD_MB,
        description: `The largest request body, in MB, the gateway lets through to the app's service; ${DEFAULT_UPLOAD_MB} without it. An admin can lower it. In the manifest the registry serves, always present: what the app asks, or less where an admin lowered it.`,
      }),
    ),
    previews: Type.Optional(
      Type.Array(featurePreviewSchema, {
        maxItems: MAX_FEATURE_PREVIEWS,
        description: "Features the app is trying before they're everyone's (SDK 1.7): admins say who gets each, people turn opt-in ones on in the shell's Previews, and the app asks ctx.previewOn(id)",
      }),
    ),
    settings: Type.Optional(
      Type.Array(appSettingSchema, { maxItems: MAX_SETTINGS, description: "Settings the app offers admins in Admin, Apps; its service reads them from the registry's /apps/{id}/settings" }),
    ),
    scopes: Type.Optional(
      Type.Array(Type.Enum([...SCOPES]), {
        uniqueItems: true,
        maxItems: SCOPES.length,
        description: 'What the app\'s service asks to do on the platform, such as "notifications:send". An app may always register itself.',
      }),
    ),
    floors: Type.Optional(
      Type.Array(Type.Enum([...FLOOR_KINDS]), {
        minItems: 1,
        uniqueItems: true,
        maxItems: FLOOR_KINDS.length,
        description: 'The kinds of floor the app works on; every kind without it',
      }),
    ),
    surfaces: Type.Optional(
      Type.Array(surfaceSchema, {
        maxItems: 30,
        description:
          "What the app shows on each kind of floor, for the shell to place. When several match, the most specific floor wins, then a role condition, then manifest order. Each surface's floor must be in floors.",
      }),
    ),
    orbit: Type.Optional(
      Type.Boolean({
        description:
          "false: the app keeps its menu inside it, so the shell never shows its Orbit; its root opens the app, Title still lists its areas, and the band's Home and All apps are the way back to the shell's menus",
      }),
    ),
    sameOnEveryFloor: Type.Optional(
      Type.Boolean({
        description: "true: the app shows the same on every floor, so the shell's floor gauge rests while it's open, staying in view and saying why (SDK 1.6)",
      }),
    ),
    focus: Type.Optional(
      Type.Boolean({
        description: 'true: the app can narrow what it shows to a working context inside the floor, from ctx.focus (SDK 1.10). Reserved: the shell offers none yet (ADR 0029)',
      }),
    ),
    areas: Type.Optional(
      Type.Array(appAreaSchema, {
        maxItems: 6,
        description:
          "The broad parts of what the app covers, which Title lists under it (SDK 1.5). Menu groups name theirs in area. With fewer than two, Title shows the app alone. Nothing repeats its parent: the registry warns when an area's label or icon matches the app's, a group's its area's, or an item's its group's, and accepts the manifest. See docs/shell-principles.md",
      }),
    ),
    menu: Type.Optional(
      Type.Array(appMenuCategorySchema, { maxItems: 8, description: "The app's menu, shown by the shell as Orbit at the app's root. A group with one item opens it directly" }),
    ),
  },
  { $id: 'AppManifestEntry', additionalProperties: false },
);

/** One app in the catalogue, as the app itself describes it in its manifest.json. */
export type AppEntry = Static<typeof appEntrySchema>;

/** The kinds of floor an app works on. */
export const floorKindsOf = (entry: Pick<AppEntry, 'floors'>): readonly FloorKind[] => entry.floors ?? FLOOR_KINDS;

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
