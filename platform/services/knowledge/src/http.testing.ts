// What the HTTP tests share: one org with two teams beside each other, Alice on one and Bob on the other, each
// with a floor of their own; a stand-in for identity that says where they stand; and calls as them.
import { callerHeaders, type Caller } from '@augur/service-kit';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp, type KnowledgeOptions } from './app.ts';
import type { Standing } from './standing.ts';

export const ORG = 'org-1';
export const own = { alice: 'you-alice', bob: 'you-bob' } as const;
export type Person = keyof typeof own;

export const people = () => {
  const where: Record<string, Standing> = {};
  const state = { identityDown: false };
  const reset = () => {
    where.alice = { floors: [{ id: ORG, kind: 'org' }, { id: 'team-a', kind: 'team', parent: ORG }], memberOf: [ORG, 'team-a'] };
    where.bob = { floors: [{ id: ORG, kind: 'org' }, { id: 'team-b', kind: 'team', parent: ORG }], memberOf: [ORG, 'team-b'] };
    state.identityDown = false;
  };
  reset();
  class PeopleUnavailable extends Error {}
  const standing = async (person: string) => {
    if (state.identityDown) throw new PeopleUnavailable('Identity could not be reached.');
    return where[person] ?? { floors: [{ id: ORG, kind: 'org' as const }], memberOf: [ORG] };
  };
  return { where, state, reset, standing };
};

const kindOf = (floor: string) => (floor === ORG ? 'org' : floor.startsWith('you-') ? 'personal' : 'team') as 'org' | 'personal' | 'team';
export const as = (person: Person, floor?: string, extra: Partial<Caller> = {}) =>
  callerHeaders({ id: person, name: person, departments: [], roles: [], ...(floor ? { workspace: { id: floor, kind: kindOf(floor), role: 'member' } } : {}), ...extra });

let n = 0;
export const key = () => `test-key-${++n}-${Date.now()}`;

export interface Client {
  app: FastifyInstance;
  /** Takes an action as a person standing on a floor, with a new Idempotency-Key unless one is given. */
  act: (person: Person, floor: string, action: string, body: unknown, options?: { k?: string; dryRun?: boolean }) => Promise<LightMyRequestResponse>;
  get: (person: Person, url: string, floor?: string) => Promise<LightMyRequestResponse>;
}

/** The service as a person calls it through the gateway. */
export const client = async (options: KnowledgeOptions): Promise<Client> => {
  const app: FastifyInstance = await buildApp(options);
  return {
    app,
    act: (person: Person, floor: string, action: string, body: unknown, { k = key(), dryRun = false } = {}) =>
      app.inject({ method: 'POST', url: `/v1/actions/${action}${dryRun ? '?dryRun=true' : ''}`, headers: { ...as(person, floor), 'idempotency-key': k }, payload: body as object }),
    get: (person: Person, url: string, floor?: string) => app.inject({ method: 'GET', url, headers: as(person, floor) }),
  };
};

const sha = (c: string) => c.repeat(64).slice(0, 64);
/** A report naming one ship and its capacity, as retain takes it. */
export const report = (ref: string, label = 'MV Kestrel Dawn', capacity = 1200) => ({
  source: { app: 'notes', ref, version: '1', contentSha256: sha('a'), title: `Report ${ref}` },
  extractor: 'test',
  entities: [{ ref: 'ship', label, class: 'kg:Ship', identityKeys: [{ scheme: 'imo', value: `IMO-${ref}` }] }],
  observations: [{ subject: 'ship', predicate: 'kg:capacity', kind: 'property', value: { v: capacity, unit: 'TEU' }, quote: `capacity ${capacity} TEU`, modality: 'reported' }],
});
