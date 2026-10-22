import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { callerFromHeaders, health, packageVersion, serviceFromHeaders, type Caller, type NewAuditEntry, type NewNotification } from '@platform/service-kit';
import { MemoryEventStore, type EventStore, type Notification } from './store.ts';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface EventsOptions {
  store?: EventStore;
  /** The environment's service token: lets services send notifications and write the audit log. */
  serviceToken?: string;
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
export const buildApp = async ({ store = new MemoryEventStore(), serviceToken, heartbeatMs = 25_000 }: EventsOptions = {}) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test', ajv: { customOptions: { removeAdditional: false } } });
  app.get('/healthz', async () => health('events', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (app) => {
      const signedIn = (req: FastifyRequest, reply: FastifyReply): Caller | undefined => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) void reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
        return caller;
      };
      const fromService = (req: FastifyRequest, reply: FastifyReply): string | undefined => {
        const service = serviceFromHeaders(req.headers, serviceToken);
        if (!service) void reply.code(403).send({ error: 'forbidden', message: 'Only platform and app services can do this.' });
        return service;
      };

      // ---- notifications ----

      app.post<{ Body: NewNotification }>('/notifications', { schema: { body: notificationSchema } }, async (req, reply) => {
        const service = fromService(req, reply);
        if (!service) return reply;
        const added = await store.addNotifications(req.body);
        req.log.info({ service, app: req.body.app, count: added.length }, 'notifications sent');
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
        if (!fromService(req, reply)) return reply;
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
