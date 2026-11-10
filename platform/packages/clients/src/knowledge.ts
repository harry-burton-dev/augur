// The knowledge graph's client, on top of the generated one (ADR 0079, D15): reads are the contract's paths,
// typed, and actions are bound from the catalogue the service gives when the client connects, since the
// catalogue grows within a major. Hand-written because it adds behaviour, not types: the types stay generated.
import type { ServiceClientOptions } from './client.js';
import { knowledgeClient, type knowledge } from './generated/index.js';

type Schemas = knowledge.components['schemas'];
/** A class of the base profile, which every deployment has. */
export type KnowledgeBaseClass = Schemas['BaseClass'];
/** A class IRI: one of the base profile's, or one a deployment adopted. */
export type KnowledgeClass = KnowledgeBaseClass | (string & {});
export type KnowledgeAction = Schemas['ActionDecl'];
export type KnowledgeActionResult = Schemas['ActionResult'];
export type KnowledgeProblem = Schemas['Problem'];

export interface ActOptions {
  /** Unique per intended change: a repeat with the same key answers what the first did. A new one by default. */
  idempotencyKey?: string;
  /** Take the action and undo it: the answer says whether it would succeed and why not. */
  dryRun?: boolean;
}

/** What an action answers: its result, or the problem that stopped it. */
export type ActAnswer = { data: KnowledgeActionResult; error?: undefined; status: number } | { data?: undefined; error: KnowledgeProblem; status: number };

/** The problem a client gives, without asking, for an action the connected service doesn't offer. */
const notOffered = (name: string, offered: string[]): KnowledgeProblem => ({
  type: 'about:blank',
  title: 'Not Found',
  status: 404,
  reason: 'unknown_action',
  detail: `This deployment's knowledge graph has no action "${name}".`,
  problems: offered,
  error: 'unknown_action',
  message: `This deployment's knowledge graph has no action "${name}".`,
});

const newKey = () => globalThis.crypto.randomUUID();

/**
 * Connects to the knowledge graph: reads the action catalogue once, then binds each action it offers.
 * `act(name, input)` posts to POST /actions/{action} with a fresh Idempotency-Key; an action this deployment
 * doesn't offer answers a problem that lists those it does, without a request. Reads go through `api`.
 * Throws when the catalogue can't be read, with the service's problem, since nothing else can work then.
 */
export const connectKnowledge = async (options?: ServiceClientOptions) => {
  const api = knowledgeClient(options);
  const { data: catalogue, error, response } = await api.GET('/actions');
  if (!catalogue) throw new KnowledgeUnavailable(response.status, error as KnowledgeProblem | undefined);
  const declared = new Map(catalogue.actions.map((a) => [a.name, a]));
  const names = [...declared.keys()];

  const act = async (name: string, input: Record<string, unknown>, { idempotencyKey = newKey(), dryRun }: ActOptions = {}): Promise<ActAnswer> => {
    if (!declared.has(name)) return { error: notOffered(name, names), status: 404 };
    const { data, error: problem, response: res } = await api.POST('/actions/{action}', {
      params: { path: { action: name }, query: dryRun === undefined ? {} : { dryRun }, header: { 'idempotency-key': idempotencyKey } },
      body: input,
    });
    return data ? { data, status: res.status } : { error: problem as KnowledgeProblem, status: res.status };
  };

  return {
    /** The typed client for every read in the contract. */
    api,
    /** The catalogue as the service gave it: each action, its input schema, its scope and who may take it. */
    catalogue,
    /** The actions this deployment offers, by name. */
    actions: names,
    /** Whether this deployment offers an action. */
    offers: (name: string) => declared.has(name),
    /** An action's declaration, or undefined when it isn't offered. */
    declaration: (name: string): KnowledgeAction | undefined => declared.get(name),
    act,
  };
};

export type KnowledgeConnection = Awaited<ReturnType<typeof connectKnowledge>>;

/** The knowledge graph's catalogue couldn't be read: the status it answered, and its problem when it gave one. */
export class KnowledgeUnavailable extends Error {
  constructor(
    readonly status: number,
    readonly problem?: KnowledgeProblem,
  ) {
    super(problem?.detail ?? `The knowledge graph didn't give its actions (HTTP ${status}).`);
    this.name = 'KnowledgeUnavailable';
  }
}
