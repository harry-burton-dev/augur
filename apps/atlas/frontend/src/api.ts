import type { MountContext } from '@augur/mfe-sdk';

export interface DetailDef {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'date';
  identity: boolean;
  pattern?: string;
  hint?: string;
}

export interface TypeDef {
  key: string;
  label: string;
  plural: string;
  parent?: string;
  abstract: boolean;
  icon: string;
  pack: string;
  packTerm: string;
  details: DetailDef[];
}

export interface Ontology {
  version: number;
  types: TypeDef[];
}

/** What the caller may do with an entity, and why not when they can't. */
export interface EntityRights {
  edit: boolean;
  retire: boolean;
  why?: string;
}

export interface Entity {
  id: string;
  type: string;
  label: string;
  aliases: string[];
  description: string;
  details: Record<string, string>;
  workspace: string;
  floor: string;
  /** Where it's kept, as people know it: "Org", "You", a team's name. */
  floorName: string;
  state: 'active' | 'retired';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  can: EntityRights;
}

export interface EntityFields {
  type?: string;
  label?: string;
  aliases?: string[];
  description?: string;
  details?: Record<string, string>;
}

/** A refusal, in words people can act on, with what the service said about it. */
export class AtlasError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Data Atlas's service, through the gateway, on the floor the person is standing on. */
export class AtlasApi {
  constructor(private readonly fetchOnFloor: MountContext['fetch']) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchOnFloor(`/api/atlas/v1${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const problem = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new AtlasError(res.status >= 500 || !problem.message ? 'Data Atlas isn’t answering. Try again in a moment.' : problem.message, res.status, problem.error, problem);
    }
    return (await res.json()) as T;
  }

  ontology() {
    return this.call<Ontology>('GET', '/ontology');
  }

  entities(query: { q?: string; type?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return this.call<{ entities: Entity[]; total: number; floors: string[]; seeing: string[] }>('GET', `/entities${params.size ? `?${params}` : ''}`);
  }

  entity(id: string) {
    return this.call<Entity>('GET', `/entities/${encodeURIComponent(id)}`);
  }

  createEntity(fields: Required<Pick<EntityFields, 'type' | 'label'>> & EntityFields) {
    return this.call<Entity>('POST', '/entities', fields);
  }

  updateEntity(id: string, fields: EntityFields) {
    return this.call<Entity>('PATCH', `/entities/${encodeURIComponent(id)}`, fields);
  }

  retireEntity(id: string) {
    return this.call<Entity>('POST', `/entities/${encodeURIComponent(id)}/retire`);
  }
}

/** Where the person is in Data Atlas, as its address has it. */
export type Place = { page: 'entities' } | { page: 'new' } | { page: 'entity'; id: string };

export const placeFor = (path: string): Place => {
  const [first, second] = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (first === 'entities' && second === 'new') return { page: 'new' };
  if (first === 'entities' && second) return { page: 'entity', id: second };
  return { page: 'entities' };
};

export const pathFor = (place: Place) => (place.page === 'entity' ? `/entities/${encodeURIComponent(place.id)}` : place.page === 'new' ? '/entities/new' : '/entities');

/** A type's details, its own after those of the kinds above it. */
export const detailsOf = (ontology: Ontology, type: string): DetailDef[] => {
  const byKey = new Map(ontology.types.map((t) => [t.key, t]));
  const chain: TypeDef[] = [];
  for (let t = byKey.get(type); t; t = t.parent ? byKey.get(t.parent) : undefined) chain.unshift(t);
  return chain.flatMap((t) => t.details);
};

/** Types in tree order, with how deep each sits, for a picker. */
export const typeTree = (ontology: Ontology): { type: TypeDef; depth: number }[] => {
  const out: { type: TypeDef; depth: number }[] = [];
  const walk = (parent: string | undefined, depth: number) => {
    for (const t of ontology.types.filter((t) => t.parent === parent)) {
      out.push({ type: t, depth });
      walk(t.key, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
};

/** One line saying what an entity is: its kind, its identity keys, where it's kept. */
export const entityLine = (ontology: Ontology | undefined, e: Entity) => {
  const type = ontology?.types.find((t) => t.key === e.type);
  const keys = ontology
    ? detailsOf(ontology, e.type)
        .filter((d) => d.identity && e.details[d.key])
        .map((d) => `${d.label} ${e.details[d.key]}`)
    : [];
  return [type?.label ?? e.type, ...keys, `Kept on ${e.floorName}`].join(' · ');
};
