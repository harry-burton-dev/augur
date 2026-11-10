import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  callerFromHeaders,
  health,
  identifyService,
  isGatewayCaller,
  packageVersion,
  problemDetails,
  sendProblem,
  serviceFastifyOptions,
  signedCallers,
  type CallerCheck,
  type NewAuditEntry,
  type ServiceVerifier,
} from '@augur/service-kit';
import { relationsOf, type AuthorizationModel, type CheckKey, type Consistency, type OpenFga } from './openfga.ts';
import type { ProjectionRun } from './projection.ts';
import { grantRoutes, MemoryGrantStore, type GrantStore } from './grants.ts';
import { MemorySessionStore, sessionRoutes, type PersonaQuestions, type SessionLimits, type SessionStore } from './sessions.ts';
import { Decision, Decisions, Evaluation, Evaluations, ResourceResults, ResourceSearch } from './schemas.ts';

class OrgUnknown extends Error {}

/** The major version of the evaluation API, as AuthZEN names it: /access/v1. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface PermissionsOptions {
  engine: OpenFga;
  /** The store and model ids this release answers from (ensureStore and ensureModel, at start). */
  store: string;
  modelId: string;
  /** The model itself, to refuse a question about a type or relation it doesn't have before OpenFGA sees it. */
  model: AuthorizationModel;
  /** Checks platform services' own tokens. */
  verifyService?: ServiceVerifier;
  /** Checks the caller the gateway signed (callerCheckFromEnv). */
  callers?: CallerCheck;
  /** How the copy of identity's floors and positions last went, for Status (projection.ts). */
  projection?: () => ProjectionRun | undefined;
  /** The org's id, once identity has been asked: `org:this` means it, since a caller rarely knows it. */
  org?: () => string | undefined;
  /** Who is acting as which admin persona (sessions.ts). In memory without one, as in tests. */
  sessions?: SessionStore;
  /** How long a persona session may last (PERSONA_*_MINUTES). */
  sessionLimits?: SessionLimits;
  /** Roles made in AUGUR and the grants ledger (grants.ts). In memory without one, as in tests. */
  grants?: GrantStore;
  /** Where starting and ending a persona session, and every role and grant, is recorded. */
  audit?: (entry: NewAuditEntry) => Promise<void>;
  now?: () => Date;
}

/** The id that means this deployment, or its org, so callers needn't know the org's id (`deployment:this` is the model's own). */
export const THIS = 'this';

/**
 * Which checks skip OpenFGA's caches (ADR 0085, D8): anything a persona asks, anything about the deployment
 * or a role, and sharing. Those are where a revoke must land at once; the rest may be up to the cache's
 * limit behind.
 */
export const consistencyFor = (key: CheckKey): Consistency =>
  key.user.startsWith('persona:') || key.object.startsWith('deployment:') || key.object.startsWith('role:') || key.relation === 'can_share' || key.relation === 'can_assign'
    ? 'HIGHER_CONSISTENCY'
    : 'MINIMIZE_LATENCY';

/**
 * AUGUR's permissions service (ADR 0085): it answers whether a subject may do something to a resource, from
 * the relationships OpenFGA holds. Only the gateway and AUGUR's own services may ask; a person never calls
 * it directly. When OpenFGA can't answer, the answer is a refusal that says so (D9), never a yes.
 */
export const buildApp = async ({ engine, store, modelId, model, verifyService, callers, projection, org = () => undefined, sessions = new MemorySessionStore(), grants = new MemoryGrantStore(), sessionLimits, audit, now = () => new Date() }: PermissionsOptions) => {
  const app = Fastify(serviceFastifyOptions()).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(problemDetails());
  app.addHook('onRequest', signedCallers(callers));

  const relations = relationsOf(model);

  app.get('/healthz', async (_req, reply) => {
    if (!(await engine.healthy())) return sendProblem(reply, 503, 'unavailable', 'OpenFGA isn’t answering, so permissions can’t be checked.');
    const copied = projection?.();
    return { ...health('permissions', version, API_VERSION), model: modelId, ...(copied ? { projection: copied } : {}) };
  });

  /** Only the gateway, signing for whoever it checked, and AUGUR's own services may ask. */
  const mayAsk = async (req: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    if (isGatewayCaller(callerFromHeaders(req.headers))) return true;
    const service = await identifyService(req.headers, verifyService);
    if (service?.kind === 'platform') return true;
    sendProblem(reply, 403, 'forbidden', 'Only the gateway and AUGUR’s own services can ask the permissions service.');
    return false;
  };

  /** The check OpenFGA is asked, or why the question can't be asked of this model. */
  const keyOf = (e: Evaluation): CheckKey | string | OrgUnknown => {
    if (!relations.has(e.subject.type)) return `The model has no type ${e.subject.type}.`;
    const of = relations.get(e.resource.type);
    if (!of) return `The model has no type ${e.resource.type}.`;
    if (!of.has(e.action.name)) return `${e.resource.type} has no ${e.action.name} in the model.`;
    let id = e.resource.id;
    if (e.resource.type === 'org' && id === THIS) {
      const known = org();
      if (!known) return new OrgUnknown('The org isn’t known yet: floors haven’t been copied from identity.');
      id = known;
    }
    return { user: `${e.subject.type}:${e.subject.id}`, relation: e.action.name, object: `${e.resource.type}:${id}` };
  };

  /**
   * What OpenFGA's conditions see. Only the time, and it is this service's clock: a caller can't send a
   * time, or anything a grant's condition compares, to make a grant that has ended work again.
   */
  const contextNow = () => ({ current_time: now().toISOString() });

  const unavailable = (reply: FastifyReply, err: unknown) => {
    reply.log.warn({ err }, 'a check could not be answered');
    return sendProblem(reply, 503, 'unavailable', 'Permissions can’t be checked right now. Nothing is allowed until they can. A deployment admin can see why on Status.');
  };

  /** What persona sessions need to know from OpenFGA, always fresh: a persona taken away stops at once. */
  const questions: PersonaQuestions = {
    held: async (person) =>
      (await engine.listObjects(store, modelId, { user: `person:${person}`, relation: 'holder', type: 'persona' }, contextNow(), 'HIGHER_CONSISTENCY')).map((o) => o.slice('persona:'.length)),
    powers: async (persona) => {
      const known = org();
      const keys: CheckKey[] = [{ user: `persona:${persona}`, relation: 'admin', object: 'deployment:this' }];
      if (known) keys.push({ user: `persona:${persona}`, relation: 'admin', object: `org:${known}` });
      const answers = await engine.batchCheck(store, modelId, keys, contextNow(), 'HIGHER_CONSISTENCY');
      const failed = answers.find((a) => 'error' in a);
      if (failed) throw new Error('error' in failed ? failed.error : 'unknown');
      const allowed = answers.map((a) => 'allowed' in a && a.allowed);
      return { deploymentAdmin: allowed[0] === true, orgAdmin: allowed[1] === true };
    },
  };
  await app.register(
    grantRoutes({
      grants,
      engine: {
        check: (key) => engine.check(store, modelId, key, contextNow(), 'HIGHER_CONSISTENCY'),
        write: (writes, deletes) => engine.write(store, modelId, writes, deletes),
      },
      org,
      ...(audit ? { audit } : {}),
      now,
    }),
  );
  await app.register(sessionRoutes({ sessions, questions, ...(sessionLimits ? { limits: sessionLimits } : {}), mayAsk, ...(audit ? { audit } : {}), now }));

  await app.register(
    async (plain) => {
      const access = plain.withTypeProvider<TypeBoxTypeProvider>();

      access.post(
        '/evaluation',
        { schema: { summary: 'May this subject do this to that resource?', body: Evaluation, response: { 200: Decision } } },
        async (req, reply) => {
          if (!(await mayAsk(req, reply))) return reply;
          const key = keyOf(req.body);
          if (key instanceof OrgUnknown) return unavailable(reply, key);
          if (typeof key === 'string') return sendProblem(reply, 400, 'invalid', key);
          try {
            return { decision: await engine.check(store, modelId, key, contextNow(), consistencyFor(key)) };
          } catch (err) {
            return unavailable(reply, err);
          }
        },
      );

      access.post(
        '/evaluations',
        { schema: { summary: 'Several evaluations at once, in the order asked.', body: Evaluations, response: { 200: Decisions } } },
        async (req, reply) => {
          if (!(await mayAsk(req, reply))) return reply;
          const { evaluations, options, ...defaults } = req.body;
          const keys: CheckKey[] = [];
          for (const [i, partial] of evaluations.entries()) {
            const subject = partial.subject ?? defaults.subject;
            const action = partial.action ?? defaults.action;
            const resource = partial.resource ?? defaults.resource;
            if (!subject || !action || !resource) return sendProblem(reply, 400, 'invalid', `Evaluation ${i + 1} has no subject, action or resource, and there is no default for it.`);
            const key = keyOf({ subject, action, resource });
            if (key instanceof OrgUnknown) return unavailable(reply, key);
            if (typeof key === 'string') return sendProblem(reply, 400, 'invalid', `Evaluation ${i + 1}: ${key}`);
            keys.push(key);
          }
          // One freshness for the batch: the strictest any of its checks needs.
          const consistency: Consistency = keys.some((k) => consistencyFor(k) === 'HIGHER_CONSISTENCY') ? 'HIGHER_CONSISTENCY' : 'MINIMIZE_LATENCY';
          let answers;
          try {
            answers = await engine.batchCheck(store, modelId, keys, contextNow(), consistency);
          } catch (err) {
            return unavailable(reply, err);
          }
          const failed = answers.find((a) => 'error' in a);
          if (failed) return unavailable(reply, new Error('error' in failed ? failed.error : 'unknown'));
          const decisions = answers.map((a) => ({ decision: 'allowed' in a && a.allowed }));
          const semantic = options?.evaluations_semantic ?? 'execute_all';
          if (semantic === 'execute_all') return { evaluations: decisions };
          // AUGUR asks every check in one call, so the short-circuit semantics only cut the answer short.
          const stopAt = decisions.findIndex((d) => d.decision === (semantic === 'permit_on_first_permit'));
          return { evaluations: stopAt === -1 ? decisions : decisions.slice(0, stopAt + 1) };
        },
      );

      access.post(
        '/search/resource',
        { schema: { summary: 'Which resources of a type may this subject do this to?', body: ResourceSearch, response: { 200: ResourceResults } } },
        async (req, reply) => {
          if (!(await mayAsk(req, reply))) return reply;
          const { subject, action, resource } = req.body;
          // The type and relation are checked as for an evaluation, with a stand-in id.
          const key = keyOf({ subject, action, resource: { type: resource.type, id: '_' } });
          if (key instanceof OrgUnknown) return unavailable(reply, key);
          if (typeof key === 'string') return sendProblem(reply, 400, 'invalid', key);
          try {
            const found = await engine.listObjects(store, modelId, { user: key.user, relation: key.relation, type: resource.type }, contextNow(), consistencyFor(key));
            return { results: found.map((o) => ({ type: resource.type, id: o.slice(resource.type.length + 1) })) };
          } catch (err) {
            return unavailable(reply, err);
          }
        },
      );
    },
    { prefix: `/access/${API_VERSION}` },
  );

  return app;
};
