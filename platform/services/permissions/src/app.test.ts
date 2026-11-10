import { describe, expect, it } from 'vitest';
import { callerHeaders, GATEWAY_CALLER } from '@augur/service-kit';
import { buildApp, consistencyFor } from './app.ts';
import { loadModel, OpenFga, sameModel, type AuthorizationModel } from './openfga.ts';

const model = loadModel();

/** OpenFGA as far as the service sees it: what it was asked, and the answers it gives. */
const fakeOpenFga = (answer: (body: Record<string, unknown>) => unknown = () => ({ allowed: true }), status = 200) => {
  const asked: { path: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    asked.push({ path, body });
    if (path === '/healthz') return new Response('{}', { status });
    return new Response(JSON.stringify(answer(body)), { status });
  }) as typeof fetch;
  return { asked, engine: new OpenFga({ url: 'http://openfga:8080', fetchImpl }) };
};

const now = () => new Date('2026-11-20T09:00:00Z');
const build = (engine: OpenFga) => buildApp({ engine, store: 'S', modelId: 'M', model, now });
const asGateway = callerHeaders(GATEWAY_CALLER);
const ask = { subject: { type: 'person', id: 'tomas' }, action: { name: 'stands' }, resource: { type: 'floor', id: 'port-services' } };

describe('POST /access/v1/evaluation', () => {
  it('asks OpenFGA the check the evaluation names, with the service’s own clock', async () => {
    const { asked, engine } = fakeOpenFga();
    const app = await build(engine);
    const res = await app.inject({ method: 'POST', url: '/access/v1/evaluation', headers: asGateway, payload: ask });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ decision: true });
    expect(asked[0]).toEqual({
      path: '/stores/S/check',
      body: {
        tuple_key: { user: 'person:tomas', relation: 'stands', object: 'floor:port-services' },
        authorization_model_id: 'M',
        context: { current_time: '2026-11-20T09:00:00.000Z' },
        consistency: 'MINIMIZE_LATENCY',
      },
    });
  });

  it('never passes on a time or anything else the caller sends as context', async () => {
    const { asked, engine } = fakeOpenFga();
    const app = await build(engine);
    await app.inject({ method: 'POST', url: '/access/v1/evaluation', headers: asGateway, payload: { ...ask, context: { current_time: '2020-01-01T00:00:00Z', grant_expires: '2999-01-01T00:00:00Z' } } });
    expect(asked[0]!.body.context).toEqual({ current_time: '2026-11-20T09:00:00.000Z' });
  });

  it('says no when OpenFGA says no', async () => {
    const { engine } = fakeOpenFga(() => ({ allowed: false }));
    const app = await build(engine);
    const res = await app.inject({ method: 'POST', url: '/access/v1/evaluation', headers: asGateway, payload: ask });
    expect(res.json()).toEqual({ decision: false });
  });

  it('refuses a question about a type or relation the model doesn’t have, without asking OpenFGA', async () => {
    const { asked, engine } = fakeOpenFga();
    const app = await build(engine);
    const noType = await app.inject({ method: 'POST', url: '/access/v1/evaluation', headers: asGateway, payload: { ...ask, resource: { type: 'spaceship', id: 'x' } } });
    expect(noType.statusCode).toBe(400);
    expect(noType.json().detail).toBe('The model has no type spaceship.');
    const noRelation = await app.inject({ method: 'POST', url: '/access/v1/evaluation', headers: asGateway, payload: { ...ask, action: { name: 'can_fly' } } });
    expect(noRelation.json().detail).toBe('floor has no can_fly in the model.');
    expect(asked).toEqual([]);
  });

  it('refuses an id that would change the check OpenFGA is asked', async () => {
    const { asked, engine } = fakeOpenFga();
    const app = await build(engine);
    const res = await app.inject({ method: 'POST', url: '/access/v1/evaluation', headers: asGateway, payload: { ...ask, subject: { type: 'person', id: 'tomas#member@floor:x' } } });
    expect(res.statusCode).toBe(400);
    expect(asked).toEqual([]);
  });

  it('answers only the gateway and AUGUR’s own services', async () => {
    const { asked, engine } = fakeOpenFga();
    const app = await build(engine);
    const person = await app.inject({ method: 'POST', url: '/access/v1/evaluation', headers: callerHeaders({ id: 'tomas', name: 'Tomas', departments: [], roles: ['admin'] }), payload: ask });
    expect(person.statusCode).toBe(403);
    const nobody = await app.inject({ method: 'POST', url: '/access/v1/evaluation', payload: ask });
    expect(nobody.statusCode).toBe(403);
    expect(asked).toEqual([]);
  });

  it('refuses, and says so, when OpenFGA can’t answer: never a yes', async () => {
    const { engine } = fakeOpenFga(() => ({ code: 'internal_error' }), 500);
    const app = await build(engine);
    const res = await app.inject({ method: 'POST', url: '/access/v1/evaluation', headers: asGateway, payload: ask });
    expect(res.statusCode).toBe(503);
    expect(res.json().detail).toMatch(/can’t be checked right now/);
  });
});

describe('POST /access/v1/evaluations', () => {
  const two = {
    subject: { type: 'person', id: 'priya' },
    evaluations: [
      { action: { name: 'can_manage_members' }, resource: { type: 'floor', id: 'operations' } },
      { action: { name: 'can_manage_members' }, resource: { type: 'floor', id: 'fleet' } },
      { action: { name: 'stands' }, resource: { type: 'org', id: 'org' } },
    ],
  };
  const answers = (allowed: boolean[]) => () => ({ result: Object.fromEntries(allowed.map((a, i) => [`c${i}`, { allowed: a }])) });

  it('asks every check in one batch and answers in order', async () => {
    const { asked, engine } = fakeOpenFga(answers([true, false, true]));
    const app = await build(engine);
    const res = await app.inject({ method: 'POST', url: '/access/v1/evaluations', headers: asGateway, payload: two });
    expect(res.json()).toEqual({ evaluations: [{ decision: true }, { decision: false }, { decision: true }] });
    expect(asked).toHaveLength(1);
    expect(asked[0]!.path).toBe('/stores/S/batch-check');
    expect((asked[0]!.body.checks as unknown[]).length).toBe(3);
  });

  it('stops the answer at the first refusal when asked to', async () => {
    const { engine } = fakeOpenFga(answers([true, false, true]));
    const app = await build(engine);
    const res = await app.inject({ method: 'POST', url: '/access/v1/evaluations', headers: asGateway, payload: { ...two, options: { evaluations_semantic: 'deny_on_first_deny' } } });
    expect(res.json()).toEqual({ evaluations: [{ decision: true }, { decision: false }] });
  });

  it('refuses the whole batch when one check can’t be answered', async () => {
    const { engine } = fakeOpenFga(() => ({ result: { c0: { allowed: true }, c1: { error: { message: 'timeout' } }, c2: { allowed: true } } }));
    const app = await build(engine);
    const res = await app.inject({ method: 'POST', url: '/access/v1/evaluations', headers: asGateway, payload: two });
    expect(res.statusCode).toBe(503);
  });

  it('says which evaluation is missing a part', async () => {
    const { engine } = fakeOpenFga();
    const app = await build(engine);
    const res = await app.inject({ method: 'POST', url: '/access/v1/evaluations', headers: asGateway, payload: { evaluations: [{ action: { name: 'stands' } }] } });
    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toBe('Evaluation 1 has no subject, action or resource, and there is no default for it.');
  });

  it('reads with the strictest freshness any check in it needs', async () => {
    const { asked, engine } = fakeOpenFga(answers([true, true]));
    const app = await build(engine);
    await app.inject({
      method: 'POST',
      url: '/access/v1/evaluations',
      headers: asGateway,
      payload: { evaluations: [ask, { subject: { type: 'persona', id: 'sofia-admin' }, action: { name: 'can_upgrade' }, resource: { type: 'deployment', id: 'this' } }] },
    });
    expect(asked[0]!.body.consistency).toBe('HIGHER_CONSISTENCY');
  });
});

describe('freshness (ADR 0085, D8)', () => {
  it('skips the cache for personas, the deployment, roles and sharing, and for nothing else', () => {
    expect(consistencyFor({ user: 'persona:a', relation: 'can_see', object: 'floor:x' })).toBe('HIGHER_CONSISTENCY');
    expect(consistencyFor({ user: 'person:a', relation: 'can_read_health', object: 'deployment:this' })).toBe('HIGHER_CONSISTENCY');
    expect(consistencyFor({ user: 'person:a', relation: 'can_assign', object: 'role:r' })).toBe('HIGHER_CONSISTENCY');
    expect(consistencyFor({ user: 'person:a', relation: 'can_share', object: 'document:d' })).toBe('HIGHER_CONSISTENCY');
    expect(consistencyFor({ user: 'person:a', relation: 'stands', object: 'floor:x' })).toBe('MINIMIZE_LATENCY');
  });
});

describe('the model', () => {
  it('is found again when OpenFGA already has it, and written when it differs', async () => {
    const stored = { id: 'M1', ...model };
    const { asked, engine } = fakeOpenFga((body) => (Object.keys(body).length ? { authorization_model_id: 'M2' } : { authorization_models: [stored] }));
    expect(await engine.ensureModel('S', model)).toBe('M1');
    const changed: AuthorizationModel = { ...model, type_definitions: [...model.type_definitions, { type: 'extra' }] };
    expect(await engine.ensureModel('S', changed)).toBe('M2');
    expect(asked.filter((a) => a.path === '/stores/S/authorization-models' && Object.keys(a.body).length)).toHaveLength(1);
  });

  it('compares equal whatever order OpenFGA gives its keys in, or empty fields it adds', () => {
    const reversed = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(reversed) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reversed(x)])) : v;
    const shuffled = reversed(model) as AuthorizationModel;
    expect(sameModel({ ...shuffled, conditions: {} }, model)).toBe(true);
  });

  it('gives admin on the deployment and the org only to personas (ADR 0086)', () => {
    const typeOf = (t: string) => model.type_definitions.find((d) => d.type === t) as { metadata: { relations: Record<string, { directly_related_user_types: { type: string }[] }> } };
    for (const t of ['deployment', 'org']) {
      expect(typeOf(t).metadata.relations.admin!.directly_related_user_types).toEqual([{ type: 'persona' }]);
    }
  });
});
