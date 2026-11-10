import { readFileSync } from 'node:fs';
import { withDeadline } from '@augur/service-kit';

/**
 * The permissions service's only way to OpenFGA: its HTTP API (https://openfga.dev/api/service), kept to the
 * calls the service makes. OpenFGA holds the relationships and answers checks; this service owns which model
 * it runs and what callers may ask.
 */

/** An authorization model as OpenFGA's API takes it: the JSON `fga model transform` makes from model/fga.mod. */
export interface AuthorizationModel {
  schema_version: string;
  type_definitions: TypeDefinition[];
  conditions?: Record<string, unknown>;
}

export interface TypeDefinition {
  type: string;
  relations?: Record<string, unknown>;
  metadata?: unknown;
}

/** The model this release runs: model/core.json, which CI checks is what model/fga.mod says. */
export const loadModel = (url = new URL('../model/core.json', import.meta.url)): AuthorizationModel =>
  JSON.parse(readFileSync(url, 'utf8')) as AuthorizationModel;

/** The relations each type of a model has, for checking what callers ask before OpenFGA sees it. */
export const relationsOf = (model: AuthorizationModel): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(model.type_definitions.map((t) => [t.type, new Set(Object.keys(t.relations ?? {}))]));

/** What a check is: OpenFGA's tuple key, `type:id` on both sides. */
export interface CheckKey {
  user: string;
  relation: string;
  object: string;
}

/** How fresh an answer must be (D8 in the spec): HIGHER_CONSISTENCY skips OpenFGA's caches. */
export type Consistency = 'MINIMIZE_LATENCY' | 'HIGHER_CONSISTENCY';

/** OpenFGA could not be reached or refused the call; a check that can't be answered is refused, never let through. */
export class OpenFgaUnavailable extends Error {}

export interface OpenFgaOptions {
  url: string;
  /** OpenFGA's preshared key, when it is set to need one. */
  token?: string;
  fetchImpl?: typeof fetch;
}

/** One answer of a batch, by the position of its check. */
export type BatchAnswer = { allowed: boolean } | { error: string };

export class OpenFga {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenFgaOptions) {
    this.base = options.url.replace(/\/$/, '');
    this.fetchImpl = withDeadline(options.fetchImpl ?? fetch);
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(this.options.token ? { authorization: `Bearer ${this.options.token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (err) {
      throw new OpenFgaUnavailable(`OpenFGA could not be reached (${(err as Error).message})`);
    }
    const text = await res.text();
    if (!res.ok) throw new OpenFgaUnavailable(`OpenFGA answered ${res.status} to ${method} ${path.replace(/\/stores\/[^/]+/, '/stores/…')}: ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** The store with this name, made when there is none. */
  async ensureStore(name: string): Promise<string> {
    const { stores = [] } = await this.call<{ stores?: { id: string; name: string }[] }>('GET', `/stores?name=${encodeURIComponent(name)}`);
    const found = stores.find((s) => s.name === name);
    if (found) return found.id;
    const made = await this.call<{ id: string }>('POST', '/stores', { name });
    return made.id;
  }

  /**
   * The id of the store's model that matches `model`. A model can't be changed in OpenFGA, only added, so a
   * release with a different model writes a new one and the earlier one stays for an earlier release.
   */
  async ensureModel(store: string, model: AuthorizationModel): Promise<string> {
    const { authorization_models: latest = [] } = await this.call<{ authorization_models?: ({ id: string } & AuthorizationModel)[] }>(
      'GET',
      `/stores/${store}/authorization-models?page_size=1`,
    );
    const current = latest[0];
    if (current && sameModel(current, model)) return current.id;
    const written = await this.call<{ authorization_model_id: string }>('POST', `/stores/${store}/authorization-models`, model);
    return written.authorization_model_id;
  }

  async check(store: string, model: string, key: CheckKey, context: Record<string, unknown>, consistency: Consistency): Promise<boolean> {
    const { allowed } = await this.call<{ allowed?: boolean }>('POST', `/stores/${store}/check`, {
      tuple_key: key,
      authorization_model_id: model,
      context,
      consistency,
    });
    return allowed === true;
  }

  /** Several checks in one call (OpenFGA's BatchCheck), answered in the order they were asked. */
  async batchCheck(store: string, model: string, keys: readonly CheckKey[], context: Record<string, unknown>, consistency: Consistency): Promise<BatchAnswer[]> {
    if (keys.length === 0) return [];
    const ids = keys.map((_, i) => `c${i}`);
    const { result = {} } = await this.call<{ result?: Record<string, { allowed?: boolean; error?: { message?: string } }> }>(
      'POST',
      `/stores/${store}/batch-check`,
      { authorization_model_id: model, consistency, checks: keys.map((tuple_key, i) => ({ tuple_key, context, correlation_id: ids[i] })) },
    );
    return ids.map((id) => {
      const r = result[id];
      if (!r) return { error: 'OpenFGA gave no answer for this check.' };
      if (r.error) return { error: r.error.message ?? 'OpenFGA could not answer this check.' };
      return { allowed: r.allowed === true };
    });
  }

  /** Every relationship in the store, page by page (OpenFGA's Read with no filter). */
  async readAll(store: string, pageSize = 100): Promise<CheckKey[]> {
    const all: CheckKey[] = [];
    let token = '';
    do {
      const page = await this.call<{ tuples?: { key: CheckKey }[]; continuation_token?: string }>('POST', `/stores/${store}/read`, {
        page_size: pageSize,
        ...(token ? { continuation_token: token } : {}),
      });
      for (const t of page.tuples ?? []) all.push({ user: t.key.user, relation: t.key.relation, object: t.key.object });
      token = page.continuation_token ?? '';
    } while (token);
    return all;
  }

  /**
   * Writes and deletes relationships, at most `perCall` to a call (OpenFGA's own limit is 100). One already
   * there or already gone is no error, so a write that is repeated after a failure lands the same.
   */
  async write(store: string, model: string, writes: readonly CheckKey[], deletes: readonly CheckKey[], perCall = 100): Promise<void> {
    const changes = [...writes.map((key) => ({ key, write: true })), ...deletes.map((key) => ({ key, write: false }))];
    for (let i = 0; i < changes.length; i += perCall) {
      const chunk = changes.slice(i, i + perCall);
      const adds = chunk.filter((c) => c.write).map((c) => c.key);
      const removes = chunk.filter((c) => !c.write).map((c) => c.key);
      await this.call('POST', `/stores/${store}/write`, {
        authorization_model_id: model,
        ...(adds.length ? { writes: { tuple_keys: adds, on_duplicate: 'ignore' } } : {}),
        ...(removes.length ? { deletes: { tuple_keys: removes, on_missing: 'ignore' } } : {}),
      });
    }
  }

  async healthy(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.base}/healthz`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

/** Whether OpenFGA's stored model says the same as ours; OpenFGA adds an id and may leave out empty fields. */
export const sameModel = (stored: AuthorizationModel, ours: AuthorizationModel): boolean => {
  const norm = (m: AuthorizationModel) =>
    stable({ schema_version: m.schema_version, type_definitions: m.type_definitions, conditions: m.conditions && Object.keys(m.conditions).length ? m.conditions : undefined });
  return norm(stored) === norm(ours);
};

/** JSON with keys sorted, and nulls, empty strings, arrays and objects left out (OpenFGA fills in `object: ''` and empty lists), so two equal models compare equal. */
const stable = (value: unknown): string => JSON.stringify(prune(value));
const prune = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.length ? value.map(prune) : undefined;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => [k, prune(v)] as const)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value;
};
