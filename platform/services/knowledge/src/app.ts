import { createHash } from 'node:crypto';
import Fastify, { type FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type pg from 'pg';
import Type from 'typebox';
import { ulid } from 'ulid';
import { callerFromHeaders, health, packageVersion, Problem, problemDetails, serviceFastifyOptions, signedCallers, type CallerCheck } from '@augur/service-kit';
import { actionNamed, CATALOGUE, checkInput, declaration, InvalidInput, type Effects } from './actions.ts';
import { describeApi } from './contract.ts';
import { entityId, entityUuid } from './ids.ts';
import { ActionResult, BeliefList, Catalogue, Entity, Floor, Meta, problem, ref, UnseenObject } from './schemas.ts';
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
}

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
export const buildApp = async ({ store, standing, callers }: KnowledgeOptions) => {
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

      app.get(
        '/floors/:floor/entities/:id',
        {
          schema: {
            summary: 'One entity as this floor knows it, or why it can’t be seen from here',
            params: ObjectParams,
            response: {
              200: Type.Union([ref(Entity), ref(UnseenObject)], { description: 'The entity, or an Unseen that names no label' }),
              401: problem('No signed-in caller'),
              403: problem('Not on that floor'),
              404: problem('No such entity, or none you may know exists'),
              503: problem('Identity can’t be asked where you stand'),
            },
          },
        },
        async (req) => {
          const uuid = entityUuid(req.params.id);
          if (!uuid) throw new Problem(404, 'not_found', 'There is no such entity.');
          return standOn(req, req.params.floor, async (db, sight) => {
            const e = (
              await db.query<{ class: string; state: 'active' | 'retired' | 'merged'; merged_into: string | null; kind: 'continuant' | 'occurrent' }>(
                'select e.class, e.state, e.merged_into, c.kind from kg.entities e join kg.classes c on c.iri = e.class where e.id = $1',
                [uuid],
              )
            ).rows[0];
            if (!e) {
              const kind = (await db.query<{ kind: 'team' | 'org' | null }>('select kg.entity_elsewhere($1) as kind', [uuid])).rows[0]!.kind;
              if (!kind) throw new Problem(404, 'not_found', 'There is no such entity.');
              return { kind: 'entity' as const, id: req.params.id, unseen: { reason: 'elsewhere' as const, floorKind: kind, message: `This is known on ${kind === 'org' ? 'the organisation’s floor' : 'a team’s floor'}, which you can’t see from here.` } };
            }
            const names = (await db.query<{ name: string; is_label: boolean; floor: string }>('select name, is_label, floor from kg.entity_names where entity = $1', [uuid])).rows;
            // The label from the nearest floor: this one first, then up through what it sees.
            const near = (floor: string) => (sight.indexOf(floor) === -1 ? sight.length : sight.indexOf(floor));
            const labels = names.filter((n) => n.is_label).sort((a, b) => near(a.floor) - near(b.floor));
            const label = labels[0] ?? names[0]!;
            return {
              id: req.params.id,
              class: e.class,
              kind: e.kind,
              state: e.state,
              ...(e.merged_into ? { mergedInto: entityId(e.merged_into) } : {}),
              label: label.name,
              labelFrom: label.floor,
              aliases: [...new Set(names.filter((n) => n.name !== label.name).map((n) => n.name))].sort(),
            };
          });
        },
      );

      app.get(
        '/floors/:floor/entities/:id/beliefs',
        {
          schema: {
            summary: 'What this floor and the floors it sees believe about an entity now',
            params: ObjectParams,
            response: { 200: ref(BeliefList), 401: problem('No signed-in caller'), 403: problem('Not on that floor'), 404: problem('No such entity'), 503: problem('Identity can’t be asked where you stand') },
          },
        },
        async (req) => {
          const uuid = entityUuid(req.params.id);
          if (!uuid) throw new Problem(404, 'not_found', 'There is no such entity.');
          return standOn(req, req.params.floor, async (db, sight) => {
            const { rows } = await db.query<{
              id: string;
              home_floor: string;
              reach: string[];
              predicate: string;
              value: { v: number | string | boolean; unit?: string } | null;
              object: string | null;
              modality: string;
              valid_from: Date | null;
              valid_to: Date | null;
              recorded_at: Date;
              held_by: string;
              disputed: boolean;
              sources_behind: string;
              evidence_unseen: string;
              by_floor: { floor: string; floorKind: 'personal' | 'team' | 'org'; observations: number }[];
            }>(
              `select b.id, b.home_floor, b.reach, b.predicate, b.value, b.object, b.modality, lower(b.valid) as valid_from, upper(b.valid) as valid_to,
                      b.recorded_at, b.held_by, b.disputed, b.sources_behind, b.evidence_unseen,
                      coalesce((select jsonb_agg(jsonb_build_object('floor', x.floor, 'floorKind', x.kind, 'observations', x.n) order by x.floor)
                                from (select o.floor, f.kind, count(*)::int as n from kg.belief_evidence be join kg.observations o on o.id = be.observation
                                      join kg.floors f on f.id = o.floor where be.belief = b.id group by o.floor, f.kind) x), '[]') as by_floor
               from kg.live_beliefs b where b.subject = $1 order by b.predicate, b.recorded_at`,
              [uuid],
            );
            return {
              floor: req.params.floor,
              seeing: sight,
              beliefs: rows.map((b) => {
                const seen = b.by_floor.reduce((n, f) => n + f.observations, 0);
                return {
                  id: b.id,
                  homeFloor: b.home_floor,
                  reach: b.reach,
                  subject: req.params.id,
                  predicate: b.predicate,
                  kind: b.object ? ('link' as const) : ('property' as const),
                  ...(b.value ? { value: b.value } : {}),
                  ...(b.object ? { object: entityId(b.object) } : {}),
                  modality: b.modality,
                  ...(b.valid_from ? { validFrom: b.valid_from.toISOString() } : {}),
                  ...(b.valid_to ? { validTo: b.valid_to.toISOString() } : {}),
                  recordedAt: b.recorded_at.toISOString(),
                  state: b.disputed ? ('disputed' as const) : b.held_by === 'memory' ? ('memory' as const) : ('held' as const),
                  heldBy: b.held_by,
                  evidence: { observations: seen + Number(b.evidence_unseen), sources: Number(b.sources_behind), unseen: Number(b.evidence_unseen), byFloor: b.by_floor },
                };
              }),
            };
          });
        },
      );
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
