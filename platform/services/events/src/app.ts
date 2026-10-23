import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  callerFromHeaders,
  FloorsUnavailable,
  GrantsUnavailable,
  health,
  identifyService,
  packageVersion,
  ServiceAuthUnavailable,
  serviceLogging,
  serviceName,
  WORKSPACE_HEADERS,
  type Caller,
  type FloorLookup,
  type GrantLookup,
  type MemberLookup,
  type NewAuditEntry,
  type NewNotification,
  type Scope,
  type ServiceIdentity,
  type ServiceVerifier,
} from '@augur/service-kit';
import { MemoryEventStore, type EventFloor, type EventStore, type NewDomainEvent, type Notification } from './store.ts';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface EventsOptions {
  store?: EventStore;
  /** Checks apps' and platform services' own sign-in tokens: only services send notifications and write the audit log. */
  verifyService?: ServiceVerifier;
  /** What an app is granted on a floor; an app's calls are checked against it. */
  grants?: GrantLookup;
  /** Where a floor sits, from identity: notifications and audit entries record their floor's path. */
  floors?: FloorLookup;
  /** Who is on a team now, from identity, for team notices. */
  members?: MemberLookup;
  /** How often an open stream sends a keep-alive, so proxies don't close it. */
  heartbeatMs?: number;
}

const notificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['app', 'recipients', 'level', 'title'],
  properties: {
    app: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' },
    recipients: { type: 'array', maxItems: 500, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 100 } },
    toTeam: { type: 'boolean' },
    level: { enum: ['needs', 'info', 'done', 'failed'] },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    detail: { type: 'string', maxLength: 2000 },
    link: { type: 'string', pattern: '^/', maxLength: 500 },
    actions: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'intent'],
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 30 },
          intent: {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
            properties: { type: { type: 'string', pattern: '^[a-z][a-z0-9.-]*$', maxLength: 80 }, payload: {} },
          },
        },
      },
    },
  },
} as const;

/** An action's payload is the app's own; it only has to stay small, since each notification travels whole to every open stream. */
const ACTION_PAYLOAD_BYTES = 1024;

const auditSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['actor', 'app', 'action'],
  properties: {
    actor: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'kind'],
      properties: { id: { type: 'string', minLength: 1, maxLength: 100 }, kind: { enum: ['user', 'service'] } },
    },
    app: { type: 'string', minLength: 1, maxLength: 40 },
    action: { type: 'string', pattern: '^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)+$', maxLength: 80 },
    target: { type: 'string', maxLength: 200 },
    detail: { type: 'object', maxProperties: 50 },
  },
} as const;

/** A topic: the publisher's id, then what happened, dotted: "folio.document.published". */
const TOPIC = '^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)+$';
/** Each event carries ids and a little context; anything bigger is fetched from the publisher's API. */
const EVENT_PAYLOAD_BYTES = 16 * 1024;

const publishSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'id', 'payload'],
        properties: {
          topic: { type: 'string', pattern: TOPIC, maxLength: 120 },
          id: { type: 'string', minLength: 1, maxLength: 100 },
          workspace: { type: 'string', minLength: 1, maxLength: 100 },
          payload: {},
        },
      },
    },
  },
} as const;

type PublishBody = { events: { topic: string; id: string; workspace?: string; payload: unknown }[] };

/**
 * The platform's own domain events, published as identity and the registry record
 * the change in the audit log, so the two can't disagree. Keyed by "<service> <action>".
 */
const PLATFORM_EVENTS: Record<string, { topic: string; payload: (e: NewAuditEntry) => Record<string, unknown> }> = {
  'identity person.disabled': { topic: 'platform.person.disabled', payload: (e) => ({ person: e.target }) },
  'identity person.enabled': { topic: 'platform.person.enabled', payload: (e) => ({ person: e.target }) },
  'identity department.created': { topic: 'platform.team.created', payload: (e) => ({ team: e.target, name: e.detail?.name }) },
  'identity department.renamed': { topic: 'platform.team.renamed', payload: (e) => ({ team: e.target, name: e.detail?.to }) },
  'identity department.member-added': { topic: 'platform.team.member-added', payload: (e) => ({ team: e.target, person: e.detail?.person }) },
  'identity department.member-removed': { topic: 'platform.team.member-removed', payload: (e) => ({ team: e.target, person: e.detail?.person }) },
  'registry app.disabled': { topic: 'platform.app.turned-off', payload: (e) => ({ app: e.target }) },
  'registry app.enabled': { topic: 'platform.app.turned-on', payload: (e) => ({ app: e.target }) },
  'registry app.removed': { topic: 'platform.app.removed', payload: (e) => ({ app: e.target }) },
};

/** The floor a service call names in X-Workspace-Id, URI-decoded; a value that won't decode is kept as sent, and fails as an unknown floor. */
const workspaceOf = (req: FastifyRequest) => {
  const raw = req.headers[WORKSPACE_HEADERS.id];
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** What the Shell receives: a person never sees whom else a notification went to. */
const forCaller = ({ recipient: _, ...n }: Notification) => n;

/**
 * Notifications for the Shell's stream, and the platform's audit log. Services
 * send notifications and audit entries; people read their own notifications,
 * live, and admins read the audit log.
 */
export const buildApp = async ({ store = new MemoryEventStore(), verifyService, grants, floors, members, heartbeatMs = 25_000 }: EventsOptions = {}) => {
  const app = Fastify({ ...serviceLogging(), ajv: { customOptions: { removeAdditional: false } } });
  app.get('/healthz', async () => health('events', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (app) => {
      const signedIn = (req: FastifyRequest, reply: FastifyReply): Caller | undefined => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) void reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
        return caller;
      };
      /**
       * The service sending this, when it may: a platform service always; an
       * app only for itself, and only with the scope on the floor it names.
       */
      const fromService = async (req: FastifyRequest, reply: FastifyReply, forApp: string | undefined, scope: Scope): Promise<ServiceIdentity | undefined> => {
        let service: ServiceIdentity | undefined;
        try {
          service = await identifyService(req.headers, verifyService);
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          void reply.code(503).send({ error: 'unavailable', message: err.message });
          return undefined;
        }
        if (!service) {
          void reply.code(403).send({ error: 'forbidden', message: 'Only platform and app services can do this.' });
          return undefined;
        }
        if (service.kind === 'platform') return service;
        if (forApp !== undefined && service.app !== forApp) {
          void reply.code(403).send({ error: 'forbidden', message: `${service.app} can only send for itself, not for "${forApp}".` });
          return undefined;
        }
        const workspace = workspaceOf(req);
        try {
          if (!grants) throw new GrantsUnavailable('The events service has no registry to check grants with.');
          if (!(await grants(service.app, workspace)).includes(scope)) {
            void reply.code(403).send({ error: 'forbidden', message: `${service.app} isn’t granted ${scope}${workspace ? ' on that floor' : ''}.` });
            return undefined;
          }
        } catch (err) {
          if (!(err instanceof GrantsUnavailable)) throw err;
          req.log.error({ err: err.message, app: service.app }, 'grant check failed');
          void reply.code(503).send({ error: 'unavailable', message: 'What this app may do can’t be checked right now. Try again in a moment.' });
          return undefined;
        }
        return service;
      };

      /**
       * The floor a service call names, with its path as it stands now; null
       * for none. Undefined when the reply has been sent: an unknown floor, or
       * identity out of reach.
       */
      const floorOf = async (req: FastifyRequest, reply: FastifyReply): Promise<(EventFloor & { kind: string }) | null | undefined> => {
        const id = workspaceOf(req);
        if (!id) return null;
        try {
          if (!floors) throw new FloorsUnavailable('The events service has no way to reach identity.');
          const place = await floors(id);
          if (place) return { id: place.id, path: place.path, kind: place.kind };
          void reply.code(400).send({ error: 'bad_request', message: 'There is no such floor.' });
        } catch (err) {
          if (!(err instanceof FloorsUnavailable)) throw err;
          req.log.error({ err: err.message }, 'floor lookup failed');
          void reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up right now. Try again in a moment.' });
        }
        return undefined;
      };

      // ---- notifications ----

      app.post<{ Body: NewNotification }>('/notifications', { schema: { body: notificationSchema } }, async (req, reply) => {
        const service = await fromService(req, reply, req.body.app, 'notifications:send');
        if (!service) return reply;
        const floor = await floorOf(req, reply);
        if (floor === undefined) return reply;
        const { toTeam, ...notification } = req.body;
        const big = notification.actions?.find((a) => a.intent.payload !== undefined && Buffer.byteLength(JSON.stringify(a.intent.payload)) > ACTION_PAYLOAD_BYTES);
        if (big) return reply.code(400).send({ error: 'bad_request', message: `The payload of “${big.label}” is over ${ACTION_PAYLOAD_BYTES} bytes. Send an id and let the app look the rest up.` });
        if (!toTeam && !notification.recipients.length) return reply.code(400).send({ error: 'bad_request', message: 'Name the recipients, or send to the team.' });
        if (toTeam) {
          if (notification.recipients.length) return reply.code(400).send({ error: 'bad_request', message: 'Send to the team or to recipients, not both.' });
          if (floor?.kind !== 'team') return reply.code(400).send({ error: 'bad_request', message: 'Team notices go to the team the call’s floor names.' });
          if (!(await store.teamNotices(floor.id))) return reply.code(403).send({ error: 'forbidden', message: 'That team hasn’t turned team notices on.' });
          try {
            // Who is on the team is asked as it's sent, never remembered: someone who has left isn't told.
            if (!members) throw new FloorsUnavailable('The events service has no way to reach identity.');
            notification.recipients = await members(floor.id);
          } catch (err) {
            if (!(err instanceof FloorsUnavailable)) throw err;
            return reply.code(503).send({ error: 'unavailable', message: 'Who is on the team can’t be checked right now.' });
          }
        }
        const added = notification.recipients.length ? await store.addNotifications(notification, floor ? { id: floor.id, path: floor.path } : undefined) : [];
        req.log.info({ service: serviceName(service), app: req.body.app, count: added.length, workspace: floor?.id, team: !!toTeam }, 'notifications sent');
        return reply.code(202).send({ sent: added.length });
      });

      /** Who may change a team's settings: an admin, or a lead standing on that team (as the gateway checked). */
      const leadsOrAdmin = (caller: Caller, workspace: string) => caller.roles.includes('admin') || (caller.workspace?.id === workspace && caller.workspace.role === 'lead');

      // Team notices are off until a team's lead (or an admin) turns them on.
      app.get<{ Params: { workspace: string } }>('/team-notices/:workspace', async (req, reply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        if (!leadsOrAdmin(caller, req.params.workspace)) return reply.code(403).send({ error: 'forbidden', message: 'Only the team’s leads or an admin can see this.' });
        return { workspace: req.params.workspace, on: await store.teamNotices(req.params.workspace) };
      });

      app.put<{ Params: { workspace: string }; Body: { on: boolean } }>(
        '/team-notices/:workspace',
        { schema: { body: { type: 'object', additionalProperties: false, required: ['on'], properties: { on: { type: 'boolean' } } } } },
        async (req, reply) => {
          const caller = signedIn(req, reply);
          if (!caller) return reply;
          if (!leadsOrAdmin(caller, req.params.workspace)) return reply.code(403).send({ error: 'forbidden', message: 'Only the team’s leads or an admin can turn team notices on or off.' });
          const before = await store.teamNotices(req.params.workspace);
          await store.setTeamNotices(req.params.workspace, req.body.on, caller.id);
          if (before !== req.body.on) {
            const floor = floors ? await floors(req.params.workspace).catch(() => undefined) : undefined;
            await store.appendAudit(
              { actor: { id: caller.id, kind: 'user' }, app: 'events', action: req.body.on ? 'team-notices.on' : 'team-notices.off', target: req.params.workspace },
              floor ? { id: floor.id, path: floor.path } : { id: req.params.workspace, path: [req.params.workspace] },
            );
          }
          return { workspace: req.params.workspace, on: req.body.on };
        },
      );

      app.get('/notifications', async (req, reply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        return (await store.unread(caller.id, 50)).map(forCaller);
      });

      const setRead = (read: boolean) => async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        if (!(await store.setRead(caller.id, req.params.id, read))) return reply.code(404).send({ error: 'not_found', message: 'You have no such notification.' });
        return reply.code(204).send();
      };
      app.post('/notifications/:id/read', setRead(true));
      app.delete('/notifications/:id/read', setRead(false));

      // Server-sent events: each new notification for the caller, as it happens.
      app.get('/notifications/stream', async (req, reply) => {
        const caller = signedIn(req, reply);
        if (!caller) return reply;
        reply.hijack();
        const res = reply.raw;
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        res.write(': connected\n\n');
        const unsubscribe = store.subscribe((n) => {
          if (n.recipient === caller.id) res.write(`event: notification\ndata: ${JSON.stringify(forCaller(n))}\n\n`);
        });
        const heartbeat = setInterval(() => res.write(': still here\n\n'), heartbeatMs);
        req.raw.on('close', () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
      });

      // ---- domain events: what services tell each other ----

      // A service publishes on its own topics only: an app on "<its id>.*", platform services on "platform.*".
      app.post<{ Body: PublishBody }>('/domain-events', { schema: { body: publishSchema } }, async (req, reply) => {
        const owner = req.body.events[0].topic.split('.')[0];
        const stray = req.body.events.find((e) => !e.topic.startsWith(`${owner}.`));
        if (stray) return reply.code(400).send({ error: 'bad_request', message: `Every event in one call is on the same publisher's topics; "${stray.topic}" isn't under "${owner}.".` });
        const big = req.body.events.find((e) => Buffer.byteLength(JSON.stringify(e.payload ?? null)) > EVENT_PAYLOAD_BYTES);
        if (big) return reply.code(400).send({ error: 'bad_request', message: `The payload of event ${big.id} is over ${EVENT_PAYLOAD_BYTES} bytes. Send ids and let followers ask for the rest.` });
        const service = await fromService(req, reply, owner === 'platform' ? undefined : owner, 'events:publish');
        if (!service) return reply;
        if ((service.kind === 'platform') !== (owner === 'platform')) {
          return reply.code(403).send({ error: 'forbidden', message: service.kind === 'platform' ? 'Platform services publish on "platform." topics.' : '"platform." topics belong to the platform.' });
        }
        const places = new Map<string, EventFloor>();
        for (const id of new Set(req.body.events.flatMap((e) => (e.workspace ? [e.workspace] : [])))) {
          try {
            if (!floors) throw new FloorsUnavailable('The events service has no way to reach identity.');
            const place = await floors(id);
            if (!place) return reply.code(400).send({ error: 'bad_request', message: `There is no floor ${id}.` });
            places.set(id, { id: place.id, path: place.path });
          } catch (err) {
            if (!(err instanceof FloorsUnavailable)) throw err;
            return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be looked up right now. Try again in a moment.' });
          }
        }
        const events: NewDomainEvent[] = req.body.events.map((e) => ({ topic: e.topic, id: e.id, payload: e.payload, floor: e.workspace ? places.get(e.workspace) : undefined }));
        const result = await store.publish(serviceName(service), events);
        req.log.info({ service: serviceName(service), ...result }, 'domain events published');
        return reply.code(202).send(result);
      });

      // Followers read in seq order from where they left off, and keep their own place: at least once, in order.
      app.get<{ Querystring: { topics: string; after?: string; limit?: number } }>(
        '/domain-events',
        {
          schema: {
            querystring: {
              type: 'object',
              required: ['topics'],
              properties: {
                topics: { type: 'string', minLength: 1, maxLength: 2000 },
                after: { type: 'string', pattern: '^[0-9]+$', maxLength: 19 },
                limit: { type: 'integer', minimum: 1, maximum: 500 },
              },
            },
          },
        },
        async (req, reply) => {
          const topics = req.query.topics.split(',').map((t) => t.trim()).filter(Boolean);
          const bad = topics.find((t) => !new RegExp(TOPIC).test(t.endsWith('.*') ? `${t.slice(0, -2)}.x` : t));
          if (bad) return reply.code(400).send({ error: 'bad_request', message: `"${bad}" is not a topic, or a family of topics such as "folio.*".` });
          if (!(await fromService(req, reply, undefined, 'events:subscribe'))) return reply;
          const limit = req.query.limit ?? 100;
          const events = await store.readEvents({ topics, after: req.query.after, limit });
          return { events, next: events.at(-1)?.seq ?? req.query.after ?? '0' };
        },
      );

      // ---- audit log ----

      app.post<{ Body: NewAuditEntry }>('/audit', { schema: { body: auditSchema } }, async (req, reply) => {
        const service = await fromService(req, reply, req.body.app, 'audit:write');
        if (!service) return reply;
        const floor = await floorOf(req, reply);
        if (floor === undefined) return reply;
        const place = floor ? { id: floor.id, path: floor.path } : undefined;
        const entry = await store.appendAudit(req.body, place);
        const platformEvent = service.kind === 'platform' ? PLATFORM_EVENTS[`${req.body.app} ${req.body.action}`] : undefined;
        if (platformEvent) {
          await store.publish(req.body.app, [{ topic: platformEvent.topic, id: `audit-${entry.id}`, payload: platformEvent.payload(req.body), floor: place }]);
        }
        return reply.code(201).send(entry);
      });

      app.get<{ Querystring: { app?: string; actor?: string; since?: string; until?: string; before?: string; workspace?: string; limit?: number } }>(
        '/audit',
        {
          schema: {
            querystring: {
              type: 'object',
              properties: {
                app: { type: 'string' },
                actor: { type: 'string' },
                since: { type: 'string', format: 'date-time' },
                until: { type: 'string', format: 'date-time' },
                before: { type: 'string', pattern: '^[0-9]+$', maxLength: 19 },
                workspace: { type: 'string', maxLength: 100 },
                limit: { type: 'integer', minimum: 1, maximum: 500 },
              },
            },
          },
        },
        async (req, reply) => {
          const caller = signedIn(req, reply);
          if (!caller) return reply;
          const { app: forApp, actor, since, until, before, workspace, limit = 100 } = req.query;
          // Admins read the whole log; a lead reads their own floor's, and the floors below it.
          if (!caller.roles.includes('admin') && !(workspace && leadsOrAdmin(caller, workspace))) {
            return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can read the whole audit log; a lead can read their own floor’s.' });
          }
          return store.audit({ app: forApp, actor, since, until, before, workspace, limit });
        },
      );
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
