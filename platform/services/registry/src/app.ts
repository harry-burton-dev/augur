import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  callerFromHeaders,
  FloorsUnavailable,
  health,
  identifyService,
  packageVersion,
  recordAudit,
  SCOPES,
  ServiceAuthUnavailable,
  serviceLogging,
  type FloorLookup,
  type FloorPlace,
  type NewAuditEntry,
  type Scope,
  type ServiceCredentials,
  type ServiceIdentity,
  type ServiceVerifier,
} from '@augur/service-kit';
import { awaitingScopes, floorState, usableScopes } from './floors.ts';
import { appEntrySchema, conflictFor, entryOriginProblem, parseOrigin, platformApps, surfaceProblem, unbuiltApps, versionProblem, type AppEntry } from './manifest.ts';
import { AUGUR_RELEASE } from './augur-version.ts';
import { UpdateChecker, updatesView } from './updates.ts';
import { MemoryAppStore, RouteTakenError, UnknownVersionError, type AppRecord, type AppStore, type FloorRule } from './store.ts';

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
}

/** Records audit entries with the events service, as the registry. */
export const auditTo = (eventsUrl: string, credentials: ServiceCredentials) => (entry: NewAuditEntry, workspace?: string) =>
  recordAudit({ eventsUrl, credentials, entry, workspace });

/** A registered app as admins see it in the catalogue. */
const catalogueEntry = (r: AppRecord, allowed: string[]) => {
  const blocked = entryOriginProblem(r.entry, allowed);
  return {
    ...r.entry,
    // Registered from an origin no longer allowed: kept, but not offered.
    ...(blocked ? { blocked } : {}),
    platform: false,
    enabled: r.enabled,
    registeredBy: r.registeredBy,
    registeredAt: r.registeredAt,
    updatedAt: r.updatedAt,
    ...(r.pinnedVersion ? { pinnedVersion: r.pinnedVersion } : {}),
    grantedScopes: usableScopes(r),
    ...(awaitingScopes(r).length ? { awaitingScopes: awaitingScopes(r) } : {}),
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
}: RegistryOptions = {}) => {
  // Unknown manifest fields are refused, not dropped: a misspelt requiredRole must not open an app to everyone.
  const app = Fastify({ ...serviceLogging(), ajv: { customOptions: { removeAdditional: false } } });
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
          const registered = (await store.records())
            .filter((r) => r.enabled && !entryOriginProblem(r.entry, allowed) && (!place || floorState(r, place, rules).on))
            .map((r) => r.entry);
          const apps = [...platformApps.filter((a) => !unbuiltApps.has(a.id)), ...registered];
          return apps.filter((a) => !a.requiredRole || roles.includes(a.requiredRole));
        },
      );

      const isAdmin = (req: FastifyRequest) => callerFromHeaders(req.headers)?.roles.includes('admin') ?? false;

      /** The whole catalogue for admins: every app, on or off, with who registered it and when. */
      app.get('/apps', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see the whole catalogue.' });
        const platform = platformApps.filter((a) => !unbuiltApps.has(a.id)).map((entry) => ({ ...entry, platform: true, enabled: true }));
        const allowed = await allowedOrigins();
        return [...platform, ...(await store.records()).map((r) => catalogueEntry(r, allowed))];
      });

      /** An app's kept versions, newest first, and which one the shell is given. */
      app.get<{ Params: { id: string } }>('/apps/:id/versions', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see an app’s versions.' });
        const record = (await store.records()).find((r) => r.entry.id === req.params.id);
        if (!record) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        return (await store.versions(req.params.id)).map((v) => ({ ...v, serving: v.version === record.entry.version }));
      });

      /** Serve one kept version and hold the app there, whatever registers next; or let go and serve the newest. */
      const pin = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, version: string | null) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose an app’s version.' });
        if (platformApps.some((a) => a.id === req.params.id)) return reply.code(409).send({ error: 'conflict', message: 'Built-in apps change with AUGUR’s own release.' });
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
          return catalogueEntry(changed, await allowedOrigins());
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

      app.put<{ Params: { id: string }; Body: AppEntry }>(
        '/apps/:id',
        { schema: { body: appEntrySchema } },
        async (req, reply) => {
          const by = await changedBy(req, reply);
          if (!by) return reply;
          const entry = req.body;
          if (entry.id !== req.params.id) return reply.code(400).send({ error: 'bad_request', message: `The manifest is for "${entry.id}", not "${req.params.id}".` });
          const badVersion = versionProblem(entry) ?? surfaceProblem(entry);
          if (badVersion) return reply.code(400).send({ error: 'bad_request', message: badVersion });
          const badOrigin = entryOriginProblem(entry, await allowedOrigins());
          if (badOrigin) return reply.code(400).send({ error: 'bad_request', message: badOrigin });
          const conflict = conflictFor(entry, await store.list());
          if (conflict) return reply.code(409).send({ error: 'conflict', message: conflict });
          try {
            const created = await store.put(entry, by.id);
            const pinned = (await store.records()).find((r) => r.entry.id === entry.id)?.pinnedVersion;
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
          return catalogueEntry({ ...before, enabled: req.body.enabled }, await allowedOrigins());
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
          return catalogueEntry(changed, await allowedOrigins());
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
        return updatesView({ checker: updates, apps: await store.records() });
      });

      /** Checks the release feed now rather than waiting for the daily check. */
      app.post('/platform/updates/check', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can check for updates.' });
        await updates.check();
        const view = updatesView({ checker: updates, apps: await store.records() });
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

      app.delete<{ Params: { id: string } }>('/apps/:id', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can remove apps.' });
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
