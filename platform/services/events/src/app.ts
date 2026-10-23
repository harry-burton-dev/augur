import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  callerFromHeaders,
  GrantsUnavailable,
  health,
  identifyService,
  packageVersion,
  ServiceAuthUnavailable,
  serviceLogging,
  serviceName,
  WORKSPACE_HEADERS,
  type Caller,
  type GrantLookup,
  type NewAuditEntry,
  type NewNotification,
  type Scope,
  type ServiceIdentity,
  type ServiceVerifier,
} from '@platform/service-kit';
import { MemoryEventStore, type EventStore, type Notification } from './store.ts';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface EventsOptions {
  store?: EventStore;
  /** The environment's service token: lets services send notifications and write the audit log. */
  serviceToken?: string;
  /** Checks apps' and platform services' own sign-in tokens. */
  verifyService?: ServiceVerifier;
  /** What an app is granted on a floor; an app's calls are checked against it. */
  grants?: GrantLookup;
  /** How often an open stream sends a keep-alive, so proxies don't close it. */
  heartbeatMs?: number;
}

const notificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['app', 'recipients', 'level', 'title'],
  properties: {
    app: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' },
    recipients: { type: 'array', minItems: 1, maxItems: 500, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 100 } },
    level: { enum: ['needs', 'info', 'done', 'failed'] },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    detail: { type: 'string', maxLength: 2000 },
    link: { type: 'string', pattern: '^/', maxLength: 500 },
  },
} as const;

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

/** What the Shell receives: a person never sees whom else a notification went to. */
const forCaller = ({ recipient: _, ...n }: Notification) => n;

/**
 * Notifications for the Shell's stream, and the platform's audit log. Services
 * send notifications and audit entries; people read their own notifications,
 * live, and admins read the audit log.
 */
export const buildApp = async ({ store = new MemoryEventStore(), serviceToken, verifyService, grants, heartbeatMs = 25_000 }: EventsOptions = {}) => {
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
      const fromService = async (req: FastifyRequest, reply: FastifyReply, forApp: string, scope: Scope): Promise<ServiceIdentity | undefined> => {
        let service: ServiceIdentity | undefined;
        try {
          service = await identifyService(req.headers, { token: serviceToken, verify: verifyService });
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
        if (service.app !== forApp) {
          void reply.code(403).send({ error: 'forbidden', message: `${service.app} can only send for itself, not for "${forApp}".` });
          return undefined;
        }
        const raw = req.headers[WORKSPACE_HEADERS.id];
        const workspace = typeof raw === 'string' && raw ? decodeURIComponent(raw) : undefined;
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

      // ---- notifications ----

      app.post<{ Body: NewNotification }>('/notifications', { schema: { body: notificationSchema } }, async (req, reply) => {
        const service = await fromService(req, reply, req.body.app, 'notifications:send');
        if (!service) return reply;
        const added = await store.addNotifications(req.body);
        req.log.info({ service: serviceName(service), app: req.body.app, count: added.length }, 'notifications sent');
        return reply.code(202).send({ sent: added.length });
      });

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

      // ---- audit log ----

      app.post<{ Body: NewAuditEntry }>('/audit', { schema: { body: auditSchema } }, async (req, reply) => {
        if (!(await fromService(req, reply, req.body.app, 'audit:write'))) return reply;
        return reply.code(201).send(await store.appendAudit(req.body));
      });

      app.get<{ Querystring: { app?: string; actor?: string; since?: string; until?: string; before?: string; limit?: number } }>(
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
                limit: { type: 'integer', minimum: 1, maximum: 500 },
              },
            },
          },
        },
        async (req, reply) => {
          const caller = signedIn(req, reply);
          if (!caller) return reply;
          if (!caller.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can read the audit log.' });
          const { app: forApp, actor, since, until, before, limit = 100 } = req.query;
          return store.audit({ app: forApp, actor, since, until, before, limit });
        },
      );
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
