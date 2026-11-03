/**
 * The registry API's wire shapes, once: Fastify validates requests against them, and
 * contracts/registry.openapi.yaml is generated from them (pnpm contracts, ADR 0055).
 * A shape with an `$id` is a named schema in the contract; routes point at it with `ref`.
 * This file has the catalogue's shapes; update-schemas.ts has the Upgrade Centre's and
 * app-runner-schemas.ts the app runner's. contract.ts lists them all.
 */
import Type, { type Static, type TSchema } from 'typebox';
import { SCOPES } from '@augur/service-kit';
import { appEntrySchema, FLOOR_KINDS, MAX_UPLOAD_MB, type AppEntry } from './manifest.ts';

/** Points at a named schema, keeping its TypeScript type. */
export const ref = <T extends TSchema & { $id?: string }>(schema: T) => Type.Unsafe<Static<T>>(Type.Ref(schema.$id!));

/** What every refusal carries: a short code, and a sentence a person can read. */
export const Refusal = Type.Object(
  { error: Type.String({ examples: ['forbidden'] }), message: Type.String({ description: 'Says why, and what would change it' }) },
  { $id: 'Refusal' },
);

/** A refusal, and when it happens. */
export const refused = (description: string) => ({ ...ref(Refusal), description });

/**
 * A value or null, as one `type` list: Fastify's Ajv coerces types, and in an anyOf it would turn a null
 * into "" or 0 before the null branch is tried.
 */
export const orNull = <T extends TSchema & { type: string }>(schema: T) => Type.Unsafe<Static<T> | null>({ ...schema, type: [schema.type, 'null'] });

/** A reply with no body. */
export const empty = (description: string) => Type.Unsafe<undefined>(Type.Null({ description }));

/** A path parameter, or several, as plain strings. */
export const params = <K extends string>(...names: K[]) => Type.Object(Object.fromEntries(names.map((n) => [n, Type.String()])) as Record<K, ReturnType<typeof Type.String>>);

export const Scope = Type.Enum([...SCOPES], {
  $id: 'Scope',
  description:
    "notifications:send: notify people (for itself only). audit:write: add entries for itself to the audit log. models:use: call the model gateway (counted against the app's daily limit). events:publish: publish domain events on its own topics (<app id>.*). events:subscribe: read domain events on any topic. people:read: ask identity who a person stands for (their teams) and find people and teams by name, for sharing.",
});

export const FloorKind = Type.Enum([...FLOOR_KINDS], { $id: 'FloorKind', description: 'team means any team, at any depth' });

// The manifest's parts are appEntrySchema's own (manifest.ts), named and described here: the registry
// validates a manifest exactly as manifest.ts says, and the contract names each part.
const entry = appEntrySchema.properties;
const surface = entry.surfaces.items;
const menuGroup = entry.menu.items;
const menuItem = menuGroup.properties.items.items;
const area = entry.areas.items;
const setting = entry.settings.items;
const preview = entry.previews.items;

export const Surface = Type.Unsafe<NonNullable<AppEntry['surfaces']>[number]>({
  ...surface,
  $id: 'Surface',
  properties: {
    ...surface.properties,
    floor: Type.Ref('FloorKind'),
    module: { ...surface.properties.module, description: "The module the app's entry exposes for it" },
    role: { ...surface.properties.role, description: 'Only for people with this role on the floor' },
    rollup: { ...surface.properties.rollup, description: "Shows the floor and the teams below it the person is on (identity's roll-up)" },
  },
});

export const AppMenuItem = Type.Unsafe<NonNullable<AppEntry['menu']>[number]['items'][number]>({
  ...menuItem,
  $id: 'AppMenuItem',
  properties: {
    ...menuItem.properties,
    detail: { ...menuItem.properties.detail, description: 'One short fact, never a sentence' },
    keywords: { ...menuItem.properties.keywords, description: 'Extra words search finds it by' },
    path: { ...menuItem.properties.path, description: "Where in the app it opens, below the app's route" },
  },
});

export const AppMenuCategory = Type.Unsafe<NonNullable<AppEntry['menu']>[number]>({
  ...menuGroup,
  $id: 'AppMenuCategory',
  properties: {
    ...menuGroup.properties,
    icon: { ...menuGroup.properties.icon, description: 'A UI kit icon name' },
    area: { ...menuGroup.properties.area, description: "The id of the app's area the group belongs to (SDK 1.5)" },
    items: { ...menuGroup.properties.items, items: Type.Ref('AppMenuItem') },
  },
});

export const AppArea = Type.Unsafe<NonNullable<AppEntry['areas']>[number]>({
  ...area,
  $id: 'AppArea',
  properties: {
    ...area.properties,
    icon: { ...area.properties.icon, description: "A UI kit icon name, not the app's own" },
    detail: { ...area.properties.detail, description: "One line on what's in it" },
  },
});

export const AppSetting = Type.Unsafe<NonNullable<AppEntry['settings']>[number]>({
  ...setting,
  $id: 'AppSetting',
  properties: {
    ...setting.properties,
    id: { ...setting.properties.id, description: "How the app's service names it, e.g. retentionDays" },
    unit: { ...setting.properties.unit, description: 'What the number counts, e.g. days' },
    default: { ...setting.properties.default, description: 'Between min and max' },
  },
});

export const FeaturePreview = Type.Unsafe<NonNullable<AppEntry['previews']>[number]>({
  ...preview,
  $id: 'FeaturePreview',
  properties: { ...preview.properties, until: { ...preview.properties.until, description: "Its last day; after it, it's off for everyone" } },
});

/** An app's manifest entry: what an app registers, and what the shell is given. Validated by manifest.ts's appEntrySchema. */
export const AppManifestEntry = Type.Unsafe<AppEntry>({
  ...appEntrySchema,
  $id: 'AppManifestEntry',
  properties: {
    ...entry,
    route: { ...entry.route, description: 'Route prefix the shell maps to this app' },
    entry: { ...entry.entry, description: "URL of the app's ES module entry" },
    version: { ...entry.version, description: "The app's release, semver" },
    sdk: {
      ...entry.sdk,
      description: 'The @augur/mfe-sdk releases the app works with, a semver range such as ^1.0.0. The shell will not open an app whose range its SDK does not satisfy.',
    },
    description: { ...entry.description, description: 'One line shown under the app name in the Shell' },
    icon: { ...entry.icon, description: 'A UI kit icon name' },
    handles: { ...entry.handles, description: 'Intent types this app handles, e.g. document.open' },
    ai: { ...entry.ai, description: 'The app is an AI; the menus draw it as a bubble' },
    orbit: {
      ...entry.orbit,
      description:
        "false: the app keeps its menu inside it, so the shell never shows its Orbit; its root opens the app, Title still lists its areas, and the band's Home and All apps are the way back to the shell's menus",
    },
    sameOnEveryFloor: {
      ...entry.sameOnEveryFloor,
      description: "true: the app shows the same on every floor, so the shell's floor gauge rests while it's open, staying in view and saying why (SDK 1.6)",
    },
    focus: {
      ...entry.focus,
      description: 'true: the app can narrow what it shows to a working context inside the floor, from ctx.focus (SDK 1.10). Reserved: the shell offers none yet (ADR 0029)',
    },
    previews: {
      ...entry.previews,
      items: Type.Ref('FeaturePreview'),
      description:
        "Features the app is trying before they're everyone's (SDK 1.7): admins say who gets each, people turn opt-in ones on in the shell's Previews, and the app asks ctx.previewOn(id)",
    },
    search: {
      ...entry.search,
      description: "The app's service answers GET /v1/search?q= with { results: [{ id, title, detail?, path?, workspace? }] }, and the shell's Find asks it",
    },
    storage: {
      ...entry.storage,
      description:
        'The storage the app keeps on the platform. An admin adds the app to APP_STORAGE and its service gets DATABASE_URL (a login owning one schema) and S3_* (its own bucket). See docs/app-storage.md.',
    },
    maxUpload: {
      ...entry.maxUpload,
      description:
        "The largest request, in MB, the gateway lets through to the app's service; 10 without it. In the manifest the registry serves, always present: what the app asks, or less where an admin lowered it.",
    },
    scopes: { ...entry.scopes, items: Type.Ref('Scope'), description: "What the app's service asks to do on the platform. An app may always register itself." },
    settings: { ...entry.settings, items: Type.Ref('AppSetting'), description: 'Settings the app offers admins (Admin, Apps); its service reads them from /apps/{id}/settings.' },
    floors: { ...entry.floors, items: Type.Ref('FloorKind'), description: 'The kinds of floor the app works on; every kind when absent' },
    surfaces: {
      ...entry.surfaces,
      items: Type.Ref('Surface'),
      description:
        "What the app shows on each kind of floor, for the shell to place. When several match, the most specific floor wins, then a role condition, then manifest order. Each surface's floor must be in floors.",
    },
    menu: { ...entry.menu, items: Type.Ref('AppMenuCategory'), description: "The app's menu, shown by the shell as Orbit at the app's root. A group with one item opens it directly" },
    areas: {
      ...entry.areas,
      items: Type.Ref('AppArea'),
      description:
        "The broad parts of what the app covers, which Title lists under it (SDK 1.5). With fewer than two, Title shows the app alone. Nothing repeats its parent: the registry warns when an area's label or icon matches the app's, a group's its area's, or an item's its group's, and accepts the manifest. See docs/shell-principles.md",
    },
  },
});

/** An entry in the manifest the shell is given: with, for the caller, the app's previews that are on. */
export const ServedEntry = Type.Intersect([
  ref(AppManifestEntry),
  Type.Object({
    previewsOn: Type.Optional(Type.Array(Type.String(), { description: "In the catalogue the registry serves: the ids of the app's previews on for the caller (SDK 1.7)" })),
  }),
]);

export const CatalogueEntry = Type.Intersect(
  [
    ref(AppManifestEntry),
    Type.Object({
      platform: Type.Boolean({ description: 'Ships with the platform and is always on' }),
      pillar: Type.Optional(
        Type.Boolean({
          description:
            'Ships with AUGUR (PILLAR_APPS) but is an ordinary app: it registers itself, is given the scopes its release asks for, changes version with the release, and can be turned off but not removed.',
        }),
      ),
      enabled: Type.Boolean(),
      registeredBy: Type.Optional(Type.String({ description: 'The service or admin that last registered it' })),
      registeredAt: Type.Optional(Type.String({ format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ format: 'date-time' })),
      pinnedVersion: Type.Optional(Type.String({ description: 'Set when an admin holds the app at this version' })),
      blocked: Type.Optional(Type.String({ description: "Set when the app's entry is on an origin no longer allowed: why it isn't offered" })),
      grantedScopes: Type.Optional(Type.Array(ref(Scope), { description: 'What it asks for that an admin has granted' })),
      awaitingScopes: Type.Optional(Type.Array(ref(Scope), { description: 'What it asks for that no admin has granted yet' })),
      uploadLimit: Type.Optional(Type.Integer({ description: "What the gateway lets through to the app's service in one request, in MB" })),
      uploadLimitLowered: Type.Optional(Type.Boolean({ description: 'Set when an admin has lowered it below what the manifest asks' })),
      upstream: Type.Optional(Type.String({ description: "Where the gateway reaches the app's service, when set (PUT /apps/{id}/upstream)" })),
    }),
  ],
  { $id: 'CatalogueEntry' },
);

export const AppSettings = Type.Object(
  {
    settings: Type.Array(
      Type.Intersect([
        ref(AppSetting),
        Type.Object({
          value: Type.Integer({ description: "An admin's value, or the default" }),
          setBy: Type.Optional(Type.String({ description: 'The admin who set it' })),
          setAt: Type.Optional(Type.String({ format: 'date-time' })),
        }),
      ]),
    ),
  },
  { $id: 'AppSettings' },
);

export const FloorRule = Type.Object(
  {
    app: Type.String(),
    workspace: Type.String(),
    state: Type.Enum(['on', 'off', 'blocked']),
    carriesOn: Type.Boolean({ description: 'Whether it applies to the teams below too; always true for blocked' }),
    setBy: Type.String(),
    setAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'FloorRule' },
);

export const AllowedOrigin = Type.Object(
  { origin: Type.String(), addedBy: Type.String(), addedAt: Type.String({ format: 'date-time' }) },
  { $id: 'AllowedOrigin' },
);

export const StoredFrontend = Type.Object(
  {
    app: Type.String(),
    version: Type.String(),
    digest: Type.String({ description: 'sha256 of the tarball, sha256:<hex>' }),
    folder: Type.Optional(Type.String({ description: "The folder its files are in, under /apps/{id}/; absent for ones kept in the version's own" })),
    files: Type.Array(Type.String()),
    bytes: Type.Integer(),
    publishedBy: Type.String(),
    publishedAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'StoredFrontend' },
);

export const FeaturePreviewMode = Type.Enum(['off', 'opt-in', 'everyone'], { $id: 'FeaturePreviewMode' });

export const ServerRing = Type.Enum(['dev', 'preview', 'production'], {
  $id: 'ServerRing',
  description:
    "What kind of server this is (SERVER_RING in .env): dev is the workbench, which also runs AUGUR's dev builds; a production one takes only releases promoted to production",
});

export const FeaturePreviewsAdmin = Type.Object(
  {
    defaultMode: ref(FeaturePreviewMode),
    ring: ref(ServerRing),
    previews: Type.Array(
      Type.Intersect([
        ref(FeaturePreview),
        Type.Object({
          mode: ref(FeaturePreviewMode),
          ended: Type.Boolean(),
          chosen: Type.Boolean({ description: "An admin chose its mode; false means the server's default" }),
          setBy: Type.Optional(Type.String()),
          setAt: Type.Optional(Type.String({ format: 'date-time' })),
          optedIn: Type.Integer({ description: 'How many people turned it on' }),
        }),
      ]),
    ),
  },
  { $id: 'FeaturePreviewsAdmin' },
);

/** Whether an app is on for a floor, and why. */
export const floorStateOf = (whys: string[], by: string) =>
  Type.Object({ on: Type.Boolean(), why: Type.Enum(whys), by: Type.Optional(Type.String({ description: by })) });

/** How much an app may be sent in one request, in MB; `null` gives it what its manifest asks again. */
export const UploadLimitBody = Type.Object({ mb: Type.Union([Type.Integer({ minimum: 1, maximum: MAX_UPLOAD_MB }), Type.Null()]) }, { additionalProperties: false });
