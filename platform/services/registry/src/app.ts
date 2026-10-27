import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
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
  SCOPES,
  ServiceAuthUnavailable,
  serviceLogging,
  signedInRecently,
  type FloorLookup,
  type FloorPlace,
  type NewAuditEntry,
  type Scope,
  type ServiceCredentials,
  type ServiceIdentity,
  type ServiceVerifier,
  signedCallers,
  type CallerCheck,
} from '@augur/service-kit';
import { SDK_VERSION } from '@augur/mfe-sdk';
import { appRunnerRoutes } from './app-runner.ts';
import { AppUpdateChecker } from './app-updates.ts';
import { awaitingScopes, floorState, usableScopes } from './floors.ts';
import {
  appEntrySchema,
  conflictFor,
  DEFAULT_UPLOAD_MB,
  entryOriginProblem,
  MAX_UPLOAD_MB,
  menuWarnings,
  parseOrigin,
  platformApps,
  settingsProblem,
  surfaceProblem,
  unbuiltApps,
  versionProblem,
  type AppEntry,
} from './manifest.ts';
import { AUGUR_RELEASE } from './augur-version.ts';
import { UpdateChecker, updatesView } from './updates.ts';
import { servedEntry, type FrontendFiles } from './frontends.ts';
import { upstreamProblem } from './upstreams.ts';
import semver from 'semver';
import { randomUUID } from 'node:crypto';
import {
  MemoryAppStore,
  RouteTakenError,
  UnknownVersionError,
  UPGRADE_STEPS,
  type AppRecord,
  type AppStore,
  type FloorRule,
  type StoredFrontend,
  type Upgrade,
  type UpgradeOutcome,
  type UpgradeStepState,
} from './store.ts';

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
  /** The app feed, for the app runner's installs and updates (Admin → Apps). Without one nothing is offered. */
  appUpdates?: AppUpdateChecker;
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

const catalogueEntry = (r: AppRecord, allowed: string[], pillar: boolean) => {
  const blocked = entryOriginProblem(r.entry, allowed);
  return {
    ...r.entry,
    // Registered from an origin no longer allowed: kept, but not offered.
    ...(blocked ? { blocked } : {}),
    platform: false,
    // Ships with AUGUR: its version comes with the release, and it's turned off rather than removed.
    ...(pillar ? { pillar: true } : {}),
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

/** How recently an admin must have entered their password to start an upgrade. */
export const UPGRADE_SIGN_IN_MS = 10 * 60 * 1000;
/** A finished upgrade stays on the Updates page this long. */
const UPGRADE_SHOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** The platform service that applies upgrades on a Compose deployment (its Keycloak client is platform-updater). */
const UPDATER = 'updater';

const OUTCOME_ACTIONS: Record<UpgradeOutcome, string> = { done: 'platform.upgraded', 'rolled-back': 'platform.upgrade-rolled-back', failed: 'platform.upgrade-failed' };

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
}: RegistryOptions = {}) => {
  const isPillar = (id: string) => pillars.includes(id);
  const entryOf = (r: AppRecord, allowed: string[], kept: StoredFrontend[]) => catalogueEntry({ ...r, entry: servedEntry(r.entry, kept) }, allowed, isPillar(r.entry.id));
  // Unknown manifest fields are refused, not dropped: a misspelt requiredRole must not open an app to everyone.
  const app = Fastify({ ...serviceLogging(), ajv: { customOptions: { removeAdditional: false } } });
  // Before anything reads the caller: only the gateway's signed word says who is calling.
  app.addHook('onRequest', signedCallers(callers));
  app.get('/healthz', async () => health('registry', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (app) => {
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
      app.get<{ Querystring: { workspace?: string } }>(
        '/manifest',
        { schema: { querystring: { type: 'object', properties: { workspace: { type: 'string', maxLength: 100 } } } } },
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
          const registered = (await store.records())
            .filter((r) => r.enabled && !entryOriginProblem(r.entry, allowed) && (!place || floorState(r, place, rules).on))
            // The limit the gateway holds requests to the app's service to (SDK 1.3), and the version's own copy of its code:
            // for a developer trying one of its pull requests, that build's.
            .map((r) => ({ ...servedEntry(previews.get(r.entry.id)?.release.manifest ?? r.entry, kept), maxUpload: uploadLimitOf(r) }));
          const apps = [...platformApps.filter((a) => !unbuiltApps.has(a.id)), ...registered];
          return apps.filter((a) => !a.requiredRole || roles.includes(a.requiredRole));
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
      app.get('/apps', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see the whole catalogue.' });
        const platform = platformApps.filter((a) => !unbuiltApps.has(a.id)).map((entry) => ({ ...entry, platform: true, enabled: true }));
        const allowed = await allowedOrigins();
        const kept = await store.frontends();
        return [...platform, ...(await store.records()).map((r) => entryOf(r, allowed, kept))];
      });

      /** An app's kept versions, newest first, and which one the shell is given. */
      app.get<{ Params: { id: string } }>('/apps/:id/versions', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see an app’s versions.' });
        const record = (await store.records()).find((r) => r.entry.id === req.params.id);
        if (!record) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        const kept = await store.frontends(req.params.id);
        return (await store.versions(req.params.id)).map((v) => ({ ...v, entry: servedEntry(v.entry, kept), serving: v.version === record.entry.version }));
      });

      /** Serve one kept version and hold the app there, whatever registers next; or let go and serve the newest. */
      const pin = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, version: string | null) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose an app’s version.' });
        if (platformApps.some((a) => a.id === req.params.id) || isPillar(req.params.id)) {
          return reply.code(409).send({ error: 'conflict', message: 'Apps that ship with AUGUR change with AUGUR’s own release.' });
        }
        try {
          const changed = await store.pin(req.params.id, version);
          if (!changed) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          req.log.info({ app: req.params.id, version: changed.entry.version, pinned: version !== null, by: caller.id }, version === null ? 'app unpinned' : 'app pinned');
          await record(req, {
            actor: { id: caller.id, kind: 'user' },
            app: 'registry',
            action: version === null ? 'app.unpinned' : 'app.pinned',
            target: req.params.id,
            detail: { version: changed.entry.version },
          });
          return entryOf(changed, await allowedOrigins(), await store.frontends(req.params.id));
        } catch (err) {
          if (err instanceof UnknownVersionError) return reply.code(404).send({ error: 'not_found', message: err.message });
          if (err instanceof RouteTakenError) return reply.code(409).send({ error: 'conflict', message: err.message });
          throw err;
        }
      };
      app.put<{ Params: { id: string }; Body: { version: string } }>(
        '/apps/:id/pin',
        { schema: { body: { type: 'object', additionalProperties: false, required: ['version'], properties: { version: { type: 'string', minLength: 1, maxLength: 64 } } } } },
        (req, reply) => pin(req, reply, req.body.version),
      );
      app.delete<{ Params: { id: string } }>('/apps/:id/pin', (req, reply) => pin(req, reply, null));

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
      const changedBy = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<NewAuditEntry['actor'] | undefined> => {
        const service = await serviceOf(req, reply);
        if (service === undefined) return undefined;
        if (service?.kind === 'app') {
          if (service.app === req.params.id) return { id: service.app, kind: 'service' };
          void reply.code(403).send({ error: 'forbidden', message: `${service.app} can only register itself, not "${req.params.id}".` });
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
       * anywhere while it is turned off.
       */
      app.get<{ Params: { id: string }; Querystring: { workspace?: string } }>(
        '/apps/:id/grants',
        { schema: { querystring: { type: 'object', properties: { workspace: { type: 'string', maxLength: 100 } } } } },
        async (req, reply) => {
          const service = await serviceOf(req, reply);
          if (service === undefined) return reply;
          if (service?.kind !== 'platform') return reply.code(403).send({ error: 'forbidden', message: 'Only the platform’s own services can read what an app is granted.' });
          const found = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          const { workspace } = req.query;
          if (!workspace) return { app: found.entry.id, scopes: found.enabled ? usableScopes(found) : [] };
          let place: FloorPlace | undefined;
          if (!floors) return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up: the registry has no way to reach identity.' });
          try {
            place = await floors(workspace);
          } catch (err) {
            if (!(err instanceof FloorsUnavailable)) throw err;
            return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up right now.' });
          }
          const on = place ? floorState(found, place, await store.rules(found.entry.id)).on : false;
          return { app: found.entry.id, workspace, scopes: on ? usableScopes(found) : [] };
        },
      );

      /** The catalogue changed either way; a failed audit write is logged, not turned into a failed request. */
      const record = (req: FastifyRequest, entry: NewAuditEntry, workspace?: string) =>
        audit?.(entry, workspace).catch((err: Error) => req.log.error({ err: err.message, action: entry.action }, 'audit entry not recorded'));

      await app.register(appRunnerRoutes({ store, pillars, updates: appUpdates, sdkVersion: SDK_VERSION, audit: audit && ((entry) => audit(entry)), serviceOf, record }));

      app.put<{ Params: { id: string }; Body: AppEntry }>(
        '/apps/:id',
        { schema: { body: appEntrySchema } },
        async (req, reply) => {
          const by = await changedBy(req, reply);
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
       * Keeps one version of an app's frontend and serves it at /apps/<id>/<version>/: the app's own
       * service gives it before registering that version, or a platform service or an admin does.
       * A version's frontend never changes: the same files again is fine, other files are refused.
       */
      app.put<{ Params: { id: string; version: string }; Body: Buffer }>('/apps/:id/versions/:version/frontend', async (req, reply) => {
        const by = await changedBy(req, reply);
        if (!by) return reply;
        const { id, version } = req.params;
        if (!frontendFiles) return reply.code(501).send({ error: 'not_implemented', message: 'This deployment doesn’t keep apps’ frontends by version (FRONTENDS_BUCKET_SECRET isn’t set).' });
        if (platformApps.some((a) => a.id === id)) return reply.code(409).send({ error: 'conflict', message: `"${id}" is one of the platform’s own apps.` });
        if (!semver.valid(version)) return reply.code(400).send({ error: 'bad_request', message: `"${version}" is not a semver version such as 1.2.0.` });
        if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ error: 'unsupported_media_type', message: 'Send the frontend as one gzipped tarball, Content-Type application/gzip.' });
        const digest = frontendDigest(req.body);
        const had = (await store.frontends(id)).find((f) => f.version === version);
        if (had) {
          if (had.digest === digest) return reply.code(200).send(had);
          return reply.code(409).send({ error: 'conflict', message: `${id} ${version} already has a frontend, and a version’s frontend never changes. Release a new version.` });
        }
        let files;
        try {
          files = unpackFrontend(req.body);
        } catch (err) {
          if (err instanceof FrontendProblem) return reply.code(400).send({ error: 'bad_request', message: err.message });
          throw err;
        }
        await frontendFiles.put(id, version, files);
        const stored = await store.putFrontend({ app: id, version, digest, files: files.map((f) => f.path), bytes: files.reduce((n, f) => n + f.data.length, 0), publishedBy: by.id });
        req.log.info({ app: id, version, files: files.length, bytes: stored.bytes, by: by.id }, 'app frontend kept');
        await record(req, { actor: by, app: 'registry', action: 'app.frontend-published', target: id, detail: { version, digest, files: files.length } });
        return reply.code(201).send(stored);
      });

      /**
       * Where the gateway sends each app's calls: the upstreams set for apps (by whatever runs them,
       * or an admin), for the gateway itself and admins. Apps without one are wherever APP_UPSTREAMS says.
       */
      app.get('/upstreams', async (req, reply) => {
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
        return { apps: Object.fromEntries(records.map((r) => [r.entry.id, r.upstream])), previews };
      });

      /** Sets where the gateway reaches an app's service: a platform service that runs it, or an admin. Never the app itself. */
      app.put<{ Params: { id: string }; Body: { url: string | null } }>(
        '/apps/:id/upstream',
        { schema: { body: { type: 'object', additionalProperties: false, required: ['url'], properties: { url: { type: ['string', 'null'], maxLength: 300 } } } } },
        async (req, reply) => {
          const service = await serviceOf(req, reply);
          if (service === undefined) return reply;
          const caller = callerFromHeaders(req.headers);
          const by: NewAuditEntry['actor'] | undefined =
            service?.kind === 'platform' ? { id: service.name, kind: 'service' } : !service && caller?.roles.includes('admin') ? { id: caller.id, kind: 'user' } : undefined;
          if (!by) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin or the platform service that runs an app can say where it is.' });
          if (platformApps.some((a) => a.id === req.params.id)) return reply.code(409).send({ error: 'conflict', message: `"${req.params.id}" is one of the platform’s own apps.` });
          const problem = req.body.url === null ? undefined : upstreamProblem(req.body.url);
          if (problem) return reply.code(400).send({ error: 'bad_request', message: problem });
          const url = req.body.url === null ? null : req.body.url.replace(/\/+$/, '');
          const changed = await store.setUpstream(req.params.id, url);
          if (!changed) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          req.log.info({ app: req.params.id, upstream: url, by: by.id }, 'app upstream set');
          await record(req, { actor: by, app: 'registry', action: url ? 'app.upstream-set' : 'app.upstream-cleared', target: req.params.id, detail: url ? { url } : {} });
          return entryOf(changed, await allowedOrigins(), await store.frontends(req.params.id));
        },
      );

      app.patch<{ Params: { id: string }; Body: { enabled: boolean } }>(
        '/apps/:id',
        { schema: { body: { type: 'object', additionalProperties: false, required: ['enabled'], properties: { enabled: { type: 'boolean' } } } } },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can turn apps on or off.' });
          const platform = platformApps.find((a) => a.id === req.params.id);
          if (platform) return reply.code(409).send({ error: 'conflict', message: `${platform.name} is part of the platform and can’t be turned off.` });
          const before = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!before || !(await store.setEnabled(req.params.id, req.body.enabled))) {
            return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          }
          if (before.enabled !== req.body.enabled) {
            req.log.info({ app: req.params.id, enabled: req.body.enabled, by: caller.id }, req.body.enabled ? 'app turned on' : 'app turned off');
            await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: req.body.enabled ? 'app.enabled' : 'app.disabled', target: req.params.id });
          }
          return entryOf({ ...before, enabled: req.body.enabled }, await allowedOrigins(), await store.frontends(req.params.id));
        },
      );

      /** What each floor says about an app, and whether it's on there, for admins to set it floor by floor. */
      app.get<{ Params: { id: string } }>('/apps/:id/floors', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see where an app is on.' });
        if (!(await store.records()).some((r) => r.entry.id === req.params.id)) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        return store.rules(req.params.id);
      });

      /**
       * Sets what one floor says about an app: on, off, blocked (for it and
       * every floor below), or `inherit` to take its rule away. The org and
       * teams only: nobody, admins included, sets anything on someone's own floor.
       */
      app.put<{ Params: { id: string; workspace: string }; Body: { state: FloorRule['state'] | 'inherit'; carriesOn?: boolean } }>(
        '/apps/:id/floors/:workspace',
        {
          schema: {
            body: {
              type: 'object',
              additionalProperties: false,
              required: ['state'],
              properties: { state: { enum: ['on', 'off', 'blocked', 'inherit'] }, carriesOn: { type: 'boolean' } },
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
      app.put<{ Params: { id: string }; Body: { scopes: Scope[] } }>(
        '/apps/:id/scopes',
        {
          schema: {
            body: {
              type: 'object',
              additionalProperties: false,
              required: ['scopes'],
              properties: { scopes: { type: 'array', uniqueItems: true, maxItems: SCOPES.length, items: { enum: [...SCOPES] } } },
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
          return entryOf(changed, await allowedOrigins(), await store.frontends(req.params.id));
        },
      );

      /** Lowers how much an app may be sent in one request, or with `null` gives it what its manifest asks again. */
      app.put<{ Params: { id: string }; Body: { mb: number | null } }>(
        '/apps/:id/upload-limit',
        {
          schema: {
            body: {
              type: 'object',
              additionalProperties: false,
              required: ['mb'],
              properties: { mb: { anyOf: [{ type: 'integer', minimum: 1, maximum: MAX_UPLOAD_MB }, { type: 'null' }] } },
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
          return entryOf(changed, await allowedOrigins(), await store.frontends(req.params.id));
        },
      );

      /** The app's own settings and what each is set to: for admins, and for the app's service to work by. */
      app.get<{ Params: { id: string } }>('/apps/:id/settings', async (req, reply) => {
        const service = await serviceOf(req, reply);
        if (service === undefined) return reply;
        const own = service?.kind === 'app' && service.app === req.params.id;
        if (!own && !isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin or the app itself can see its settings.' });
        const found = (await store.records()).find((r) => r.entry.id === req.params.id);
        if (!found) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        return settingsOf(found);
      });

      /** Sets one of an app's settings, or with `null` puts it back to its default. Admins only; audited. */
      app.put<{ Params: { id: string; setting: string }; Body: { value: number | null } }>(
        '/apps/:id/settings/:setting',
        {
          schema: {
            body: { type: 'object', additionalProperties: false, required: ['value'], properties: { value: { type: ['integer', 'null'] } } },
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
      app.get('/origins', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see where apps may load from.' });
        return store.origins();
      });

      app.post<{ Body: { origin: string } }>(
        '/origins',
        { schema: { body: { type: 'object', additionalProperties: false, required: ['origin'], properties: { origin: { type: 'string', minLength: 1, maxLength: 200 } } } } },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose where apps may load from.' });
          const parsed = parseOrigin(req.body.origin);
          if ('problem' in parsed) return reply.code(400).send({ error: 'bad_request', message: parsed.problem });
          if (await store.allowOrigin(parsed.origin, caller.id)) {
            req.log.info({ origin: parsed.origin, by: caller.id }, 'origin allowed');
            await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'origin.allowed', target: parsed.origin });
          }
          return reply.code(201).send((await store.origins()).find((o) => o.origin === parsed.origin));
        },
      );

      app.delete<{ Params: { origin: string } }>('/origins/:origin', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose where apps may load from.' });
        if (!(await store.removeOrigin(req.params.origin))) return reply.code(404).send({ error: 'not_found', message: `${req.params.origin} isn't allowed.` });
        req.log.info({ origin: req.params.origin, by: caller.id }, 'origin removed');
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'origin.removed', target: req.params.origin });
        return reply.code(204).send();
      });

      /**
       * Whether a newer AUGUR release is out, and what upgrading to it needs first. Read-only: the
       * registry never restarts anything; the deployment's updater (or a person) does.
       */
      app.get('/platform/updates', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see what updates are out.' });
        return updatesPage();
      });

      /** Checks the release feed now rather than waiting for the daily check. */
      app.post('/platform/updates/check', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can check for updates.' });
        await updates.check();
        const view = await updatesPage();
        req.log.info({ by: caller.id, available: view.available?.version, problem: view.problem }, 'updates checked');
        await record(req, {
          actor: { id: caller.id, kind: 'user' },
          app: 'registry',
          action: 'platform.updates-checked',
          target: view.running.version,
          detail: { ...(view.available ? { available: view.available.version } : {}), ...(view.problem ? { problem: view.problem } : {}) },
        });
        return view;
      });

      /** When the deployment's updater last asked what to do; it lives only as long as this process. */
      let updaterSeenAt: string | undefined;
      /** Settings an admin entered for the upgrade they asked for, until it ends. */
      let upgradeSettings: { id: string; settings: Record<string, string> } | undefined;

      /** The Updates page: the feed against the running release, and the upgrade asked for, while it matters. */
      const updatesPage = async () => {
        const view = updatesView({ checker: updates, apps: await store.records() });
        const upgrade = await store.upgrade();
        const shown = upgrade && (!upgrade.finishedAt || Date.now() - Date.parse(upgrade.finishedAt) < UPGRADE_SHOWN_MS);
        return { ...view, ...(shown ? { upgrade } : {}), ...(updaterSeenAt ? { updaterSeenAt } : {}) };
      };

      /**
       * Asks the deployment's updater to move to `version`, which must be the release Updates says
       * is next. Needs an admin who entered their password in the last few minutes. Nothing
       * restarts here: the updater picks it up and reports each step.
       */
      app.put<{ Body: { version: string; settings?: Record<string, string> } }>(
        '/platform/upgrade',
        {
          schema: {
            body: {
              type: 'object',
              additionalProperties: false,
              required: ['version'],
              properties: {
                version: { type: 'string', minLength: 1, maxLength: 64 },
                // New settings for .env, entered on the Updates page: one line each.
                settings: { type: 'object', maxProperties: 50, propertyNames: { pattern: '^[A-Z][A-Z0-9_]{0,63}$' }, additionalProperties: { type: 'string', maxLength: 4096, pattern: '^[^\\r\\n]*$' } },
              },
            },
          },
        },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can upgrade AUGUR.' });
          if (!signedInRecently(caller, UPGRADE_SIGN_IN_MS)) {
            return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to upgrade. It’s asked for anything this drastic.' });
          }
          const view = updatesView({ checker: updates, apps: await store.records() });
          if (view.next !== req.body.version) {
            return reply.code(409).send({ error: 'conflict', message: view.next ? `Upgrade to ${view.next} next, not ${req.body.version}.` : `There’s no release to upgrade to from ${view.running.version} right now.` });
          }
          const manifest = updates.result.releases.find((r) => r.version === view.next)?.manifest;
          const images = manifest?.images ?? {};
          if (!Object.keys(images).length) return reply.code(409).send({ error: 'conflict', message: `AUGUR ${view.next}’s release file names no images, so it can’t be applied.` });
          const settings = Object.fromEntries(Object.entries(req.body.settings ?? {}).filter(([, value]) => value !== ''));
          const unknown = Object.keys(settings).filter((key) => key === 'PLATFORM_VERSION' || !manifest?.settings?.all.includes(key));
          if (unknown.length) return reply.code(400).send({ error: 'bad_request', message: `AUGUR ${view.next} has no setting ${unknown.join(', ')}.` });
          const id = randomUUID();
          if (!(await store.requestUpgrade({ id, from: view.running.version, version: view.next, images, requestedBy: caller.id }))) {
            return reply.code(409).send({ error: 'conflict', message: 'An upgrade is already waiting or under way.' });
          }
          // Kept in memory only, for the updater to write to .env: never stored, and only their names audited.
          upgradeSettings = Object.keys(settings).length ? { id, settings } : undefined;
          req.log.info({ by: caller.id, from: view.running.version, to: view.next, settings: Object.keys(settings) }, 'upgrade requested');
          await record(req, {
            actor: { id: caller.id, kind: 'user' },
            app: 'registry',
            action: 'platform.upgrade-requested',
            target: view.next,
            detail: { from: view.running.version, ...(Object.keys(settings).length ? { settings: Object.keys(settings) } : {}) },
          });
          return reply.code(202).send(await updatesPage());
        },
      );

      /** Takes back an upgrade the updater hasn't started. One under way can't be stopped halfway. */
      app.delete('/platform/upgrade', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can upgrade AUGUR.' });
        const upgrade = await store.upgrade();
        if (upgrade?.state === 'running') return reply.code(409).send({ error: 'conflict', message: 'It has started, so it finishes or rolls back by itself.' });
        if (!upgrade || !(await store.cancelUpgrade(upgrade.id))) return reply.code(404).send({ error: 'not_found', message: 'No upgrade is waiting.' });
        upgradeSettings = undefined;
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'platform.upgrade-cancelled', target: upgrade.version });
        return updatesPage();
      });

      /** Only the deployment's own updater may read the target and report on it. */
      const isUpdater = async (req: FastifyRequest, reply: FastifyReply) => {
        const service = await serviceOf(req, reply);
        if (service === undefined) return false;
        if (service?.kind === 'platform' && service.name === UPDATER) return true;
        void reply.code(403).send({ error: 'forbidden', message: 'Only the deployment’s updater can do this.' });
        return false;
      };

      /**
       * What the updater should run: the open upgrade, by digest, or nothing (204). With it, what the
       * release file says the updater checks against: each part's version, the settings it needs
       * and its deploy files. Those come from the feed, so they're missing when it can't be read.
       */
      app.get('/platform/upgrade/target', async (req, reply) => {
        if (!(await isUpdater(req, reply))) return reply;
        updaterSeenAt = new Date().toISOString();
        const upgrade = await store.upgrade();
        if (upgrade?.state !== 'requested' && upgrade?.state !== 'running') return reply.code(204).send();
        const { id, from, version, images, state } = upgrade;
        const manifest = updates.result.releases.find((r) => r.version === version)?.manifest;
        return {
          id,
          from,
          version,
          images,
          state,
          ...(upgradeSettings?.id === id ? { settings: upgradeSettings.settings } : {}),
          ...(manifest
            ? {
                parts: Object.fromEntries(Object.entries(manifest.parts).map(([name, part]) => [name, part.version])),
                required: manifest.settings?.required ?? [],
                ...(manifest.deploy ? { deploy: manifest.deploy } : {}),
              }
            : {}),
        };
      });

      /** One step of the open upgrade, from the updater; with `outcome`, how it ended. */
      app.post<{ Body: Omit<UpgradeStepState, 'at'> & { id: string; outcome?: UpgradeOutcome } }>(
        '/platform/upgrade/progress',
        {
          schema: {
            body: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'step', 'state'],
              properties: {
                id: { type: 'string', maxLength: 64 },
                step: { enum: [...UPGRADE_STEPS] },
                state: { enum: ['running', 'done', 'failed'] },
                message: { type: 'string', maxLength: 2000 },
                outcome: { enum: ['done', 'rolled-back', 'failed'] },
              },
            },
          },
        },
        async (req, reply) => {
          if (!(await isUpdater(req, reply))) return reply;
          const { id, outcome, message, ...step } = req.body;
          const upgrade: Upgrade | undefined = await store.progressUpgrade(id, { ...step, ...(message ? { message } : {}) }, outcome ? { state: outcome, ...(message ? { message } : {}) } : undefined);
          if (!upgrade) return reply.code(404).send({ error: 'not_found', message: 'That isn’t the upgrade under way.' });
          if (outcome && upgradeSettings?.id === id) upgradeSettings = undefined;
          req.log.info({ upgrade: id, step: step.step, state: step.state, outcome }, 'upgrade progress');
          if (outcome) {
            await record(req, {
              actor: { id: UPDATER, kind: 'service' },
              app: 'registry',
              action: OUTCOME_ACTIONS[outcome],
              target: upgrade.version,
              detail: { from: upgrade.from, requestedBy: upgrade.requestedBy, ...(message ? { message } : {}) },
            });
          }
          return upgrade;
        },
      );

      app.delete<{ Params: { id: string } }>('/apps/:id', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can remove apps.' });
        const pillar = (await store.records()).find((r) => r.entry.id === req.params.id && isPillar(r.entry.id));
        if (pillar) return reply.code(409).send({ error: 'conflict', message: `${pillar.entry.name} ships with AUGUR and can’t be removed. Turn it off instead.` });
        if (!(await store.remove(req.params.id))) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        req.log.info({ app: req.params.id, by: caller.id }, 'app removed');
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.removed', target: req.params.id });
        return reply.code(204).send();
      });
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
