/**
 * The registry API's wire shapes, once: Fastify validates requests against them, and
 * contracts/registry.openapi.yaml is generated from them (pnpm contracts, ADR 0055).
 * A shape with an `$id` is a named schema in the contract; routes point at it with `ref`.
 * This file has the catalogue's shapes; update-schemas.ts has the Upgrade Centre's and
 * app-runner-schemas.ts the app runner's. contract.ts lists them all.
 */
import Type, { type Static, type TSchema } from 'typebox';
import { SCOPES } from '@augur/service-kit';
import { APP_CATEGORIES } from '@augur/mfe-sdk';
import {
  appAreaSchema,
  appEntrySchema,
  appMenuCategorySchema,
  appMenuItemSchema,
  appSettingSchema,
  featurePreviewSchema,
  FLOOR_KINDS,
  MAX_UPLOAD_MB,
  surfaceSchema,
  type AppEntry,
} from './manifest.ts';

/** Points at a named schema, keeping its TypeScript type. */
export const ref = <T extends TSchema & { $id?: string }>(schema: T) => Type.Unsafe<Static<T>>(Type.Ref(schema.$id!));

/**
 * What every refusal carries: an RFC 9457 problem (`application/problem+json`, @augur/service-kit's
 * problemDetails), with AUGUR's `reason` and `whoCanChange`, and `error` and `message` for SDK 1.x clients.
 * A handler may send just `{ error, message }`: problemDetails adds the rest.
 */
export const Refusal = Type.Unsafe<{ error: string; message: string; [extension: string]: unknown }>(
  Type.Object(
    {
      type: Type.String({ description: 'about:blank unless the problem names its own type' }),
      title: Type.String({ description: "The status's own phrase" }),
      status: Type.Integer(),
      detail: Type.String({ description: 'Says why, and what would change it' }),
      instance: Type.Optional(Type.String()),
      reason: Type.String({ description: 'A stable code a client can switch on', examples: ['forbidden'] }),
      whoCanChange: Type.Optional(Type.String({ description: 'Who can fix it, in plain words, when someone can' })),
      error: Type.String({ description: 'The same as reason, for SDK 1.x clients' }),
      message: Type.String({ description: 'The same as detail, for SDK 1.x clients' }),
    },
    { $id: 'Refusal' },
  ),
);

/** A refusal, and when it happens. */
export const refused = (description: string) => ({ description, content: { 'application/problem+json': { schema: ref(Refusal) } } });

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
    "notifications:send: notify people (for itself only). audit:write: add entries for itself to the audit log. models:use: call the model gateway (counted against the app's daily limit). events:publish: publish domain events on its own topics (<app id>.*). events:subscribe: read domain events on any topic. people:read: ask identity who a person stands for (their teams) and find people and teams by name, for sharing. inbox:write: put work in people's and teams' inboxes, and change or close the app's own items. knowledge:read: read the knowledge graph as the person the app acts for, on the floors they can see. knowledge:act: take the knowledge graph's actions apps are granted, as that person. knowledge:extract: add what a source says to the knowledge graph (retain).",
});

export const FloorKind = Type.Enum([...FLOOR_KINDS], { $id: 'FloorKind', description: 'team means any team, at any depth' });

// The manifest's parts are manifest.ts's own schemas, the ones contracts/manifest.schema.json is made from:
// here they get the name the contract lists them under, and the parts they hold point at theirs.
/** A manifest part, named for the contract, with `parts` pointing at the named schemas it holds. */
const named = <T extends TSchema & { properties: Record<string, unknown> }>($id: string, schema: T, parts: Partial<Record<keyof T['properties'], unknown>> = {}) =>
  Type.Unsafe<Static<T>>({ ...schema, $id, properties: { ...schema.properties, ...parts } });

/** An array property whose items are a named schema. */
const listOf = <T extends { items: unknown }>(property: T, $id: string) => ({ ...property, items: Type.Ref($id) });

export const Surface = named('Surface', surfaceSchema, { floor: Type.Ref('FloorKind') });
export const AppMenuItem = named('AppMenuItem', appMenuItemSchema);
export const AppMenuCategory = named('AppMenuCategory', appMenuCategorySchema, { items: listOf(appMenuCategorySchema.properties.items, 'AppMenuItem') });
export const AppArea = named('AppArea', appAreaSchema);
export const AppSetting = named('AppSetting', appSettingSchema);
export const FeaturePreview = named('FeaturePreview', featurePreviewSchema);

/**
 * An app's manifest entry: what an app registers, and what the shell is given. It is manifest.ts's
 * appEntrySchema, which carries the $id AppManifestEntry, with its parts pointing at their named schemas.
 */
const entry = appEntrySchema.properties;
export const AppManifestEntry = Type.Unsafe<AppEntry>({
  ...appEntrySchema,
  properties: {
    ...entry,
    previews: listOf(entry.previews, 'FeaturePreview'),
    scopes: listOf(entry.scopes, 'Scope'),
    settings: listOf(entry.settings, 'AppSetting'),
    floors: listOf(entry.floors, 'FloorKind'),
    surfaces: listOf(entry.surfaces, 'Surface'),
    menu: listOf(entry.menu, 'AppMenuCategory'),
    areas: listOf(entry.areas, 'AppArea'),
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
      platform: Type.Boolean({ description: "One of AUGUR's own apps, always on" }),
      contract: Type.Optional(Type.Integer({ description: 'The app contract major it is on; missing for one registered on contract 2' })),
      category: Type.Optional(Type.Enum([...APP_CATEGORIES], { description: 'The kind in force (ADR 0032)' })),
      categoryRefused: Type.Optional(
        Type.Object(
          { asked: Type.Enum([...APP_CATEGORIES]), why: Type.String() },
          { description: "The app's own claim to a kind when it isn't used, and why" },
        ),
      ),
      ships: Type.Optional(Type.Boolean({ description: 'Never set: no app ships with AUGUR (ADR 0075). Kept for /v1 readers.', deprecated: true })),
      pillar: Type.Optional(Type.Boolean({ description: 'Never set: the old name for `ships`, kept for /v1 readers.', deprecated: true })),
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

export const FeaturePreviewMode = Type.Enum(['off', 'opt-in', 'everyone', 'floors'], {
  $id: 'FeaturePreviewMode',
  description: 'Who gets a feature preview: nobody, those who turn it on, everyone, or chosen floors and the floors beneath them',
});

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
          floors: Type.Optional(Type.Array(Type.String(), { description: 'With mode floors: the floors it is on for' })),
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
