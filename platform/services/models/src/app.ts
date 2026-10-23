import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  callerFromHeaders,
  GrantsUnavailable,
  health,
  identifyService,
  packageVersion,
  recordAudit,
  ServiceAuthUnavailable,
  serviceLogging,
  WORKSPACE_HEADERS,
  type Caller,
  type GrantLookup,
  type NewAuditEntry,
  type ServiceCredentials,
  type ServiceVerifier,
} from '@augur/service-kit';
import { ProviderError, type ChatRequest, type ModelProvider } from './provider.ts';
import { MemoryModelStore, type ModelSettings, type ModelStore } from './store.ts';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

/** The shell's own agent, in the Agents surface: its calls count under this name. No app can take it. */
export const ASSISTANT = 'assistant';

export interface ModelsOptions {
  store?: ModelStore;
  /** The model behind the gateway. Without one, models can't be turned on. */
  provider?: ModelProvider;
  /** Checks apps' and platform services' own sign-in tokens. */
  verifyService?: ServiceVerifier;
  /** What an app is granted on a floor: it needs models:use to call the model. */
  grants?: GrantLookup;
  /**
   * Where every call and change is recorded, before it happens: a call that
   * can't be recorded isn't made. Without it nothing can be called.
   */
  audit?: (entry: NewAuditEntry, workspace?: string) => Promise<void>;
  now?: () => Date;
}

/** Records audit entries with the events service, as the model gateway. */
export const auditTo = (eventsUrl: string, credentials: ServiceCredentials) => (entry: NewAuditEntry, workspace?: string) =>
  recordAudit({ eventsUrl, credentials, entry, workspace });

const message = {
  type: 'object',
  additionalProperties: false,
  required: ['role', 'content'],
  properties: {
    role: { enum: ['system', 'user', 'assistant', 'tool'] },
    content: { type: 'string', maxLength: 32_000 },
    toolCalls: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'arguments'],
        properties: { id: { type: 'string', minLength: 1, maxLength: 100 }, name: { type: 'string', maxLength: 64 }, arguments: { type: 'object' } },
      },
    },
    toolCallId: { type: 'string', minLength: 1, maxLength: 100 },
  },
} as const;

const chatSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['messages'],
  properties: {
    /** For a person's call: which agent they are talking to. An app's service is known by its token instead. */
    agent: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,39}$' },
    messages: { type: 'array', minItems: 1, maxItems: 100, items: message },
    tools: {
      type: 'array',
      maxItems: 32,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description'],
        properties: {
          name: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,64}$' },
          description: { type: 'string', minLength: 1, maxLength: 1024 },
          parameters: { type: 'object' },
        },
      },
    },
  },
} as const;

const settingsSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: { enabled: { type: 'boolean' }, dailyLimit: { type: 'integer', minimum: 0, maximum: 100_000 } },
} as const;

const workspaceOf = (req: FastifyRequest) => {
  const raw = req.headers[WORKSPACE_HEADERS.id];
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** Who is asking for a model call, and which app it counts against. */
type Asker = { app: string; actor: NewAuditEntry['actor']; workspace?: string };

/**
 * The platform's model gateway. It alone holds the provider's key: apps'
 * services and the shell's Agents ask it, never a provider. It records every
 * call in the audit log before making it, and holds each app to a number of
 * calls a day. It is off until an admin turns it on.
 */
export const buildApp = async ({ store = new MemoryModelStore(), provider, verifyService, grants, audit, now = () => new Date() }: ModelsOptions = {}) => {
  const app = Fastify({ ...serviceLogging(), ajv: { customOptions: { removeAdditional: false } } });
  app.get('/healthz', async () => health('models', version, API_VERSION));

  const today = () => now().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(now().getTime() - n * 86_400_000).toISOString().slice(0, 10);

  await app.register(
    async (app) => {
      const admin = (req: FastifyRequest, reply: FastifyReply): Caller | undefined => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) void reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
        else if (!caller.roles.includes('admin')) void reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see or change how models are used.' });
        else return caller;
        return undefined;
      };

      /** Whether an app may use the model on the floor a call is for. Undefined when the reply has been sent. */
      const granted = async (req: FastifyRequest, reply: FastifyReply, forApp: string, workspace: string | undefined): Promise<boolean | undefined> => {
        try {
          if (!grants) throw new GrantsUnavailable('The model gateway has no registry to check grants with.');
          return (await grants(forApp, workspace)).includes('models:use');
        } catch (err) {
          if (!(err instanceof GrantsUnavailable)) throw err;
          req.log.error({ err: err.message, app: forApp }, 'grant check failed');
          void reply.code(503).send({ error: 'unavailable', message: 'What this app may do can’t be checked right now. Try again in a moment.' });
          return undefined;
        }
      };

      /**
       * An app's service, by its own token, for itself; or a person through the
       * gateway, talking to an agent: the shell's own, or an AI app's.
       */
      const askerOf = async (req: FastifyRequest<{ Body: ChatRequest & { agent?: string } }>, reply: FastifyReply): Promise<Asker | undefined> => {
        const workspace = workspaceOf(req);
        let service;
        try {
          service = await identifyService(req.headers, verifyService);
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          void reply.code(503).send({ error: 'unavailable', message: err.message });
          return undefined;
        }
        if (service) {
          if (service.kind === 'platform') return { app: service.name, actor: { id: service.name, kind: 'service' }, workspace };
          const ok = await granted(req, reply, service.app, workspace);
          if (ok === undefined) return undefined;
          if (!ok) return void reply.code(403).send({ error: 'forbidden', message: `${service.app} isn’t granted models:use${workspace ? ' on that floor' : ''}.` });
          return { app: service.app, actor: { id: service.app, kind: 'service' }, workspace };
        }
        const caller = callerFromHeaders(req.headers);
        if (!caller) return void reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
        const agent = req.body.agent;
        if (!agent) return void reply.code(400).send({ error: 'bad_request', message: 'Name the agent you’re talking to.' });
        if (agent !== ASSISTANT) {
          const ok = await granted(req, reply, agent, caller.workspace?.id);
          if (ok === undefined) return undefined;
          if (!ok) return void reply.code(403).send({ error: 'forbidden', message: `${agent} isn’t granted models:use on this floor.` });
        }
        return { app: agent, actor: { id: caller.id, kind: 'user' }, workspace: caller.workspace?.id };
      };

      // Whether the Agents surface should show, for anyone signed in.
      app.get('/status', async (req, reply) => {
        if (!callerFromHeaders(req.headers)) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
        const { enabled } = await store.settings();
        return { enabled: enabled && !!provider, ready: !!provider };
      });

      app.get('/settings', async (req, reply) => {
        if (!admin(req, reply)) return reply;
        return { ...(await store.settings()), ready: !!provider, ...(provider ? { provider: provider.name, model: provider.model } : {}) };
      });

      app.put<{ Body: Partial<Pick<ModelSettings, 'enabled' | 'dailyLimit'>> }>('/settings', { schema: { body: settingsSchema } }, async (req, reply) => {
        const caller = admin(req, reply);
        if (!caller) return reply;
        const before = await store.settings();
        const next = { enabled: req.body.enabled ?? before.enabled, dailyLimit: req.body.dailyLimit ?? before.dailyLimit };
        if (next.enabled && !before.enabled && !provider) {
          return reply.code(409).send({ error: 'conflict', message: 'There’s no model to turn on: set MODEL_API_URL in the server’s settings first.' });
        }
        const changes: NewAuditEntry[] = [];
        if (next.enabled !== before.enabled) changes.push({ actor: { id: caller.id, kind: 'user' }, app: 'models', action: next.enabled ? 'models.turned-on' : 'models.turned-off' });
        if (next.dailyLimit !== before.dailyLimit)
          changes.push({ actor: { id: caller.id, kind: 'user' }, app: 'models', action: 'models.limit-changed', detail: { from: before.dailyLimit, to: next.dailyLimit } });
        try {
          if (changes.length && !audit) throw new Error('the model gateway has nowhere to record it');
          for (const entry of changes) await audit!(entry);
        } catch (err) {
          req.log.error({ err: (err as Error).message }, 'settings change not recorded');
          return reply.code(503).send({ error: 'unavailable', message: 'The change can’t be recorded in the activity log right now, so it wasn’t made.' });
        }
        const saved = changes.length ? await store.saveSettings(next, caller.id) : before;
        return { ...saved, ready: !!provider, ...(provider ? { provider: provider.name, model: provider.model } : {}) };
      });

      app.get('/usage', async (req, reply) => {
        if (!admin(req, reply)) return reply;
        const { dailyLimit } = await store.settings();
        return { dailyLimit, days: await store.usage(daysAgo(6)) };
      });

      app.post<{ Body: ChatRequest & { agent?: string } }>('/chat', { schema: { body: chatSchema } }, async (req, reply) => {
        const asker = await askerOf(req, reply);
        if (!asker) return reply;
        const settings = await store.settings();
        if (!settings.enabled) return reply.code(403).send({ error: 'forbidden', message: 'Models are turned off. An admin can turn them on in Admin.' });
        if (!provider) return reply.code(503).send({ error: 'unavailable', message: 'No model is set up on this server.' });
        if (!audit) return reply.code(503).send({ error: 'unavailable', message: 'Model calls can’t be recorded, so none are made.' });

        const day = today();
        if (!(await store.take(asker.app, day, settings.dailyLimit))) {
          return reply.code(429).send({ error: 'limit', message: `${asker.app} has used its ${settings.dailyLimit} model calls for today. More are allowed from midnight UTC.` });
        }
        const { messages, tools } = req.body;
        // What was asked is never recorded, only that it was, by whom and with what.
        try {
          await audit(
            {
              actor: asker.actor,
              app: asker.app,
              action: 'model.called',
              detail: { model: provider.model, messages: messages.length, ...(tools?.length ? { tools: tools.map((t) => t.name) } : {}) },
            },
            asker.workspace,
          );
        } catch (err) {
          req.log.error({ err: (err as Error).message, app: asker.app }, 'model call not recorded');
          return reply.code(503).send({ error: 'unavailable', message: 'The call can’t be recorded in the activity log right now, so it wasn’t made.' });
        }
        try {
          const answer = await provider.chat({ messages, ...(tools?.length ? { tools } : {}) });
          await store.addTokens(asker.app, day, answer.usage.inputTokens, answer.usage.outputTokens);
          req.log.info({ app: asker.app, model: answer.model, ...answer.usage, toolCalls: answer.message.toolCalls?.length ?? 0 }, 'model called');
          return answer;
        } catch (err) {
          if (!(err instanceof ProviderError)) throw err;
          req.log.error({ err: err.message, app: asker.app }, 'model call failed');
          return reply.code(err.status).send({ error: 'provider', message: err.message });
        }
      });
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
