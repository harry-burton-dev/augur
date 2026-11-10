import { describe, expect, it } from 'vitest';
import { connectKnowledge, KnowledgeUnavailable, type KnowledgeBaseClass, type KnowledgeClass } from './index.js';

const decl = (name: string) => ({
  name,
  since: '1.0.0',
  summary: name,
  input: { type: 'object' },
  who: 'Anyone on the floor',
  scope: 'knowledge:act' as const,
  grantedToAppsByDefault: name !== 'hold',
  undoable: true,
  emits: [],
});

/** A knowledge service that offers `actions`, recording each request. */
const service = (actions: string[], catalogueStatus = 200) => {
  const sent: Request[] = [];
  const fetch = async (request: Request) => {
    sent.push(request);
    const json = (status: number, body: unknown, type = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
    if (request.method === 'GET') {
      return catalogueStatus === 200
        ? json(200, { apiMajor: 1, version: '1.4.0', actions: actions.map(decl) })
        : json(catalogueStatus, { type: 'about:blank', title: 'Unauthorized', status: catalogueStatus, reason: 'unauthenticated', detail: 'Sign in to continue.', error: 'unauthenticated', message: 'Sign in to continue.' }, 'application/problem+json');
    }
    if (request.url.includes('/actions/hold')) return json(403, { type: 'about:blank', title: 'Forbidden', status: 403, reason: 'not_allowed', detail: 'Not done: only a holder may.', error: 'not_allowed', message: 'Not done.' }, 'application/problem+json');
    return json(200, { action: 'retain', actionId: 'act_1', effects: { sources: ['s1'] } });
  };
  return { fetch, sent };
};

describe('the knowledge client', () => {
  it('binds the actions the service offers when it connects', async () => {
    const { fetch, sent } = service(['retain', 'hold']);
    const kg = await connectKnowledge({ gateway: 'https://augur.test/api', fetch });
    expect(sent[0].url).toBe('https://augur.test/api/knowledge/v1/actions');
    expect(kg.actions).toEqual(['retain', 'hold']);
    expect(kg.offers('retain')).toBe(true);
    expect(kg.declaration('hold')?.grantedToAppsByDefault).toBe(false);

    const { data } = await kg.act('retain', { source: { app: 'demo', ref: 'r1' } });
    expect(data?.actionId).toBe('act_1');
    const post = sent[1];
    expect(post.method).toBe('POST');
    expect(post.url).toBe('https://augur.test/api/knowledge/v1/actions/retain');
    expect(post.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await post.json()).toEqual({ source: { app: 'demo', ref: 'r1' } });
  });

  it('keeps a key it is given, sends dryRun, and gives a refusal back as the problem', async () => {
    const { fetch, sent } = service(['retain', 'hold']);
    const kg = await connectKnowledge({ baseUrl: 'https://kg.test/v1', fetch });
    await kg.act('retain', {}, { idempotencyKey: 'change-0001', dryRun: true });
    expect(sent[1].headers.get('idempotency-key')).toBe('change-0001');
    expect(sent[1].url).toBe('https://kg.test/v1/actions/retain?dryRun=true');
    const refused = await kg.act('hold', {});
    expect(refused).toMatchObject({ status: 403, error: { reason: 'not_allowed' } });
  });

  it('answers an action the deployment doesn’t offer with a problem that names those it does, without asking', async () => {
    const { fetch, sent } = service(['retain']);
    const kg = await connectKnowledge({ baseUrl: 'https://kg.test/v1', fetch });
    const answer = await kg.act('merge', {});
    expect(answer).toMatchObject({ status: 404, error: { reason: 'unknown_action', problems: ['retain'] } });
    expect(sent).toHaveLength(1);
  });

  it('says why it can’t connect when the catalogue can’t be read', async () => {
    const { fetch } = service([], 401);
    const failed = await connectKnowledge({ baseUrl: 'https://kg.test/v1', fetch }).catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(KnowledgeUnavailable);
    expect(failed).toMatchObject({ status: 401, problem: { reason: 'unauthenticated' }, message: 'Sign in to continue.' });
  });

  it('types the base profile’s classes, and lets an adopted class through', () => {
    const ship: KnowledgeBaseClass = 'kg:Ship';
    const adopted: KnowledgeClass = 'kg:Tug';
    // @ts-expect-error a class the base profile doesn't have isn't a KnowledgeBaseClass
    const notBase: KnowledgeBaseClass = 'kg:Tug';
    expect([ship, adopted, notBase]).toHaveLength(3);
  });
});
