import { createHash } from 'node:crypto';
import Fastify, { type FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type pg from 'pg';
import Type from 'typebox';
import { ulid } from 'ulid';
import { callerFromHeaders, health, packageVersion, Problem, problemDetails, serviceFastifyOptions, signedCallers, type CallerCheck } from '@augur/service-kit';
import { actionNamed, CATALOGUE, checkInput, declaration, InvalidInput, type Effects } from './actions.ts';
import { describeApi } from './contract.ts';
import {
  entityBeliefs,
  entityEvents,
  entityOr404,
  listCandidates,
  listEntities,
  notFound,
  readBelief,
  readClass,
  readEntity,
  readObservation,
  readOntology,
  readRun,
  readSource,
  unseenElsewhere,
  uuidOr404,
} from './objects.ts';
import { conflicts, knownEntities, lookup, query, queue, recall, subgraph, summaries } from './queries.ts';
import {
  ActionDecl,
  ActionRecord,
  ActionResult,
  Belief,
  BeliefList,
  Candidate,
  Catalogue,
  Class,
  ConflictList,
  Entity,
  EntityPage,
  Floor,
  Meta,
  Observation,
  Ontology,
  problem,
  Query,
  QueryResult,
  Queue,
  Recall,
  RecallResult,
  ref,
  SourceRef,
  Subgraph,
  SummaryList,
  UnseenObject,
} from './schemas.ts';
import { SHAPES } from './shapes.ts';
import type { StandingLookup } from './standing.ts';
import { asPerson } from './store.ts';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);
/** The base profile the store ships (migration 002). */
const BASE_PROFILE = 'augur-base (CCO profile)';

/** Identity can't say where someone stands, so nothing they ask can be fenced: answered 503. */
export class StandingUnavailable extends Error {}

export interface KnowledgeOptions {
  /** kg_app's pool: every query is fenced to the person acting. */
  store: pg.Pool;
  /** Where people stand, from identity. Without it nobody can be placed, so every read and action is refused for now. */
  standing?: StandingLookup;
  /** Checks the caller the gateway signed (callerCheckFromEnv). Without it `x-user-*` headers are believed as they come, as in local dev. */
  callers?: CallerCheck;
  /** The most a page of a read gives, whatever it asks for (KNOWLEDGE_PAGE_LIMIT). */
  pageLimit?: number;
  /** The most hops a subgraph goes from its entity, whatever it asks for (KNOWLEDGE_SUBGRAPH_DEPTH). */
  subgraphDepth?: number;
}

/** A page's ceiling when the deployment sets none. */
export const DEFAULT_PAGE_LIMIT = 100;
/** A subgraph's ceiling when the deployment sets none. */
export const DEFAULT_SUBGRAPH_DEPTH = 3;

const KEY = /^[\x21-\x7e]{8,200}$/;
const NOT_ON_FLOOR = 'You can’t stand on that floor, or it no longer exists.';
const WHO_ADDS = 'A lead of the team, or an admin, who can add you to it.';

/** An error from the store, as a problem: a refusal says why, a bad reference says what to fix. */
const fromStore = (err: unknown): unknown => {
  const e = err as { code?: string; message?: string; constraint?: string };
  if (e.code === '42501' && e.message?.startsWith('refused: ')) {
    const why = e.message.slice('refused: '.length);
    return new Problem(403, 'not_allowed', `Not done: ${why}.`, { extensions: { why } });
  }
  if (e.code === '23505') return new Problem(409, 'conflict', 'That is already in the graph, so nothing was added.');
  if (e.code && /^(23503|23514|22P02|22007|22008|22003)$/.test(e.code)) return new Problem(422, 'invalid_input', 'The input names something the graph doesn’t have, or a value it can’t take.');
  return err;
};

/**
 * The knowledge graph's HTTP API (ADR 0079): floors, the action catalogue, the one route that takes an
 * action, and reads, each answered as the person calling on the floor they stand on. The store's fence does
 * the deciding (migrations 003 and 004); this only says who is asking and where.
 */
export const buildApp = async ({ store, standing, callers, pageLimit = DEFAULT_PAGE_LIMIT, subgraphDepth = DEFAULT_SUBGRAPH_DEPTH }: KnowledgeOptions) => {
  const app = Fastify(serviceFastifyOptions()).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(problemDetails());
  await describeApi(app, `/${API_VERSION}`);
  app.addHook('onRequest', signedCallers(callers));
  app.get('/healthz', { schema: { hide: true } }, async () => health('knowledge', version, API_VERSION));

  /** The person calling and the floor they ask from: the one named, or the one they stand on. */
  const personOn = (req: FastifyRequest, floor?: string, { orOrg = false } = {}) => {
    const caller = callerFromHeaders(req.headers);
    if (!caller) throw new Problem(401, 'unauthenticated', 'Sign in to continue.');
    if (caller.app) throw new Problem(403, 'not_allowed', `${caller.app} can’t reach the knowledge graph yet: apps reach it through its client, which comes in a later release.`);
    const here = floor ?? caller.workspace?.id;
    if (!here && !orOrg) throw new Problem(400, 'floor_required', 'Say which floor you stand on (X-Workspace-Id).');
    // The gateway checked the floor named in X-Workspace-Id: when it is your own, that's where your own floor is.
    const personal = caller.workspace?.kind === 'personal' ? caller.workspace.id : undefined;
    return { person: caller.id, here, personal };
  };

  /** Runs `work` as the person on the floor, after bringing where they stand up to date from identity. */
  const standOn = async <T>(req: FastifyRequest, floor: string | undefined, work: (db: pg.PoolClient, sight: string[]) => Promise<T>, options: { keep?: boolean; orOrg?: boolean } = {}) => {
    const { person, here, personal } = personOn(req, floor, options);
    if (!standing) throw new StandingUnavailable('The knowledge service has no way to ask identity where people stand.');
    const where = await standing(person);
    return asPerson(
      store,
      // Everyone stands on the org, so a read that names no floor is made from there.
      { person, floor: here ?? where.memberOf[0]! },
      async (db) => {
        await db.query('select kg.sync_person($1, $2::jsonb, $3::text[], $4)', [person, JSON.stringify(where.floors), where.memberOf, personal ?? null]);
        const sight = (await db.query<{ sight: string[] }>('select kg.my_sight() as sight')).rows[0]!.sight;
        if (!sight.length) throw new Problem(403, 'not_on_floor', NOT_ON_FLOOR, { whoCanChange: WHO_ADDS });
        try {
          return await work(db, sight);
        } catch (err) {
          throw fromStore(err);
        }
      },
      { keep: options.keep },
    );
  };

  await app.register(
    async (plain) => {
      const app = plain.withTypeProvider<TypeBoxTypeProvider>();
      const ObjectParams = Type.Object({ floor: Type.String({ minLength: 1, maxLength: 120, description: 'A floor id as identity gives it.' }), id: Type.String({ minLength: 1, maxLength: 80 }) });

      app.get('/meta', { schema: { summary: 'The majors this service speaks, its version and the ontology version', response: { 200: ref(Meta) } } }, async () => {
        const { rows } = await store.query<{ v: number }>('select max(version)::int as v from kg.ontology_versions');
        return { apiMajor: 1 as const, version, ontology: { base: BASE_PROFILE, version: String(rows[0]?.v ?? 1) }, speaks: { knowledge: [1] } };
      });

      app.get(
        '/floors',
        {
          schema: {
            summary: 'The floors you can stand on, what each sees, and how it holds',
            response: { 200: Type.Object({ floors: Type.Array(ref(Floor)) }), 401: problem('No signed-in caller'), 503: problem('Identity can’t be asked where you stand') },
          },
        },
        async (req) =>
          standOn(
            req,
            undefined,
            async (db) => {
            const { rows } = await db.query<{ id: string; kind: 'personal' | 'team' | 'org'; parent: string | null; hold: 'role' | 'auto'; sight: string[] }>(
              `select f.id, f.kind, f.parent, f.hold_policy as hold, array(select kg.sight_from(f.id)) as sight from kg.standable() f`,
            );
            return { floors: rows.map((f) => ({ id: f.id, kind: f.kind, parent: f.parent, sight: f.sight, trust: { hold: f.kind === 'personal' ? ('memory' as const) : f.hold } })) };
            },
            { orOrg: true },
          ),
      );

      app.get('/actions', { schema: { summary: 'The action catalogue, read at run time', response: { 200: ref(Catalogue) } } }, async () => ({
        apiMajor: 1 as const,
        version,
        actions: CATALOGUE.map(declaration),
      }));

      const ActionParams = Type.Object({ action: Type.String({ pattern: '^[a-z][a-z0-9-]{1,60}$' }) });
      const unknown = (name: string) => new Problem(404, 'unknown_action', `There is no action "${name}".`, { extensions: { problems: CATALOGUE.map((a) => a.name) } });

      app.post(
        '/actions/:action',
        {
          schema: {
            summary: 'Take an action: the only way anything changes',
            description:
              'The body is the input `GET /actions` gives for the action. A repeat with the same Idempotency-Key and body answers what the first did; the same key with another body is refused. With dryRun=true the action is taken and then undone: the answer says whether it would succeed and why not.',
            params: ActionParams,
            querystring: Type.Object({ dryRun: Type.Optional(Type.Boolean({ default: false })) }),
            headers: Type.Object({ 'idempotency-key': Type.Optional(Type.String({ description: '8 to 200 characters, unique per intended change.' })) }),
            body: Type.Unsafe<unknown>({ type: 'object', description: 'The input schema of the action in GET /actions.' }),
            response: {
              200: ref(ActionResult),
              400: problem('The Idempotency-Key header is missing or malformed, or no floor is named'),
              401: problem('No signed-in caller'),
              403: problem('Not on that floor, or not allowed: says why and who can change it'),
              404: problem('No such action; problems lists the ones there are'),
              409: problem('That key was used for another request, or what it adds is already there'),
              422: problem('The input doesn’t fit the action’s schema, or names things the graph doesn’t have'),
              503: problem('Identity can’t be asked where you stand'),
            },
          },
        },
        async (req) => {
          const action = actionNamed(req.params.action);
          if (!action) throw unknown(req.params.action);
          const key = req.headers['idempotency-key'];
          if (typeof key !== 'string' || !KEY.test(key)) throw new Problem(400, 'idempotency_key_required', 'Send an Idempotency-Key header of 8 to 200 printable characters, new for each change you mean.');
          let input;
          try {
            input = checkInput(action, req.body);
          } catch (err) {
            if (err instanceof InvalidInput) throw new Problem(422, 'invalid_input', `The input doesn’t fit ${action.name}.`, { extensions: { problems: err.problems } });
            throw err;
          }
          const sha = createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
          const dryRun = req.query.dryRun === true;
          return standOn(
            req,
            undefined,
            async (db) => {
              const prior = (await db.query<{ action: string; body_sha256: string; answer: Record<string, unknown> }>('select * from kg.answer_for($1)', [key])).rows[0];
              if (prior) {
                if (prior.action !== action.name || prior.body_sha256 !== sha) throw new Problem(409, 'idempotency_key_reused', 'That Idempotency-Key was used for another request. Use a new key for a new change.');
                return { ...(prior.answer as { action: string; actionId: string; effects: Effects }), replayed: true };
              }
              const actionId = `run_${ulid()}`;
              if (dryRun) {
                await db.query('savepoint dry');
                try {
                  const effects = await action.run(db, input);
                  return { action: action.name, actionId, effects, dryRun: true, wouldSucceed: true };
                } catch (err) {
                  const refused = fromStore(err);
                  const why = refused instanceof InvalidInput ? refused.problems.join(' ') : refused instanceof Problem ? refused.detail : undefined;
                  if (why === undefined) throw err;
                  return { action: action.name, actionId, effects: {}, dryRun: true, wouldSucceed: false, why };
                }
              }
              let effects: Effects;
              try {
                effects = await action.run(db, input);
              } catch (err) {
                if (err instanceof InvalidInput) throw new Problem(422, 'invalid_input', `The input doesn’t fit ${action.name}.`, { extensions: { problems: err.problems } });
                throw err;
              }
              const answer = { action: action.name, actionId, effects };
              await db.query('select kg.keep_answer($1, $2, $3, $4::jsonb)', [key, action.name, sha, JSON.stringify(answer)]);
              return answer;
            },
            { keep: !dryRun },
          );
        },
      );

      const Errors = { 401: problem('No signed-in caller'), 403: problem('Not on that floor'), 503: problem('Identity can’t be asked where you stand') };
      const FloorParams = Type.Object({ floor: ObjectParams.properties.floor });
      const Clocks = Type.Object({
        at: Type.Optional(Type.String({ format: 'date-time', description: 'Valid clock: so in the world at this moment. Without it, whatever time it is about.' })),
        known: Type.Optional(Type.String({ format: 'date-time', description: 'Recorded clock: as the floors had it recorded by this moment. Default now.' })),
        includeSuperseded: Type.Optional(Type.Boolean({ default: false, description: 'Also the forecasts and values that were superseded, marked.' })),
      });
      const Limit = Type.Optional(Type.Integer({ minimum: 1, description: 'The deployment sets the ceiling; the answer says when it applied.' }));
      /** The page size asked for within the deployment's ceiling, and what to say when the ceiling cut it. */
      const capped = (asked = pageLimit) => ({ limit: Math.min(asked, pageLimit), applied: asked > pageLimit ? { limitApplied: pageLimit } : {} });

      app.get(
        '/actions/:action',
        { schema: { summary: 'One action’s declaration', params: ActionParams, response: { 200: ref(ActionDecl), 404: problem('No such action; problems lists the ones there are') } } },
        async (req) => {
          const action = actionNamed(req.params.action);
          if (!action) throw unknown(req.params.action);
          return declaration(action);
        },
      );

      app.get(
        '/actions/runs/:actionId',
        {
          schema: {
            summary: 'The record of one action you took',
            params: Type.Object({ actionId: Type.String({ minLength: 1, maxLength: 80 }) }),
            response: { 200: ref(ActionRecord), 404: problem('You took no action with that id'), ...Errors },
          },
        },
        async (req) => standOn(req, undefined, async (db) => readRun(db, personOn(req, undefined, { orOrg: true }).person, req.params.actionId), { orOrg: true }),
      );

      app.get(
        '/floors/:floor/entities',
        {
          schema: {
            summary: 'Entities in sight from a floor',
            params: FloorParams,
            querystring: Type.Object({
              class: Type.Optional(Type.String({ maxLength: 200, description: 'A class IRI or label; subclasses come too.' })),
              text: Type.Optional(Type.String({ maxLength: 200, description: 'Matches labels and aliases on the floors in sight.' })),
              kind: Type.Optional(Type.Union([Type.Literal('continuant'), Type.Literal('occurrent')])),
              cursor: Type.Optional(Type.String({ maxLength: 80 })),
              limit: Type.Optional(Type.Integer({ minimum: 1, description: 'The deployment sets the ceiling; the answer says when it applied.' })),
            }),
            response: { 200: ref(EntityPage), 422: problem('The cursor isn’t one a page gave'), ...Errors },
          },
        },
        async (req) => {
          const asked = req.query.limit ?? pageLimit;
          const limit = Math.min(asked, pageLimit);
          return standOn(req, req.params.floor, async (db, sight) => ({
            ...(await listEntities(db, sight, { ...req.query, limit })),
            ...(asked > pageLimit ? { limitApplied: pageLimit } : {}),
          }));
        },
      );

      app.get(
        '/floors/:floor/entities/:id',
        {
          schema: {
            summary: 'One entity as this floor knows it, or why it can’t be seen from here',
            params: ObjectParams,
            response: { 200: Type.Union([ref(Entity), ref(UnseenObject)], { description: 'The entity, or an Unseen that names no label' }), 404: problem('No such entity, or none you may know exists'), ...Errors },
          },
        },
        async (req) => {
          const uuid = entityOr404(req.params.id);
          return standOn(req, req.params.floor, async (db, sight) => {
            const entity = await readEntity(db, sight, uuid);
            if (entity) return entity;
            const kind = (await db.query<{ kind: 'team' | 'org' | null }>('select kg.entity_elsewhere($1) as kind', [uuid])).rows[0]!.kind;
            if (!kind) throw notFound('entity');
            return unseenElsewhere('entity', req.params.id, kind);
          });
        },
      );

      app.get(
        '/floors/:floor/entities/:id/beliefs',
        {
          schema: {
            summary: 'What this floor and the floors it sees believe about an entity, on two clocks',
            description: 'Without a clock, what is believed now, whatever time it is about.',
            params: ObjectParams,
            querystring: Clocks,
            response: { 200: ref(BeliefList), 404: problem('No such entity'), ...Errors },
          },
        },
        async (req) => {
          const uuid = entityOr404(req.params.id);
          const { at, known } = req.query;
          return standOn(req, req.params.floor, async (db, sight) => ({ floor: req.params.floor, seeing: sight, beliefs: await entityBeliefs(db, uuid, req.query), ...(at ? { at } : {}), ...(known ? { known } : {}) }));
        },
      );

      app.get(
        '/floors/:floor/entities/:id/events',
        {
          schema: {
            summary: 'The occurrences this entity took part in (arrivals, calls, incidents), each with its own time',
            params: ObjectParams,
            response: { 200: ref(EntityPage), 404: problem('No such entity'), ...Errors },
          },
        },
        async (req) => {
          const uuid = entityOr404(req.params.id);
          return standOn(req, req.params.floor, async (db, sight) => entityEvents(db, sight, uuid));
        },
      );

      app.get(
        '/floors/:floor/beliefs/:id',
        { schema: { summary: 'One belief with its reach, evidence and disputes', params: ObjectParams, response: { 200: ref(Belief), 404: problem('No such belief in sight'), ...Errors } } },
        async (req) => {
          const uuid = uuidOr404(req.params.id, 'belief');
          return standOn(req, req.params.floor, async (db) => (await readBelief(db, uuid)) ?? Promise.reject(notFound('belief')));
        },
      );

      app.get(
        '/floors/:floor/observations/:id',
        {
          schema: {
            summary: 'One observation, or why it can’t be read from here',
            params: ObjectParams,
            response: { 200: Type.Union([ref(Observation), ref(UnseenObject)]), 404: problem('No such observation, or none you may know exists'), ...Errors },
          },
        },
        async (req) => {
          const uuid = uuidOr404(req.params.id, 'observation');
          return standOn(req, req.params.floor, async (db) => readObservation(db, uuid));
        },
      );

      app.get(
        '/floors/:floor/sources/:id',
        {
          schema: {
            summary: 'A source reference (the text stays in the app that holds it) and what was read from it',
            params: ObjectParams,
            response: { 200: Type.Union([ref(SourceRef), ref(UnseenObject)]), 404: problem('No such source, or none you may know exists'), ...Errors },
          },
        },
        async (req) => {
          const uuid = uuidOr404(req.params.id, 'source');
          return standOn(req, req.params.floor, async (db) => readSource(db, uuid));
        },
      );

      app.get(
        '/floors/:floor/lookup',
        {
          schema: {
            summary: 'Whether a thing with this identity key is known, and where. Outside sight it says only the kind of floor, never a name',
            params: FloorParams,
            querystring: Type.Object({ scheme: Type.String({ minLength: 1, maxLength: 60 }), value: Type.String({ minLength: 1, maxLength: 200 }) }),
            response: { 200: Type.Union([ref(Entity), ref(UnseenObject)], { description: 'The entity, or an Unseen with the kind of floor' }), 404: problem('No such key, or none you may know of'), ...Errors },
          },
        },
        async (req) => standOn(req, req.params.floor, async (db, sight) => lookup(db, sight, req.query.scheme, req.query.value)),
      );

      app.get(
        '/floors/:floor/known-entities',
        {
          schema: {
            summary: 'What an extractor working for this floor may be told is already known (floors in sight only; never another person’s floor)',
            description: 'With a text, the entities it may be about: an identity key or name that appears in it first, then names alike to a stretch of it. Capped by the deployment; the answer says when the cap applied.',
            params: FloorParams,
            querystring: Type.Object({ text: Type.Optional(Type.String({ maxLength: 20000, description: 'The source text.' })), limit: Limit }),
            response: { 200: ref(EntityPage), ...Errors },
          },
        },
        async (req) => {
          const { limit, applied } = capped(req.query.limit);
          return standOn(req, req.params.floor, async (db, sight) => {
            const { entities, more } = await knownEntities(db, sight, req.query.text, limit);
            return { entities, ...(more ? applied : {}) };
          });
        },
      );

      app.get(
        '/floors/:floor/entities/:id/subgraph',
        {
          schema: {
            summary: 'The entity and what links to it, to a depth the deployment caps',
            params: ObjectParams,
            querystring: Type.Object({
              depth: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
              predicate: Type.Optional(Type.Array(Type.String({ maxLength: 200 }), { maxItems: 20, description: 'Only links by these predicates.' })),
            }),
            response: { 200: ref(Subgraph), 404: problem('No such entity in sight'), ...Errors },
          },
        },
        async (req) => {
          const uuid = entityOr404(req.params.id);
          const asked = req.query.depth ?? 1;
          const depth = Math.min(asked, subgraphDepth);
          return standOn(req, req.params.floor, async (db, sight) => ({
            ...(await subgraph(db, sight, uuid, { depth, limit: pageLimit, predicates: req.query.predicate })),
            ...(asked > subgraphDepth ? { depthApplied: subgraphDepth } : {}),
          }));
        },
      );

      app.get(
        '/floors/:floor/entities/:id/summary',
        {
          schema: {
            summary: 'The stacked summary (this floor’s and the floors above), each marked when older than its beliefs',
            params: ObjectParams,
            response: { 200: ref(SummaryList), 404: problem('No such entity in sight'), ...Errors },
          },
        },
        async (req) => {
          const uuid = entityOr404(req.params.id);
          return standOn(req, req.params.floor, async (db, sight) => summaries(db, sight, req.params.floor, uuid));
        },
      );

      app.get(
        '/floors/:floor/conflicts',
        {
          schema: {
            summary: 'Live beliefs in sight that contradict each other, and possible duplicates',
            description: 'Two beliefs conflict when they have the same subject and single-valued predicate, the same modality, overlapping valid time and a different value. A forecast against its outcome is not a conflict.',
            params: FloorParams,
            response: { 200: ref(ConflictList), ...Errors },
          },
        },
        async (req) => standOn(req, req.params.floor, async (db) => conflicts(db, req.params.floor)),
      );

      app.get(
        '/floors/:floor/queue',
        {
          schema: {
            summary: 'What waits on this floor for you (to confirm, to hold, to settle, flagged text to keep), with can and why',
            params: FloorParams,
            response: { 200: ref(Queue), ...Errors },
          },
        },
        async (req) => standOn(req, req.params.floor, async (db) => queue(db, req.params.floor, personOn(req, req.params.floor).person)),
      );

      app.post(
        '/floors/:floor/query',
        {
          schema: {
            summary: 'A structured query over beliefs (read only; a POST because the query is a body)',
            params: FloorParams,
            body: ref(Query),
            response: { 200: ref(QueryResult), 422: problem('The query names a class or entity the graph doesn’t have, or the cursor isn’t one a page gave'), ...Errors },
          },
        },
        async (req) => {
          const { limit, applied } = capped(req.body.limit);
          return standOn(req, req.params.floor, async (db, sight) => ({ ...(await query(db, sight, { ...req.body, limit })), ...applied }));
        },
      );

      app.post(
        '/floors/:floor/recall',
        {
          schema: {
            summary: 'Recall for a person or an agent (text, link and time retrieval fused; each hit says why it matched)',
            description: 'Semantic retrieval needs vectors this deployment doesn’t have yet: the answer names it in ranWithout.',
            params: FloorParams,
            body: ref(Recall),
            response: { 200: ref(RecallResult), ...Errors },
          },
        },
        async (req) => {
          const { limit, applied } = capped(req.body.limit);
          return standOn(req, req.params.floor, async (db, sight) => ({ ...(await recall(db, sight, { ...req.body, limit })), ...applied }));
        },
      );

      // The ontology belongs to no floor: anyone signed in reads it, and only candidates are fenced (to sources in sight).
      const signedIn = (req: FastifyRequest) => {
        if (!callerFromHeaders(req.headers)) throw new Problem(401, 'unauthenticated', 'Sign in to continue.');
      };
      app.get('/ontology', { schema: { summary: 'The deployment’s ontology now: the base profile and the terms adopted since', response: { 200: ref(Ontology), 401: problem('No signed-in caller') } } }, async (req) => {
        signedIn(req);
        return { base: BASE_PROFILE, ...(await readOntology(store)) };
      });
      app.get(
        '/ontology/shapes',
        { schema: { summary: 'The SHACL shapes the store is checked against', produces: ['text/turtle'], response: { 200: Type.String({ description: 'Turtle.' }), 401: problem('No signed-in caller') } } },
        async (req, reply) => {
          signedIn(req);
          return reply.type('text/turtle; charset=utf-8').send(SHAPES);
        },
      );
      app.get(
        '/ontology/classes/:iri',
        {
          schema: {
            summary: 'One class, by IRI or label',
            params: Type.Object({ iri: Type.String({ minLength: 1, maxLength: 200 }) }),
            response: { 200: ref(Class), 401: problem('No signed-in caller'), 404: problem('No such class') },
          },
        },
        async (req) => {
          signedIn(req);
          return readClass(store, req.params.iri);
        },
      );
      app.get(
        '/ontology/candidates',
        { schema: { summary: 'Terms extraction asked for that the ontology lacks, from the sources you can see', response: { 200: Type.Object({ candidates: Type.Array(ref(Candidate)) }), ...Errors } } },
        async (req) => standOn(req, undefined, async (db) => ({ candidates: await listCandidates(db) }), { orOrg: true }),
      );
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
