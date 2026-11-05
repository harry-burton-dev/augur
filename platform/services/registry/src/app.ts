import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import {
  callerFromHeaders,
  frontendDigest,
  isGatewayCaller,
  FrontendProblem,
  FRONTEND_LIMITS,
  unpackFrontend,
  FloorsUnavailable,
  health,
  identifyService,
  packageVersion,
  recordAudit,
  ruleChain,
  SCOPES,
  ServiceAuthUnavailable,
  problemDetails,
  serviceFastifyOptions,
  type FloorLookup,
  type FloorPlace,
  type NewAuditEntry,
  type ServiceCredentials,
  type ServiceIdentity,
  type ServiceVerifier,
  signedCallers,
  type CallerCheck,
} from '@augur/service-kit';
import { APP_CATEGORIES, SDK_VERSION } from '@augur/mfe-sdk';
import { appRunnerRoutes } from './app-runner.ts';
import { platformUpgradeRoutes } from './platform-upgrades.ts';
export { UPGRADE_SIGN_IN_MS } from './platform-upgrades.ts';
import { describeApi } from './contract.ts';
import {
  AllowedOrigin,
  AppManifestEntry,
  AppSettings,
  CatalogueEntry,
  empty,
  FloorRule as FloorRuleSchema,
  floorStateOf,
  orNull,
  params,
  ref,
  refused,
  Scope as ScopeSchema,
  ServedEntry,
  StoredFrontend as StoredFrontendSchema,
  UploadLimitBody,
} from './schemas.ts';
import { strings } from './update-schemas.ts';
import { overviewBuilder, overviewRoutes } from './overview.ts';
import { reportRoutes, ReportSender, type Reporting } from './report.ts';
import { alertRoutes, type AlertRouteOptions } from './alerts.ts';
import { featurePreviewRoutes, platformRecord, previewsOnFor } from './feature-previews.ts';
import { AppUpdateChecker } from './app-updates.ts';
import { awaitingScopes, floorState, usableScopes } from './floors.ts';
import {
  categoryOf,
  conflictFor,
  DEFAULT_UPLOAD_MB,
  entryOriginProblem,
  MAX_UPLOAD_MB,
  menuWarnings,
  parseOrigin,
  platformApps,
  settingsProblem,
  surfaceProblem,
  floorKindsOf,
  unbuiltApps,
  versionProblem,
  type AppEntry,
  type CategoryInForce,
} from './manifest.ts';
import { AUGUR_RELEASE } from './augur-version.ts';
import { LiveOverrides } from './live.ts';
import type { PipelineReader } from './pipeline.ts';
import { UpdateChecker } from './updates.ts';
import { frontendFolder, servedEntry, type FrontendFiles } from './frontends.ts';
import { upstreamProblem } from './upstreams.ts';
import semver from 'semver';
import {
  MemoryAppStore,
  RouteTakenError,
  UnknownVersionError,
  type AppRecord,
  type AppStore,
  type FloorRule,
  type StoredFrontend,
} from './store.ts';

/** How identity names the organisation's floor, for a call that names none. */
const ORG_FLOOR = 'org';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface RegistryOptions {
  store?: AppStore;
  /** Checks apps' and platform services' own sign-in tokens. Without it only admins can change the catalogue. */
  verifyService?: ServiceVerifier;
  /** Where changes to the catalogue are recorded, with the floor a change is about. Without it nothing is audited. */
  audit?: (entry: NewAuditEntry, workspace?: string) => Promise<void>;
  /** Where a floor sits, from identity. Without it nothing can be answered for a floor (503). */
  floors?: FloorLookup;
  /** What the release feed says is out. Without it the Updates page says the feed is off. */
  updates?: UpdateChecker;
  /** Checks the caller the gateway signed (callerCheckFromEnv). Without it `x-user-*` headers are believed as they come, as in local dev. */
  callers?: CallerCheck;
  /**
   * Apps that ship with AUGUR (PILLAR_APPS), its pillar apps. Each is an ordinary app that registers
   * itself on first start, but it is given the scopes its release asks for with no admin step, its
   * version comes with the release, and it can be turned off but never removed.
   */
  pillars?: string[];
  /**
   * The frontends bucket, where each version of an app's frontend is kept and served from
   * /apps/<id>/<version>/. Without it apps are served from wherever their manifests' `entry` says.
   */
  frontendFiles?: FrontendFiles;
  /** Whether pull requests' builds run for apps' developers: always on a preview server, by ALLOW_PR_PREVIEWS on a production one. */
  allowPrPreviews?: boolean;
  /** The app feed, for the app runner's installs and updates (Admin → Apps). Without one nothing is offered. */
  appUpdates?: AppUpdateChecker;
  /** The pipeline feed, for the Upgrade Centre's line from dev to production. Without it the line is off. */
  pipeline?: PipelineReader;
  /** The company's Backstage (PORTAL_URL), which the Upgrade Centre links to and the deployment reports to. */
  portalUrl?: string;
  /** Whether and where the deployment reports what it runs (ADR 0019; DEPLOYMENT_ID, DEPLOYMENT_REPORTING). Off without it. */
  reporting?: Reporting;
  /** Sends the record to Backstage; made from `reporting` when not given (tests give their own). */
  reportFetch?: typeof fetch;
  /** The workbench's own tailnet, from PLATFORM_URL: Live on the workbench loads only from machines on it. */
  tailnet?: string;
  /** Grafana's alerts as notices (ADR 0059): its token, and how a notice is sent. Refused without a token. */
  alerts?: AlertRouteOptions;
  /** The deployment's time zone (DEPLOYMENT_TIME_ZONE), which upgrade windows are in unless a unit names its own. */
  timeZone?: string;
  now?: () => Date;
}

/** PILLAR_APPS: the ids of the apps this deployment ships with, space or comma separated. */
export const pillarsFromEnv = (env: Record<string, string | undefined> = process.env) => (env.PILLAR_APPS ?? '').split(/[\s,]+/).filter(Boolean);

/** Records audit entries with the events service, as the registry. */
export const auditTo = (eventsUrl: string, credentials: ServiceCredentials) => (entry: NewAuditEntry, workspace?: string) =>
  recordAudit({ eventsUrl, credentials, entry, workspace });

/** A registered app as admins see it in the catalogue. */
/** What the app's manifest asks to be sent in one request, in MB. */
const askedUpload = (r: AppRecord) => r.entry.maxUpload ?? DEFAULT_UPLOAD_MB;
/** What the gateway lets through to the app in one request, in MB: what it asks, or less where an admin lowered it. */
const uploadLimitOf = (r: AppRecord) => Math.min(askedUpload(r), r.uploadLimitMb ?? MAX_UPLOAD_MB);

/** An app's settings as its manifest offers them, each with the value in force: an admin's, or its default. */
const settingsOf = (r: AppRecord) => ({
  settings: (r.entry.settings ?? []).map((setting) => {
    const set = r.settings?.[setting.id];
    // A value set before the app narrowed the range is kept, but only used while it still fits.
    const fits = set && set.value >= setting.min && set.value <= setting.max;
    return { ...setting, value: fits ? set.value : setting.default, ...(fits ? { setBy: set.setBy, setAt: set.setAt } : {}) };
  }),
});

const catalogueEntry = (r: AppRecord, allowed: string[], ships: boolean, kind: CategoryInForce) => {
  const blocked = entryOriginProblem(r.entry, allowed);
  const { category: _asked, ...entry } = r.entry;
  return {
    ...entry,
    // Registered from an origin no longer allowed: kept, but not offered.
    ...(blocked ? { blocked } : {}),
    platform: false,
    // The kind in force (ADR 0032), and the app's own claim when it isn't used, so Admin can say why.
    ...(kind.category ? { category: kind.category } : {}),
    ...(kind.refused ? { categoryRefused: kind.refused } : {}),
    // Ships with AUGUR: its version comes with the release, and it's turned off rather than removed.
    // `pillar` is the old name for `ships`, kept for /v1 readers.
    ...(ships ? { ships: true, pillar: true } : {}),
    enabled: r.enabled,
    registeredBy: r.registeredBy,
    registeredAt: r.registeredAt,
    updatedAt: r.updatedAt,
    ...(r.pinnedVersion ? { pinnedVersion: r.pinnedVersion } : {}),
    grantedScopes: usableScopes(r),
    ...(awaitingScopes(r).length ? { awaitingScopes: awaitingScopes(r) } : {}),
    uploadLimit: uploadLimitOf(r),
    ...(r.uploadLimitMb !== undefined ? { uploadLimitLowered: true } : {}),
    ...(r.upstream ? { upstream: r.upstream } : {}),
  };
};

/** What one floor's rule changes, as the activity log names it. */
const RULE_ACTIONS: Record<FloorRule['state'] | 'inherit', string> = { on: 'app.enabled', off: 'app.disabled', blocked: 'app.blocked', inherit: 'app.inherited' };

/**
 * The catalogue of apps. The platform's own apps are built in; every other app
 * registers itself, and each person is shown only the apps their roles allow.
 */
export const buildApp = async ({
  store = new MemoryAppStore(),
  verifyService,
  audit,
  floors,
  updates = new UpdateChecker({ running: AUGUR_RELEASE }),
  callers,
  pillars = [],
  frontendFiles,
  appUpdates = new AppUpdateChecker(),
  allowPrPreviews = true,
  pipeline,
  portalUrl,
  reporting = { mode: 'off', why: 'Reporting isn’t set up: set DEPLOYMENT_ID in .env to this server’s name in Backstage (org/deployments.yaml).' },
  reportFetch,
  tailnet,
  alerts = {},
  timeZone = 'UTC',
  now = () => new Date(),
}: RegistryOptions = {}) => {
  const isPillar = (id: string) => pillars.includes(id);
  /** The apps the app runner installed from the signed app feed, whose kind is honoured too. */
  const feedApps = async () => new Set((await store.installedApps()).map((i) => i.app));
  const kindOf = (entry: Pick<AppEntry, 'id' | 'category'>, feed: ReadonlySet<string>) => categoryOf(entry, { ships: isPillar(entry.id), fromFeed: feed.has(entry.id) });
  const live = new LiveOverrides(updates.ring, tailnet);
  const entryOf = (r: AppRecord, allowed: string[], kept: StoredFrontend[], feed: ReadonlySet<string>) =>
    catalogueEntry({ ...r, entry: servedEntry(r.entry, kept) }, allowed, isPillar(r.entry.id), kindOf(r.entry, feed));
  // Unknown manifest fields are refused, not dropped: a misspelt requiredRole must not open an app to everyone.
  const app = Fastify(serviceFastifyOptions()).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(problemDetails());
  await describeApi(app, `/${API_VERSION}`);
  // Before anything reads the caller: only the gateway's signed word says who is calling.
  app.addHook('onRequest', signedCallers(callers));
  app.get('/healthz', { schema: { hide: true } }, async () => health('registry', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (plain) => {
      const app = plain.withTypeProvider<TypeBoxTypeProvider>();
      const allowedOrigins = async () => (await store.origins()).map((o) => o.origin);

      /** Where a floor sits; undefined (and the reply sent) when it can't be said. */
      const placeOf = async (reply: FastifyReply, workspace: string): Promise<FloorPlace | undefined> => {
        if (!floors) {
          void reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up: the registry has no way to reach identity.' });
          return undefined;
        }
        try {
          const place = await floors(workspace);
          if (!place) void reply.code(404).send({ error: 'not_found', message: 'There is no such floor.' });
          return place;
        } catch (err) {
          if (!(err instanceof FloorsUnavailable)) throw err;
          void reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up right now. Try again in a moment.' });
          return undefined;
        }
      };

      // The gateway verified who is calling, and the floor they're on, and passed both on.
      app.get(
        '/manifest',
        {
          schema: {
            summary: 'Apps the caller may open',
            description: [
              'With `workspace`, the apps on for that floor: the caller must be on it,',
              'so the request also carries it as X-Workspace-Id, which the gateway',
              'checks. An app is on a floor when it is turned on, works on that kind',
              "of floor (its manifest's `floors`), isn't blocked on the floor or any",
              'floor above, and the nearest install from the floor upwards says on (or',
              'there is none). A personal floor follows the org.',
            ].join(' '),
            querystring: Type.Object({ workspace: Type.Optional(Type.String({ maxLength: 100, description: 'The floor to list apps for' })) }),
            response: {
              200: Type.Array(ServedEntry, {
                description: "Manifest entries filtered by the caller's roles, leaving out apps an admin has turned off, and with a workspace those off there",
              }),
              403: refused("The workspace isn't the floor the gateway checked"),
              404: refused('No such floor'),
              503: refused("Floors can't be looked up right now"),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          const roles = caller?.roles ?? [];
          const { workspace } = req.query;
          // Only the floor the gateway checked: a person can't read the catalogue of a floor they aren't on.
          if (workspace && caller?.workspace?.id !== workspace) {
            return reply.code(403).send({ error: 'forbidden', message: 'Ask for the catalogue of the floor you’re on, with its X-Workspace-Id.' });
          }
          const place = workspace ? await placeOf(reply, workspace) : undefined;
          if (workspace && !place) return reply;
          // An app whose origin an admin has stopped allowing isn't offered, even though it stays registered.
          const allowed = await allowedOrigins();
          const rules = place ? await store.rules() : [];
          const kept = await store.frontends();
          const previews = await previewsChosenBy(caller?.id);
          const optIns = caller ? await store.featureOptIns({ person: caller.id }) : [];
          const feed = await feedApps();
          const at = new Date();
          const registered = (await store.records())
            .filter((r) => r.enabled && !entryOriginProblem(r.entry, allowed) && (!place || floorState(r, place, rules).on))
            // The limit the gateway holds requests to the app's service to (SDK 1.3), and the version's own copy of its code:
            // for a developer trying one of its pull requests, that build's. And the feature previews on for this person (SDK 1.7).
            .map((r) => {
              const on = previewsOnFor(r, optIns, updates.ring, at, place ? ruleChain(place) : []);
              const served = servedEntry(previews.get(r.entry.id)?.release.manifest ?? r.entry, kept);
              // Live on the workbench: this developer's own machine's frontend, in place of any build.
              const from = live.of(caller?.id, r.entry.id);
              // Only the kind in force (ADR 0032): a claim the registry doesn't honour never reaches the shell.
              const { category: _asked, ...rest } = served;
              const { category } = kindOf(r.entry, feed);
              return { ...rest, ...(category ? { category } : {}), ...(from ? { entry: from } : {}), maxUpload: uploadLimitOf(r), ...(on.length ? { previewsOn: on } : {}) };
            });
          // AUGUR's own apps' feature previews, at the server's default: on for those who turned them on.
          const platform = platformApps
            .filter((a) => !unbuiltApps.has(a.id))
            .map((a) => {
              const on = a.previews?.length ? previewsOnFor(platformRecord(a), optIns, updates.ring, at) : [];
              return on.length ? { ...a, previewsOn: on } : a;
            });
          const apps = [...platform, ...registered];
          return apps.filter((a) => !a.requiredRole || roles.includes(a.requiredRole));
        },
      );

      /**
       * Every app and whether the caller can use it on the floor they're on, with the reason and who set the rule
       * that decides it: for Auspex, which never hides an app for being out of reach. Apps a role keeps from the
       * caller are listed too, saying which role; only an app whose origin an admin has stopped allowing is left out,
       * since it isn't offered to anyone.
       */
      app.get(
        '/me/apps',
        {
          schema: {
            summary: 'Every app, and whether the caller can use it on their floor, and why',
            description: [
              'For Auspex, which never hides an app for being out of reach. Each app',
              "says whether it's on for the floor the caller is on and why (platform,",
              'approved, set-here, set-above, blocked, not-for-this-kind,',
              'turned-off), the floor whose rule decides it (`by`) and who set that',
              'rule and when. An app a role keeps from the caller is listed with',
              '`requiredRole` and `hasRole: false`. Only the floor the gateway',
              'checked can be asked about.',
            ].join(' '),
            querystring: Type.Object({ workspace: Type.String({ maxLength: 100 }) }),
            response: {
              200: Type.Object(
                {
                  workspace: Type.String(),
                  apps: Type.Array(
                    Type.Object({
                      id: Type.String(),
                      name: Type.String(),
                      icon: Type.Optional(Type.String()),
                      description: Type.Optional(Type.String()),
                      floors: Type.Optional(Type.Array(Type.Enum(['personal', 'team', 'org']))),
                      category: Type.Optional(Type.Enum([...APP_CATEGORIES])),
                      ships: Type.Optional(Type.Boolean()),
                      pillar: Type.Optional(Type.Boolean({ description: 'The old name for `ships`, kept for /v1 readers' })),
                      requiredRole: Type.Optional(Type.String()),
                      hasRole: Type.Optional(Type.Boolean()),
                      state: Type.Object({
                        on: Type.Boolean(),
                        why: Type.Enum(['platform', 'approved', 'set-here', 'set-above', 'blocked', 'not-for-this-kind', 'turned-off']),
                        by: Type.Optional(Type.String({ description: 'The floor whose rule decides it' })),
                        setBy: Type.Optional(Type.String({ description: 'Who set that rule' })),
                        setAt: Type.Optional(Type.String({ format: 'date-time' })),
                      }),
                    }),
                  ),
                },
                { description: "The caller's apps on that floor" },
              ),
              401: refused('No signed-in caller'),
              403: refused('Not the floor the gateway checked'),
              404: refused('No such floor'),
              503: refused("Floors can't be looked up right now"),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to see your apps.' });
          const { workspace } = req.query;
          if (caller.workspace?.id !== workspace) {
            return reply.code(403).send({ error: 'forbidden', message: 'Ask about the floor you’re on, with its X-Workspace-Id.' });
          }
          const place = await placeOf(reply, workspace);
          if (!place) return reply;
          const allowed = await allowedOrigins();
          const rules = await store.rules();
          const platform = platformApps
            .filter((a) => !unbuiltApps.has(a.id))
            .map((a) => ({ id: a.id, name: a.name, icon: a.icon, description: a.description, requiredRole: a.requiredRole, category: categoryOf(a, { ships: false, fromFeed: false }).category, state: { on: true, why: 'platform' } as const }));
          const feed = await feedApps();
          const registered = (await store.records())
            .filter((r) => !entryOriginProblem(r.entry, allowed))
            .map((r) => {
              const state = floorState(r, place, rules);
              const rule = 'by' in state ? rules.find((x) => x.app === r.entry.id && x.workspace === state.by) : undefined;
              return {
                id: r.entry.id, name: r.entry.name, icon: r.entry.icon, description: r.entry.description, requiredRole: r.entry.requiredRole,
                floors: [...floorKindsOf(r.entry)], category: kindOf(r.entry, feed).category,
                // `pillar` is the old name for `ships`, kept for /v1 readers.
                ships: isPillar(r.entry.id) || undefined, pillar: isPillar(r.entry.id) || undefined,
                state: rule ? { ...state, setBy: rule.setBy, setAt: rule.setAt } : state,
              };
            });
          return {
            workspace,
            apps: [...platform, ...registered].map(({ requiredRole, ...a }) => ({
              ...a,
              ...(requiredRole ? { requiredRole, hasRole: caller.roles.includes(requiredRole) } : {}),
            })),
          };
        },
      );

      const isAdmin = (req: FastifyRequest) => callerFromHeaders(req.headers)?.roles.includes('admin') ?? false;

      /** The running previews someone chose, by app id: theirs alone, or everyone's (person id → app id) with no one named. */
      const chosenPreviews = async (person?: string) => {
        const choices = await store.previewChoices(person);
        if (!choices.length) return [];
        const running = await store.runningPreviews();
        return choices.flatMap((c) => {
          const preview = running.find((p) => p.app === c.app && p.pr === c.pr);
          return preview ? [{ person: c.person, preview }] : [];
        });
      };
      const previewsChosenBy = async (person?: string) => new Map(person ? (await chosenPreviews(person)).map(({ preview }) => [preview.app, preview]) : []);

      /** The whole catalogue for admins: every app, on or off, with who registered it and when. */
      app.get(
        '/apps',
        {
          schema: {
            summary: 'The whole catalogue, for admins',
            description: "Every app, AUGUR's own first, whether or not it is turned on.",
            response: {
              200: Type.Array(ref(CatalogueEntry), { description: 'Catalogue entries' }),
              403: refused('Not an admin'),
            },
          },
        },
        async (req, reply) => {
          if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see the whole catalogue.' });
          const platform = platformApps.filter((a) => !unbuiltApps.has(a.id)).map((entry) => ({ ...entry, platform: true, enabled: true }));
          const allowed = await allowedOrigins();
          const kept = await store.frontends();
          const feed = await feedApps();
          return [...platform, ...(await store.records()).map((r) => entryOf(r, allowed, kept, feed))];
        },
      );

      /** An app's kept versions, newest first, and which one the shell is given. */
      app.get(
        '/apps/:id/versions',
        {
          schema: {
            summary: "An app's kept versions, newest first (admins only)",
            params: params('id'),
            response: {
              200: Type.Array(
                Type.Object({
                  version: Type.String(),
                  entry: ref(AppManifestEntry),
                  registeredBy: Type.String(),
                  registeredAt: Type.String({ format: 'date-time' }),
                  serving: Type.Boolean(),
                }),
                { description: 'Kept versions; `serving` marks the one the shell is given' },
              ),
              403: refused('Not an admin'),
              404: refused('No such app'),
            },
          },
        },
        async (req, reply) => {
          if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see an app’s versions.' });
          const record = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!record) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          const kept = await store.frontends(req.params.id);
          return (await store.versions(req.params.id)).map((v) => ({ ...v, entry: servedEntry(v.entry, kept), serving: v.version === record.entry.version }));
        },
      );

      /** Serve one kept version and hold the app there, whatever registers next; or let go and serve the newest. */
      const pin = async (req: FastifyRequest, reply: FastifyReply, id: string, version: string | null) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose an app’s version.' });
        if (platformApps.some((a) => a.id === id) || isPillar(id)) {
          return reply.code(409).send({ error: 'conflict', message: 'Apps that ship with AUGUR change with AUGUR’s own release.' });
        }
        try {
          const changed = await store.pin(id, version);
          if (!changed) return reply.code(404).send({ error: 'not_found', message: `No app "${id}" is registered.` });
          req.log.info({ app: id, version: changed.entry.version, pinned: version !== null, by: caller.id }, version === null ? 'app unpinned' : 'app pinned');
          await record(req, {
            actor: { id: caller.id, kind: 'user' },
            app: 'registry',
            action: version === null ? 'app.unpinned' : 'app.pinned',
            target: id,
            detail: { version: changed.entry.version },
          });
          return entryOf(changed, await allowedOrigins(), await store.frontends(id), await feedApps());
        } catch (err) {
          if (err instanceof UnknownVersionError) return reply.code(404).send({ error: 'not_found', message: err.message });
          if (err instanceof RouteTakenError) return reply.code(409).send({ error: 'conflict', message: err.message });
          throw err;
        }
      };
      const pinned = { ...ref(CatalogueEntry), description: 'The app as it now is' };
      app.put(
        '/apps/:id/pin',
        {
          schema: {
            summary: 'Serve one kept version and hold the app there (admins only)',
            description: [
              'Rolls an app back, or holds it at its current version. Registrations',
              'after this are kept in its history but not served until it is',
              'unpinned. When the version\'s frontend is kept (PUT',
              '/apps/{id}/versions/{version}/frontend), its code is held too, since',
              'the manifest then points at that version\'s own copy; otherwise only',
              'the manifest changes. Audited as app.pinned.',
            ].join(' '),
            params: params('id'),
            body: Type.Object({ version: Type.String({ minLength: 1, maxLength: 64 }) }, { additionalProperties: false }),
            response: {
              200: pinned,
              403: refused('Not an admin'),
              404: refused('No such app, or no such version kept'),
              409: refused('A platform app or one that ships with AUGUR, or another app now has that version\'s route'),
            },
          },
        },
        (req, reply) => pin(req, reply, req.params.id, req.body.version),
      );
      app.delete(
        '/apps/:id/pin',
        {
          schema: {
            summary: 'Let go of a pin and serve the newest version (admins only)',
            description: 'Audited as app.unpinned.',
            params: params('id'),
            response: {
              200: pinned,
              403: refused('Not an admin'),
              404: refused('No such app'),
              409: refused('A platform app or one that ships with AUGUR'),
            },
          },
        },
        (req, reply) => pin(req, reply, req.params.id, null),
      );

      /** Which app or platform service sent this call, if any; undefined when the sign-in service can't say right now. */
      const serviceOf = async (req: FastifyRequest, reply: FastifyReply): Promise<ServiceIdentity | null | undefined> => {
        try {
          return (await identifyService(req.headers, verifyService)) ?? null;
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          void reply.code(503).send({ error: 'unavailable', message: err.message });
          return undefined;
        }
      };

      /** Who may change an app's entry: that app's own service, a platform service, or an admin. */
      const changedBy = async (req: FastifyRequest, reply: FastifyReply, id: string): Promise<NewAuditEntry['actor'] | undefined> => {
        const service = await serviceOf(req, reply);
        if (service === undefined) return undefined;
        if (service?.kind === 'app') {
          if (service.app === id) return { id: service.app, kind: 'service' };
          void reply.code(403).send({ error: 'forbidden', message: `${service.app} can only register itself, not "${id}".` });
          return undefined;
        }
        if (service) return { id: service.name, kind: 'service' };
        const caller = callerFromHeaders(req.headers);
        if (caller?.roles.includes('admin')) return { id: caller.id, kind: 'user' };
        void reply.code(403).send({ error: 'forbidden', message: 'Only an app’s own service or an admin can register apps.' });
        return undefined;
      };

      /**
       * What an app may do on a floor, for the platform's services to check its
       * calls against: the scopes it asks for and an admin has granted, where it
       * is on. Nothing where it is off, on a floor that no longer exists, or
       * anywhere while it is turned off. A call that names no floor is checked
       * on the organisation's, as the gateway does, so an app that is off for
       * the organisation can't act everywhere by naming none (ADR 0007).
       */
      app.get(
        '/apps/:id/grants',
        {
          schema: {
            summary: 'What an app may do on a floor (platform services only)',
            description: [
              "AUGUR's services check an app's calls against this, and keep",
              'each answer for up to 30 seconds. An app is granted the scopes it asks',
              'for that an admin has granted, on floors where it is on (see',
              "/manifest); nothing where it is off, on a floor that doesn't exist, or",
              "anywhere while it is turned off. Without a workspace, on the organisation's",
              'floor, as the gateway checks a call that names none (ADR 0007). With them, the',
              'inbox and notification kinds its manifest declares, which the events service checks against, and the',
              'role its manifest says a person needs, which models checks for an AI app.',
            ].join(' '),
            params: params('id'),
            querystring: Type.Object({ workspace: Type.Optional(Type.String({ maxLength: 100, description: 'The floor the call is for' })) }),
            response: {
              200: Type.Object(
                {
                  app: Type.String(),
                  workspace: Type.Optional(Type.String()),
                  scopes: Type.Array(ref(ScopeSchema)),
                  inboxKinds: Type.Array(Type.String(), { description: "The ids of the inbox kinds the app's manifest declares" }),
                  notificationKinds: Type.Array(Type.String(), { description: "The ids of the notification kinds the app's manifest declares" }),
                  requiredRole: Type.Union([Type.String(), Type.Null()], {
                    description: "The role the app's manifest says a person needs to use it, or null for anyone the floor lets in. Services a person reaches an app through (such as models, for an AI app) check it as the gateway does.",
                  }),
                },
                { description: "The app's grants" },
              ),
              403: refused('Not a platform service'),
              404: refused('No such app is registered'),
              503: refused("Floors, or the sign-in service that checks the caller's token, can't be reached right now"),
            },
          },
        },
        async (req, reply) => {
          const service = await serviceOf(req, reply);
          if (service === undefined) return reply;
          if (service?.kind !== 'platform') return reply.code(403).send({ error: 'forbidden', message: 'Only AUGUR’s own services can read what an app is granted.' });
          const found = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          const { workspace } = req.query;
          let place: FloorPlace | undefined;
          if (!floors) return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up: the registry has no way to reach identity.' });
          try {
            place = await floors(workspace ?? ORG_FLOOR);
          } catch (err) {
            if (!(err instanceof FloorsUnavailable)) throw err;
            return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up right now.' });
          }
          const on = place ? floorState(found, place, await store.rules(found.entry.id)).on : false;
          return {
            app: found.entry.id,
            workspace: workspace ?? place?.id,
            scopes: on ? usableScopes(found) : [],
            inboxKinds: (found.entry.inbox?.kinds ?? []).map((k) => k.id),
            notificationKinds: (found.entry.notifications?.kinds ?? []).map((k) => k.id),
            requiredRole: found.entry.requiredRole ?? null,
          };
        },
      );

      /** The catalogue changed either way; a failed audit write is logged, not turned into a failed request. */
      const record = (req: FastifyRequest, entry: NewAuditEntry, workspace?: string) =>
        audit?.(entry, workspace).catch((err: Error) => req.log.error({ err: err.message, action: entry.action }, 'audit entry not recorded'));

      /** A floor's rule chain for feature previews targeted at floors: undefined for no such floor, null when floors can't be looked up. */
      const chainOf = floors
        ? async (workspace: string) => {
            try {
              const place = await floors(workspace);
              return place && ruleChain(place);
            } catch (err) {
              if (!(err instanceof FloorsUnavailable)) throw err;
              return null;
            }
          }
        : undefined;
      await app.register(featurePreviewRoutes({ store, ring: updates.ring, serviceOf, record, chainOf }));
      await app.register(appRunnerRoutes({ store, live, pillars, updates: appUpdates, ring: updates.ring, allowPrPreviews, sdkVersion: SDK_VERSION, audit: audit && ((entry) => audit(entry)), serviceOf, record, timeZone, now }));
      await app.register(overviewRoutes({ store, updates, appUpdates, timeZone, record, now, reporting }));
      // What this deployment runs, reported to Backstage (ADR 0019).
      const overview = overviewBuilder({ store, updates, appUpdates, timeZone, now });
      const sender = new ReportSender({ reporting, store, overview, fetchImpl: reportFetch, now, log: { info: (m) => app.log.info(m), warn: (m) => app.log.warn(m) } });
      await app.register(reportRoutes({ reporting, store, sender, overview, now }));
      sender.start();
      app.addHook('onClose', async () => sender.stop());
      // Grafana's alerts, told to deployment admins (ADR 0059).
      await app.register(alertRoutes(alerts));

      app.put(
        '/apps/:id',
        {
          schema: {
            summary: 'Register an app, or update it',
            description: [
              "Called by an app's own service on the internal network, signed in as",
              'itself (a bearer token for its Keycloak client app-<id>, audience',
              'platform-services), which may register only its own id; by a platform',
              'service signed in as its own client (platform-<name>); or by an admin',
              'through the gateway.',
              "Unknown fields are refused. AUGUR's own apps (home, admin) and",
              'routes another app already has cannot be taken. Every version is kept',
              '(the last 5, plus a pinned one); an app an admin has pinned keeps',
              'serving its pinned version. An entry that is a full address must be on',
              'an origin an admin has allowed (see /origins); a path is served by the',
              'platform itself and always may.',
            ].join(' '),
            params: params('id'),
            body: ref(AppManifestEntry),
            response: {
              200: { ...ref(AppManifestEntry), description: 'Updated' },
              201: { ...ref(AppManifestEntry), description: 'Registered' },
              400: refused("The manifest is invalid, its id does not match the path, or its entry loads from an origin that isn't allowed"),
              403: refused('Neither the app itself, a platform service nor an admin'),
              409: refused('The id belongs to a platform app, or the route is taken'),
              503: refused("The sign-in service can't be reached to check the app's token"),
            },
          },
        },
        async (req, reply) => {
          const by = await changedBy(req, reply, req.params.id);
          if (!by) return reply;
          const entry = req.body;
          if (entry.id !== req.params.id) return reply.code(400).send({ error: 'bad_request', message: `The manifest is for "${entry.id}", not "${req.params.id}".` });
          const badVersion = versionProblem(entry) ?? surfaceProblem(entry) ?? settingsProblem(entry);
          if (badVersion) return reply.code(400).send({ error: 'bad_request', message: badVersion });
          const warnings = menuWarnings(entry);
          if (warnings.length) req.log.warn({ app: entry.id, warnings }, 'menu breaks the shell principles; accepted');
          const badOrigin = entryOriginProblem(entry, await allowedOrigins());
          if (badOrigin) return reply.code(400).send({ error: 'bad_request', message: badOrigin });
          const conflict = conflictFor(entry, await store.list());
          if (conflict) return reply.code(409).send({ error: 'conflict', message: conflict });
          // A kind the app may not claim is kept and explained to admins, never a reason to refuse it (ADR 0032).
          const { refused } = kindOf(entry, await feedApps());
          if (refused) req.log.warn({ app: entry.id, asked: refused.asked }, 'category not honoured; accepted');
          try {
            const created = await store.put(entry, by.id);
            // An app that ships with AUGUR may do what its release asks: the admin chose the release.
            const asked = (await store.records()).find((r) => r.entry.id === entry.id);
            if (isPillar(entry.id) && asked && awaitingScopes(asked).length) {
              await store.grant(entry.id, entry.scopes ?? []);
              await record(req, { actor: by, app: 'registry', action: 'app.scopes-granted', target: entry.id, detail: { scopes: entry.scopes ?? [], shipsWithAugur: true } });
            }
            const pinned = asked?.pinnedVersion;
            const held = pinned !== undefined && pinned !== entry.version;
            req.log.info({ app: entry.id, version: entry.version, by: by.id, held }, created ? 'app registered' : held ? 'app version kept, pinned elsewhere' : 'app updated');
            await record(req, {
              actor: by,
              app: 'registry',
              action: created ? 'app.registered' : 'app.updated',
              target: entry.id,
              detail: { version: entry.version, ...(held ? { heldAt: pinned } : {}) },
            });
            return reply.code(created ? 201 : 200).send(entry);
          } catch (err) {
            if (err instanceof RouteTakenError) return reply.code(409).send({ error: 'conflict', message: err.message });
            throw err;
          }
        },
      );

      // A frontend arrives as one gzipped tarball (service kit's packFrontend), held in memory while it's checked.
      app.addContentTypeParser('application/gzip', { parseAs: 'buffer', bodyLimit: FRONTEND_LIMITS.bytes + 1024 * 1024 }, (_req, body, done) => done(null, body));

      /**
       * Keeps one version of an app's frontend and serves it at /apps/<id>/<version>_<digest>/: the app's
       * own service gives it before registering that version, or a platform service or an admin does.
       * The same files again (every restart) change nothing. Other files for the same version are a new
       * build of it (a dev build, or a pillar app rebuilt with a newer kit): they take the old build's
       * place, in a folder of their own, so no browser goes on running the build it kept.
       */
      app.put(
        '/apps/:id/versions/:version/frontend',
        {
          schema: {
            summary: "Keep one version of an app's frontend, served at /apps/{id}/{version}_{digest}/",
            description: [
              "The app's own service (or a platform service, or an admin) gives the",
              'built frontend as one gzipped tarball, before registering that version.',
              "From then on the manifest the shell is given points `entry` at that",
              "version's own copy whenever the entry is a file under /apps/{id}/ and",
              'the tarball holds it. The same tarball again answers 200 and changes',
              'nothing. A different one for the same version is a new build of it: it',
              "takes the old build's place, in a folder of its own, so no browser goes",
              'on running the build it kept. At most 2000 files and 50 MB. Audited as',
              'app.frontend-published.',
            ].join(' '),
            params: Type.Object({ id: Type.String(), version: Type.String({ description: "The release the frontend belongs to, its manifest's version" }) }),
            consumes: ['application/gzip'],
            body: Type.Unsafe<Buffer>({ description: 'The built frontend, one gzipped tarball', contentMediaType: 'application/gzip' }),
            response: {
              200: { ...ref(StoredFrontendSchema), description: 'This version already had exactly this frontend' },
              201: { ...ref(StoredFrontendSchema), description: 'Kept' },
              400: refused('Not a semver version, or not a usable tarball (links, odd paths, too big)'),
              403: refused('Another app, or not an admin'),
              409: refused("One of AUGUR's own apps"),
              415: refused('Not sent as application/gzip'),
              501: refused("This deployment doesn't keep frontends by version (FRONTENDS_BUCKET_SECRET isn't set)"),
              503: refused("The sign-in service can't be reached to check the app's token"),
            },
          },
        },
        async (req, reply) => {
        const by = await changedBy(req, reply, req.params.id);
        if (!by) return reply;
        const { id, version } = req.params;
        if (!frontendFiles) return reply.code(501).send({ error: 'not_implemented', message: 'This deployment doesn’t keep apps’ frontends by version (FRONTENDS_BUCKET_SECRET isn’t set).' });
        if (platformApps.some((a) => a.id === id)) return reply.code(409).send({ error: 'conflict', message: `"${id}" is one of AUGUR’s own apps.` });
        if (!semver.valid(version)) return reply.code(400).send({ error: 'bad_request', message: `"${version}" is not a semver version such as 1.2.0.` });
        if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ error: 'unsupported_media_type', message: 'Send the frontend as one gzipped tarball, Content-Type application/gzip.' });
        const digest = frontendDigest(req.body);
        const had = (await store.frontends(id)).find((f) => f.version === version);
        if (had?.digest === digest) return reply.code(200).send(had);
        let files;
        try {
          files = unpackFrontend(req.body);
        } catch (err) {
          if (err instanceof FrontendProblem) return reply.code(400).send({ error: 'bad_request', message: err.message });
          throw err;
        }
        const folder = frontendFolder(version, digest);
        await frontendFiles.put(id, folder, files);
        const stored = await store.putFrontend({ app: id, version, digest, folder, files: files.map((f) => f.path), bytes: files.reduce((n, f) => n + f.data.length, 0), publishedBy: by.id });
        req.log.info({ app: id, version, folder, files: files.length, bytes: stored.bytes, by: by.id, replaced: had?.digest }, had ? 'app frontend rebuilt' : 'app frontend kept');
        await record(req, { actor: by, app: 'registry', action: 'app.frontend-published', target: id, detail: { version, digest, files: files.length, ...(had ? { replaced: had.digest } : {}) } });
        return reply.code(201).send(stored);
      });

      /**
       * Where the gateway sends each app's calls: the upstreams set for apps (by whatever runs them,
       * or an admin), for the gateway itself and admins. Apps without one are wherever APP_UPSTREAMS says.
       */
      app.get(
        '/upstreams',
        {
          schema: {
            summary: "Where each app's service is, for the gateway (and admins)",
            description: [
              'The upstreams set for apps by what runs them, or by an admin. The',
              'gateway asks as itself (its signed caller augur:gateway) and sends',
              '/api/{id}/… there for any app not in its APP_UPSTREAMS. `previews`',
              'names, for each app, the developers who chose one of its pull',
              "requests' previews and where that preview is: the gateway sends",
              'their calls there instead.',
            ].join(' '),
            response: {
              200: Type.Object(
                {
                  apps: strings(),
                  previews: Type.Optional(
                    Type.Unsafe<Record<string, Record<string, string>>>({
                      type: 'object',
                      description: 'App id → person id → upstream',
                      additionalProperties: { type: 'object', additionalProperties: { type: 'string' } },
                    }),
                  ),
                },
                { description: 'Upstreams by app id' },
              ),
              403: refused('Neither the gateway nor an admin'),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!isGatewayCaller(caller ?? undefined) && !caller?.roles.includes('admin')) {
            return reply.code(403).send({ error: 'forbidden', message: 'Only the gateway and admins can see where apps’ services are.' });
          }
          const records = (await store.records()).filter((r) => r.upstream);
          // Developers trying a pull request's build of an app the gateway sends to the app.
          const previews: Record<string, Record<string, string>> = {};
          for (const { person, preview } of await chosenPreviews()) {
            if (records.some((r) => r.entry.id === preview.app)) (previews[preview.app] ??= {})[person] = preview.upstream;
          }
          return { apps: Object.fromEntries(records.map((r) => [r.entry.id, r.upstream!])), previews };
        },
      );

      /** Sets where the gateway reaches an app's service: a platform service that runs it, or an admin. Never the app itself. */
      app.put(
        '/apps/:id/upstream',
        {
          schema: {
            summary: "Say where the gateway reaches an app's service (a platform service or an admin, never the app)",
            description: [
              "http or https, a host and port only, never one of AUGUR's own",
              'parts. null forgets it. Kept when the app registers new versions.',
              'Audited as app.upstream-set or app.upstream-cleared.',
            ].join(' '),
            params: params('id'),
            body: Type.Object({ url: orNull(Type.String({ maxLength: 300 })) }, { additionalProperties: false }),
            response: {
              200: { ...ref(CatalogueEntry), description: 'The app as it now is' },
              400: refused("Not an address an app's service can be at"),
              403: refused('Not a platform service or an admin'),
              404: refused('No such app'),
              409: refused("One of AUGUR's own apps"),
              503: refused("The sign-in service can't be reached to check the caller's token"),
            },
          },
        },
        async (req, reply) => {
          const service = await serviceOf(req, reply);
          if (service === undefined) return reply;
          const caller = callerFromHeaders(req.headers);
          const by: NewAuditEntry['actor'] | undefined =
            service?.kind === 'platform' ? { id: service.name, kind: 'service' } : !service && caller?.roles.includes('admin') ? { id: caller.id, kind: 'user' } : undefined;
          if (!by) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin or the AUGUR service that runs an app can say where it is.' });
          if (platformApps.some((a) => a.id === req.params.id)) return reply.code(409).send({ error: 'conflict', message: `"${req.params.id}" is one of AUGUR’s own apps.` });
          const problem = req.body.url === null ? undefined : upstreamProblem(req.body.url);
          if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
          const url = req.body.url === null ? null : req.body.url.replace(/\/+$/, '');
          const changed = await store.setUpstream(req.params.id, url);
          if (!changed) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          req.log.info({ app: req.params.id, upstream: url, by: by.id }, 'app upstream set');
          await record(req, { actor: by, app: 'registry', action: url ? 'app.upstream-set' : 'app.upstream-cleared', target: req.params.id, detail: url ? { url } : {} });
          return entryOf(changed, await allowedOrigins(), await store.frontends(req.params.id), await feedApps());
        },
      );

      app.patch(
        '/apps/:id',
        {
          schema: {
            summary: 'Turn an app on or off (admins only)',
            description: [
              'An app that is off stays registered, keeps its id and route, and stays off',
              'when its service registers it again; nobody is offered it in the manifest.',
              'Audited as app.enabled or app.disabled.',
            ].join(' '),
            params: params('id'),
            body: Type.Object({ enabled: Type.Boolean() }, { additionalProperties: false }),
            response: {
              200: { ...ref(CatalogueEntry), description: 'The app as it now is' },
              403: refused('Not an admin'),
              404: refused('No such app'),
              409: refused('A platform app, which is always on'),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can turn apps on or off.' });
          const platform = platformApps.find((a) => a.id === req.params.id);
          if (platform) return reply.code(409).send({ error: 'conflict', message: `${platform.name} is part of AUGUR and can’t be turned off.` });
          const before = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!before || !(await store.setEnabled(req.params.id, req.body.enabled))) {
            return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          }
          if (before.enabled !== req.body.enabled) {
            req.log.info({ app: req.params.id, enabled: req.body.enabled, by: caller.id }, req.body.enabled ? 'app turned on' : 'app turned off');
            await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: req.body.enabled ? 'app.enabled' : 'app.disabled', target: req.params.id });
          }
          return entryOf({ ...before, enabled: req.body.enabled }, await allowedOrigins(), await store.frontends(req.params.id), await feedApps());
        },
      );

      /** What each floor says about an app, and whether it's on there, for admins to set it floor by floor. */
      app.get(
        '/apps/:id/floors',
        {
          schema: {
            summary: 'What each floor says about an app (admins)',
            params: params('id'),
            response: {
              200: Type.Array(ref(FloorRuleSchema), { description: "The app's floor rules" }),
              403: refused('Not an admin'),
              404: refused('No such app is registered'),
            },
          },
        },
        async (req, reply) => {
          if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see where an app is on.' });
          if (!(await store.records()).some((r) => r.entry.id === req.params.id)) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          return store.rules(req.params.id);
        },
      );

      /**
       * Sets what one floor says about an app: on, off, blocked (for it and
       * every floor below), or `inherit` to take its rule away. The org and
       * teams only: nobody, admins included, sets anything on someone's own floor.
       */
      app.put(
        '/apps/:id/floors/:workspace',
        {
          schema: {
            summary: 'Set what one floor says about an app (admins)',
            description: [
              'on or off installs the app there or takes it away, carrying on to the',
              'teams below unless carriesOn is false or one of them says otherwise.',
              'blocked is a guardrail: off there and on every floor below, whatever',
              "they say. inherit takes the floor's rule away. Someone's own floor",
              "can't be set; it follows the org. Audited as app.enabled, app.disabled,",
              'app.blocked or app.inherited, with the floor.',
            ].join(' '),
            params: Type.Object({ id: Type.String(), workspace: Type.String({ description: 'The org or a team' }) }),
            body: Type.Object(
              { state: Type.Enum(['on', 'off', 'blocked', 'inherit']), carriesOn: Type.Optional(Type.Boolean({ description: 'true when left out' })) },
              { additionalProperties: false },
            ),
            response: {
              200: Type.Object(
                {
                  rules: Type.Array(ref(FloorRuleSchema)),
                  state: floorStateOf(['turned-off', 'not-for-this-kind', 'blocked', 'set-here', 'set-above', 'approved'], 'The floor whose rule decided it'),
                },
                { description: "The app's rules now, and whether it is on for this floor" },
              ),
              400: refused("Someone's own floor"),
              403: refused('Not an admin'),
              404: refused('No such app or floor'),
              409: refused('A platform app, which is on everywhere'),
              503: refused("Floors can't be looked up right now"),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose where an app is on.' });
          if (platformApps.some((a) => a.id === req.params.id)) return reply.code(409).send({ error: 'conflict', message: 'Built-in apps are on everywhere.' });
          const found = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          const place = await placeOf(reply, req.params.workspace);
          if (!place) return reply;
          if (place.kind === 'personal') return reply.code(400).send({ error: 'bad_request', message: 'Someone’s own floor gets the org’s apps; it can’t be set on its own.' });
          const { state, carriesOn = true } = req.body;
          const changed = state === 'inherit' ? await store.clearRule(found.entry.id, place.id) : await store.setRule({ app: found.entry.id, workspace: place.id, state, carriesOn, setBy: caller.id });
          if (changed) {
            req.log.info({ app: found.entry.id, workspace: place.id, state, by: caller.id }, 'app floor rule set');
            await record(req, {
              actor: { id: caller.id, kind: 'user' },
              app: 'registry',
              action: RULE_ACTIONS[state],
              target: found.entry.id,
              detail: { workspace: place.id, ...(state === 'on' || state === 'off' ? { carriesOn } : {}) },
            }, place.id);
          }
          return { rules: await store.rules(found.entry.id), state: floorState(found, place, await store.rules(found.entry.id)) };
        },
      );

      /** Lets an app use scopes it asks for. An admin grants them once they've seen what a new version wants. */
      app.put(
        '/apps/:id/scopes',
        {
          schema: {
            summary: 'Let an app use these scopes (admins)',
            description: [
              "An app's first registration is granted what it asks for. A later",
              'version that asks for more is served, but gets the extra only once an',
              'admin grants it here. Audited as app.scopes-granted.',
            ].join(' '),
            params: params('id'),
            body: Type.Object({ scopes: Type.Array(ref(ScopeSchema), { uniqueItems: true, maxItems: SCOPES.length }) }, { additionalProperties: false }),
            response: {
              200: { ...ref(CatalogueEntry), description: 'The app as the catalogue now has it' },
              403: refused('Not an admin'),
              404: refused('No such app is registered'),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose what an app may do.' });
          const changed = await store.grant(req.params.id, req.body.scopes);
          if (!changed) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          req.log.info({ app: req.params.id, scopes: req.body.scopes, by: caller.id }, 'app scopes granted');
          await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.scopes-granted', target: req.params.id, detail: { scopes: req.body.scopes } });
          return entryOf(changed, await allowedOrigins(), await store.frontends(req.params.id), await feedApps());
        },
      );

      /** Lowers how much an app may be sent in one request, or with `null` gives it what its manifest asks again. */
      app.put(
        '/apps/:id/upload-limit',
        {
          schema: {
            summary: 'Lower how much an app may be sent in one request (admins)',
            description: [
              "The gateway holds every request to the app's service to its limit:",
              "its manifest's maxUpload (10 MB without one), or the lower number an",
              'admin sets here. `null` goes back to what the manifest asks. An admin',
              'can only lower it. Kept when the app registers new versions. Audited',
              'as app.upload-limit-set.',
            ].join(' '),
            params: params('id'),
            body: UploadLimitBody,
            response: {
              200: { ...ref(CatalogueEntry), description: 'The app as the catalogue now has it' },
              400: refused("More than the app's manifest asks for"),
              403: refused('Not an admin'),
              404: refused('No such app is registered'),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can change how much an app may be sent.' });
          const found = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          const { mb } = req.body;
          if (mb !== null && mb > askedUpload(found)) {
            return reply.code(400).send({ error: 'invalid', message: `${found.entry.name} asks for ${askedUpload(found)} MB at most; an admin can only lower that.` });
          }
          const changed = (await store.limitUploads(req.params.id, mb))!;
          await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.upload-limit-set', target: req.params.id, detail: { mb } });
          return entryOf(changed, await allowedOrigins(), await store.frontends(req.params.id), await feedApps());
        },
      );

      /** The app's own settings and what each is set to: for admins, and for the app's service to work by. */
      app.get(
        '/apps/:id/settings',
        {
          schema: {
            summary: "The app's own settings and the value of each (admins, and the app's own service)",
            description: [
              "Each setting the app's manifest offers, with the value in force: an",
              "admin's, or the setting's default. A value set before the app narrowed",
              "a setting's range is used only while it still fits.",
            ].join(' '),
            params: params('id'),
            response: {
              200: { ...ref(AppSettings), description: 'Its settings' },
              403: refused("Neither an admin nor the app's own service"),
              404: refused('No such app is registered'),
              503: refused("The sign-in service can't be reached to check the caller's token"),
            },
          },
        },
        async (req, reply) => {
          const service = await serviceOf(req, reply);
          if (service === undefined) return reply;
          const own = service?.kind === 'app' && service.app === req.params.id;
          if (!own && !isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin or the app itself can see its settings.' });
          const found = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          return settingsOf(found);
        },
      );

      /** Sets one of an app's settings, or with `null` puts it back to its default. Admins only; audited. */
      app.put(
        '/apps/:id/settings/:setting',
        {
          schema: {
            summary: "Set one of an app's settings (admins)",
            description: '`null` puts it back to its default. Kept when the app registers new versions. Audited as app.setting-changed.',
            params: params('id', 'setting'),
            body: Type.Object({ value: orNull(Type.Integer()) }, { additionalProperties: false }),
            response: {
              200: { ...ref(AppSettings), description: 'Its settings as they now are' },
              400: refused("Outside the setting's min and max"),
              403: refused('Not an admin'),
              404: refused('No such app, or it offers no such setting'),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can change an app’s settings.' });
          const found = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          const setting = found.entry.settings?.find((s) => s.id === req.params.setting);
          if (!setting) return reply.code(404).send({ error: 'not_found', message: `${found.entry.name} has no setting "${req.params.setting}".` });
          const { value } = req.body;
          if (value !== null && (value < setting.min || value > setting.max)) {
            return reply.code(400).send({ error: 'invalid', message: `${setting.label} is ${setting.min} to ${setting.max}${setting.unit ? ` ${setting.unit}` : ''}.` });
          }
          const changed = (await store.setSetting(found.entry.id, setting.id, value, caller.id))!;
          req.log.info({ app: found.entry.id, setting: setting.id, value, by: caller.id }, 'app setting changed');
          await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.setting-changed', target: found.entry.id, detail: { setting: setting.id, label: setting.label, value, ...(setting.unit ? { unit: setting.unit } : {}) } });
          return settingsOf(changed);
        },
      );

      /** Where apps may load from besides the platform itself. Admins choose; every registration is checked against it. */
      app.get(
        '/origins',
        {
          schema: {
            summary: 'Where apps may load from besides AUGUR itself (admins only)',
            response: {
              200: Type.Array(ref(AllowedOrigin), { description: 'Allowed origins' }),
              403: refused('Not an admin'),
            },
          },
        },
        async (req, reply) => {
          if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see where apps may load from.' });
          return store.origins();
        },
      );

      app.post(
        '/origins',
        {
          schema: {
            summary: 'Allow apps to load from an origin (admins only)',
            description: 'HTTPS only, except http://localhost for development. Audited as origin.allowed.',
            body: Type.Object({ origin: Type.String({ minLength: 1, maxLength: 200, examples: ['https://apps.example.org'] }) }, { additionalProperties: false }),
            response: {
              201: { ...ref(AllowedOrigin), description: 'Allowed (also when it already was)' },
              400: refused('Not an HTTPS origin, or has a path'),
              403: refused('Not an admin'),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose where apps may load from.' });
          const parsed = parseOrigin(req.body.origin);
          if ('problem' in parsed) return reply.code(400).send({ error: 'bad_request', message: parsed.problem });
          if (await store.allowOrigin(parsed.origin, caller.id)) {
            req.log.info({ origin: parsed.origin, by: caller.id }, 'origin allowed');
            await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'origin.allowed', target: parsed.origin });
          }
          return reply.code(201).send((await store.origins()).find((o) => o.origin === parsed.origin)!);
        },
      );

      app.delete(
        '/origins/:origin',
        {
          schema: {
            summary: 'Stop allowing an origin (admins only)',
            description: [
              'Apps already registered from it stay in the catalogue, marked blocked,',
              'and are left out of the manifest until it is allowed again. Audited as origin.removed.',
            ].join(' '),
            params: Type.Object({ origin: Type.String({ description: 'The origin, URL-encoded' }) }),
            response: {
              204: empty('Removed'),
              403: refused('Not an admin'),
              404: refused('Not an allowed origin'),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose where apps may load from.' });
          if (!(await store.removeOrigin(req.params.origin))) return reply.code(404).send({ error: 'not_found', message: `${req.params.origin} isn't allowed.` });
          req.log.info({ origin: req.params.origin, by: caller.id }, 'origin removed');
          await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'origin.removed', target: req.params.origin });
          return reply.code(204).send();
        },
      );

      await app.register(platformUpgradeRoutes({ store, updates, pipeline, portalUrl, timeZone, now, serviceOf, record }));


      app.delete(
        '/apps/:id',
        {
          schema: {
            summary: 'Remove an app (admins only)',
            description: 'Audited as app.removed.',
            params: params('id'),
            response: {
              204: empty('Removed'),
              403: refused('Not an admin'),
              404: refused('No such app'),
              409: refused('An app that ships with AUGUR (pillar), which is turned off instead'),
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can remove apps.' });
          const pillar = (await store.records()).find((r) => r.entry.id === req.params.id && isPillar(r.entry.id));
          if (pillar) return reply.code(409).send({ error: 'conflict', message: `${pillar.entry.name} ships with AUGUR and can’t be removed. Turn it off instead.` });
          if (!(await store.remove(req.params.id))) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          req.log.info({ app: req.params.id, by: caller.id }, 'app removed');
          await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.removed', target: req.params.id });
          return reply.code(204).send();
        },
      );
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
