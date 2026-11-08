import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  callerFromHeaders,
  GrantsUnavailable,
  health,
  delegationRefusal,
  identifyService,
  isDelegated,
  packageVersion,
  recordAudit,
  ServiceAuthUnavailable,
  problemDetails,
  serviceFastifyOptions,
  WORKSPACE_HEADERS,
  type Caller,
  type GrantLookup,
  type RequiredRoleLookup,
  type NewAuditEntry,
  type ServiceCredentials,
  type ServiceVerifier,
  signedCallers,
  type CallerCheck,
} from '@augur/service-kit';
import { describeApi } from './contract.ts';
import { ProviderError, type ModelProvider } from './provider.ts';
import { ChatAnswer, ChatRequest, Embeddings, EmbeddingsRequest, ModelsStatus, ref, refused, Settings, SettingsChange, UsageReport } from './schemas.ts';
import type { ModelStore } from './store.ts';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

/** The shell's own agent, in the Agents surface: its calls count under this name. No app can take it. */
export const ASSISTANT = 'assistant';

export interface ModelsOptions {
  store: ModelStore;
  /** The model behind the gateway. Without one, models can't be turned on. */
  provider?: ModelProvider;
  /** Checks apps' and platform services' own sign-in tokens. */
  verifyService?: ServiceVerifier;
  /** What an app is granted on a floor: it needs models:use to call the model. */
  grants?: GrantLookup;
  /** The role an app's manifest says a person needs (registryRequiredRole): someone talking to an AI app's agent must have it. */
  requiredRole?: RequiredRoleLookup;
  /**
   * Where every call and change is recorded, before it happens: a call that
   * can't be recorded isn't made. Without it nothing can be called.
   */
  audit?: (entry: NewAuditEntry, workspace?: string) => Promise<void>;
  now?: () => Date;
  /** Checks the caller the gateway signed (callerCheckFromEnv). Without it `x-user-*` headers are believed as they come, as in local dev. */
  callers?: CallerCheck;
}

/** Records audit entries with the events service, as the model gateway. */
export const auditTo = (eventsUrl: string, credentials: ServiceCredentials) => (entry: NewAuditEntry, workspace?: string) =>
  recordAudit({ eventsUrl, credentials, entry, workspace });

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
export const buildApp = async ({ store, provider, verifyService, grants, requiredRole, audit, now = () => new Date(), callers }: ModelsOptions) => {
  const app = Fastify(serviceFastifyOptions()).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(problemDetails());
  await describeApi(app, `/${API_VERSION}`);
  // Before anything reads the caller: only the gateway's signed word says who is calling.
  app.addHook('onRequest', signedCallers(callers));
  app.get('/healthz', { schema: { hide: true } }, async () => health('models', version, API_VERSION));

  const today = () => now().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(now().getTime() - n * 86_400_000).toISOString().slice(0, 10);

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (plain) => {
      const app = plain.withTypeProvider<TypeBoxTypeProvider>();
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

      /** Whether the person has the role an app needs, as the gateway holds the app's own API to it. Undefined when the reply has been sent. */
      const hasRole = async (req: FastifyRequest, reply: FastifyReply, forApp: string, caller: Caller): Promise<boolean | undefined> => {
        let role: string | null | undefined;
        try {
          if (!requiredRole) throw new GrantsUnavailable('The model gateway has no registry to check roles with.');
          role = await requiredRole(forApp);
          if (role === undefined) throw new GrantsUnavailable('The registry doesn’t say which role the app needs.');
        } catch (err) {
          if (!(err instanceof GrantsUnavailable)) throw err;
          req.log.error({ err: err.message, app: forApp }, 'role check failed');
          void reply.code(503).send({ error: 'unavailable', message: 'Whether you can use this app can’t be checked right now. Try again in a moment.' });
          return undefined;
        }
        if (!role || caller.roles.includes(role)) return true;
        void reply.code(403).send({ error: 'forbidden', message: `${forApp} needs the ${role} role, which an admin can give you.` });
        return false;
      };

      /**
       * An app's service, by its own token, for itself; or a person through the
       * gateway, talking to `agent`: the shell's own, or an AI app's.
       */
      const askerOf = async (req: FastifyRequest, reply: FastifyReply, agent: string | undefined, { people = true } = {}): Promise<Asker | undefined> => {
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
        if (!people) return void reply.code(403).send({ error: 'forbidden', message: 'Only an app’s own service asks for this, as itself.' });
        if (isDelegated(caller)) {
          // An app acting for the person (contract 3) talks to its own agent, within what the delegation carries.
          if (agent && agent !== caller.app) return void reply.code(403).send({ error: 'forbidden', message: `${caller.app} can only talk to its own agent for you, not to "${agent}".` });
          agent = caller.app;
          const refusal = delegationRefusal({ kind: 'app', app: caller.app, person: caller }, 'models:use');
          if (refusal) return void reply.code(403).send({ error: 'forbidden', message: refusal });
        }
        if (!agent) return void reply.code(400).send({ error: 'bad_request', message: 'Name the agent you’re talking to.' });
        if (agent !== ASSISTANT) {
          const ok = await granted(req, reply, agent, caller.workspace?.id);
          if (ok === undefined) return undefined;
          if (!ok) return void reply.code(403).send({ error: 'forbidden', message: `${agent} isn’t granted models:use on this floor.` });
          if (!(await hasRole(req, reply, agent, caller))) return undefined;
        }
        return { app: agent, actor: { id: caller.id, kind: 'user' }, workspace: caller.workspace?.id };
      };

      // Whether the Agents surface should show, for anyone signed in.
      app.get(
        '/status',
        {
          schema: {
            summary: 'Whether models can be used, for anyone signed in (the shell shows Agents when enabled)',
            response: { 200: ModelsStatus, 401: refused('No signed-in caller') },
          },
        },
        async (req, reply) => {
          if (!callerFromHeaders(req.headers)) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
          const { enabled } = await store.settings();
          return { enabled: enabled && !!provider, ready: !!provider };
        },
      );

      app.get(
        '/settings',
        {
          schema: {
            summary: 'How models are used (admins)',
            response: { 200: { ...ref(Settings), description: 'The settings' }, 401: refused('No signed-in caller'), 403: refused('Not an admin') },
          },
        },
        async (req, reply) => {
          if (!admin(req, reply)) return reply;
          return { ...(await store.settings()), ready: !!provider, ...(provider ? { provider: provider.name, model: provider.model, ...(provider.embeddingModel ? { embeddingModel: provider.embeddingModel } : {}) } : {}) };
        },
      );

      app.put(
        '/settings',
        {
          schema: {
            summary: "Turn models on or off, or set each app's calls a day (admins; audited)",
            body: SettingsChange,
            response: {
              200: { ...ref(Settings), description: 'The settings now' },
              400: refused('An invalid change'),
              401: refused('No signed-in caller'),
              403: refused('Not an admin'),
              409: refused('Turning on with no model set up'),
              503: refused("The change can't be recorded in the audit log, so it wasn't made"),
            },
          },
        },
        async (req, reply) => {
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
          return { ...saved, ready: !!provider, ...(provider ? { provider: provider.name, model: provider.model, ...(provider.embeddingModel ? { embeddingModel: provider.embeddingModel } : {}) } : {}) };
        },
      );

      app.get(
        '/usage',
        {
          schema: {
            summary: "Each app's use over the last seven days, newest first (admins)",
            response: { 200: UsageReport, 401: refused('No signed-in caller'), 403: refused('Not an admin') },
          },
        },
        async (req, reply) => {
          if (!admin(req, reply)) return reply;
          const { dailyLimit } = await store.settings();
          return { dailyLimit, days: await store.usage(daysAgo(6)) };
        },
      );

      /**
       * What every call goes through: models on, a model set up, the app's calls for
       * today, and the call recorded before it's made. False when the reply has been sent.
       */
      const mayCall = async (req: FastifyRequest, reply: FastifyReply, asker: Asker, detail: Record<string, unknown>, action = 'model.called'): Promise<boolean> => {
        const settings = await store.settings();
        if (!settings.enabled) return void reply.code(403).send({ error: 'forbidden', message: 'Models are turned off. An admin can turn them on in Admin.' }), false;
        if (!provider) return void reply.code(503).send({ error: 'unavailable', message: 'No model is set up on this server.' }), false;
        if (!audit) return void reply.code(503).send({ error: 'unavailable', message: 'Model calls can’t be recorded, so none are made.' }), false;
        if (!(await store.take(asker.app, today(), settings.dailyLimit))) {
          return void reply.code(429).send({ error: 'limit', message: `${asker.app} has used its ${settings.dailyLimit} model calls for today. More are allowed from midnight UTC.` }), false;
        }
        // What was asked is never recorded, only that it was, by whom and with what.
        try {
          await audit({ actor: asker.actor, app: asker.app, action, detail }, asker.workspace);
        } catch (err) {
          req.log.error({ err: (err as Error).message, app: asker.app }, 'model call not recorded');
          return void reply.code(503).send({ error: 'unavailable', message: 'The call can’t be recorded in the activity log right now, so it wasn’t made.' }), false;
        }
        return true;
      };

      app.post(
        '/chat',
        {
          schema: {
            summary: 'Ask the model',
            body: ref(ChatRequest),
            response: {
              200: { ...ref(ChatAnswer), description: "The model's answer" },
              400: refused("An invalid request, or a person's call without an agent"),
              401: refused('Neither a signed-in person nor a service'),
              403: refused("Models are off, the app isn't granted models:use there, or an app acting for a person named another agent or holds a delegation without models:use"),
              429: refused('The app has used its calls for today'),
              502: refused('The model provider failed or refused; the message says what to check'),
              503: refused("No model is set up, or grants or the audit log can't be reached"),
              504: refused('The model took too long'),
            },
          },
        },
        async (req, reply) => {
          const asker = await askerOf(req, reply, req.body.agent);
          if (!asker) return reply;
          const { messages, tools } = req.body;
          if (!(await mayCall(req, reply, asker, { model: provider?.model, messages: messages.length, ...(tools?.length ? { tools: tools.map((t) => t.name) } : {}) }))) return reply;
          const day = today();
          try {
            const answer = await provider!.chat({ messages, ...(tools?.length ? { tools } : {}) });
            await store.addTokens(asker.app, day, answer.usage.inputTokens, answer.usage.outputTokens);
            req.log.info({ app: asker.app, model: answer.model, ...answer.usage, toolCalls: answer.message.toolCalls?.length ?? 0 }, 'model called');
            return answer;
          } catch (err) {
            if (!(err instanceof ProviderError)) throw err;
            req.log.error({ err: err.message, app: asker.app }, 'model call failed');
            return reply.code(err.status).send({ error: 'provider', message: err.message });
          }
        },
      );

      // Text into vectors, to match by meaning: for apps' services, as themselves. Each request is one call.
      app.post(
        '/embeddings',
        {
          schema: {
            summary: "Turn texts into vectors, to match by meaning (apps' services only, as themselves)",
            body: EmbeddingsRequest,
            response: {
              200: Embeddings,
              400: refused('An invalid request'),
              401: refused('Neither a signed-in person nor a service'),
              403: refused("Models are off, a person asked, or the app isn't granted models:use there"),
              429: refused('The app has used its calls for today'),
              502: refused('The model provider failed or refused; the message says what to check'),
              503: refused("No model or no embedding model is set up, or grants or the audit log can't be reached"),
              504: refused('The model took too long'),
            },
          },
        },
        async (req, reply) => {
          const asker = await askerOf(req, reply, undefined, { people: false });
          if (!asker) return reply;
          if (provider && !provider.embed) {
            return reply.code(503).send({ error: 'unavailable', message: 'No embedding model is set up on this server: set MODEL_EMBEDDING_NAME beside MODEL_API_URL.' });
          }
          if (!(await mayCall(req, reply, asker, { model: provider?.embeddingModel, texts: req.body.input.length }, 'model.embedded'))) return reply;
          try {
            const answer = await provider!.embed!(req.body.input);
            await store.addTokens(asker.app, today(), answer.usage.inputTokens, 0);
            req.log.info({ app: asker.app, model: answer.model, texts: answer.vectors.length }, 'texts embedded');
            return answer;
          } catch (err) {
            if (!(err instanceof ProviderError)) throw err;
            req.log.error({ err: err.message, app: asker.app }, 'embedding failed');
            return reply.code(err.status).send({ error: 'provider', message: err.message });
          }
        },
      );
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
