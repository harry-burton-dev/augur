import type { MountContext } from '@augur/mfe-sdk';

export interface DetailDef {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'date';
  identity: boolean;
  pattern?: string;
  hint?: string;
  /** False when it's known only through facts, not typed on the entity. */
  onEntity?: boolean;
}

/** A kind of link from one entity to another, read forwards (`label`) or backwards (`inverse`). */
export interface RelationDef {
  key: string;
  label: string;
  inverse: string;
  from: string[];
  to: string[];
  pack: string;
  packTerm: string;
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
  relations: RelationDef[];
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

/** The entity at the other end of a link, or why it doesn't show from here. */
export type OtherEnd =
  | { kind: 'entity'; id: string; type: string; label: string; state: Entity['state']; floorName: string }
  | { id: string; hidden: true; reason: 'elsewhere' | 'kept'; floor: string; message: string }
  | { id: string; missing: true };

export type Source = { kind: 'person' } | { kind: 'document'; document: { app: string; id: string; version?: string; title: string } } | { kind: 'other'; note: string };

export interface Dispute {
  id: string;
  fact: string;
  floorName: string;
  note: string;
  by: string;
  at: string;
  mine: boolean;
}

/** A fact as the caller sees it: what a floor accepts as so, on two clocks. */
export interface FactView {
  id: string;
  entity: string;
  property: string;
  value?: string;
  target?: string;
  /** `in` when this entity is the far end of someone else's link. */
  direction: 'out' | 'in';
  other?: OtherEnd;
  validFrom?: string;
  validTo?: string;
  floor: string;
  floorName: string;
  backedBy: string[];
  note: string;
  recordedAt: string;
  disputes: Dispute[];
  can: { end: boolean; withdraw: boolean; dispute: boolean; why?: string };
}

/** An observation as the caller sees it: what someone saw or read, as they said it. */
export interface ObservationView {
  id: string;
  entity: string;
  property: string;
  value?: string;
  target?: string;
  direction: 'out' | 'in';
  other?: OtherEnd;
  observedAt?: string;
  floor: string;
  floorName: string;
  source: Source;
  grade?: string;
  note: string;
  raisedFrom?: string;
  raisedTo: string[];
  createdBy: string;
  createdAt: string;
  can: { accept: boolean; raise: boolean; raiseTo: { floor: string; name: string }[]; why?: string };
}

export interface Knowledge {
  at: string | null;
  known: string | null;
  /** What the person may do on the floor they stand on: leads accept and raise. */
  here: { floorName: string; accept: boolean; why?: string };
  facts: FactView[];
  observations: ObservationView[];
}

export interface NewObservation {
  property: string;
  value?: string;
  target?: string;
  observedAt?: string;
  source: Source;
  grade?: string;
  note?: string;
  accept?: boolean;
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

  /** What shows from this floor; `type` takes one kind or several, each with its subkinds. */
  entities(query: { q?: string; type?: string | string[]; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams(
      Object.entries(query).flatMap(([k, v]) => (v === undefined || v === '' ? [] : (Array.isArray(v) ? v : [v]).map((one) => [k, String(one)]))),
    );
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

  /** What's known about an entity: true at `at`, as recorded by `known` (both now when left out). */
  knowledge(id: string, when: { at?: string; known?: string } = {}) {
    const params = new URLSearchParams(Object.entries(when).filter((e): e is [string, string] => !!e[1]));
    return this.call<Knowledge>('GET', `/entities/${encodeURIComponent(id)}/knowledge${params.size ? `?${params}` : ''}`);
  }

  observe(id: string, observation: NewObservation) {
    return this.call<{ observation: ObservationView; fact?: FactView }>('POST', `/entities/${encodeURIComponent(id)}/observations`, observation);
  }

  acceptFact(id: string, fact: { backedBy: string[]; validFrom?: string; validTo?: string; note?: string }) {
    return this.call<FactView>('POST', `/entities/${encodeURIComponent(id)}/facts`, fact);
  }

  endFact(id: string, validTo?: string) {
    return this.call<FactView>('POST', `/facts/${encodeURIComponent(id)}/end`, validTo ? { validTo } : {});
  }

  withdrawFact(id: string) {
    return this.call<FactView>('POST', `/facts/${encodeURIComponent(id)}/withdraw`);
  }

  dispute(fact: string, note: string) {
    return this.call<Dispute>('POST', `/facts/${encodeURIComponent(fact)}/disputes`, { note });
  }

  clearDispute(id: string) {
    return this.call<Dispute>('POST', `/disputes/${encodeURIComponent(id)}/clear`);
  }

  raise(observation: string, to: string) {
    return this.call<ObservationView>('POST', `/observations/${encodeURIComponent(observation)}/raise`, { to });
  }
}

/** Where the person is in Data Atlas, as its address has it. */
export type Place = { page: 'entities' } | { page: 'new' } | { page: 'entity'; id: string; explain?: boolean };

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

/** The details typed on the entity itself; the rest are known through facts. */
export const onEntity = (ontology: Ontology, type: string) => detailsOf(ontology, type).filter((d) => d.onEntity !== false);

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

/** Why an entity shows from the floor the person stands on, in a sentence (explain, never hide). */
export const whyShown = (e: Pick<Entity, 'floor' | 'floorName'>, floorKind: string, floorName: string) => {
  if (e.floor === 'org') return 'It’s kept on the org floor, and what’s on the org floor shows on every floor.';
  if (e.floor.startsWith('person:')) return 'It’s kept on your own floor: only you see it.';
  const team = e.floorName === 'A team' ? 'a team' : e.floorName;
  if (floorKind === 'personal') return `It’s kept on ${team}, one of your teams. Your own floor shows everything you can reach.`;
  if (floorKind === 'team' && e.floorName === floorName) return 'It’s kept on this floor.';
  return `It’s kept on ${team}, a floor above this one, and what’s kept above shows below.`;
};

/** True when `type` is `kind` or a kind below it. */
export const isA = (ontology: Ontology, type: string, kind: string) => {
  const byKey = new Map(ontology.types.map((t) => [t.key, t]));
  for (let t = byKey.get(type); t; t = t.parent ? byKey.get(t.parent) : undefined) if (t.key === kind) return true;
  return false;
};

/**
 * What can be observed of an entity of this type: first the details known only
 * through facts, then the links it can start, then the details on the entity.
 */
export const propertiesOf = (ontology: Ontology, type: string) => {
  const details = detailsOf(ontology, type).map((d) => ({ key: d.key, label: d.label, link: undefined as RelationDef | undefined, detail: d as DetailDef | undefined }));
  return [
    ...details.filter((d) => d.detail?.onEntity === false),
    ...ontology.relations.filter((r) => r.from.some((k) => isA(ontology, type, k))).map((r) => ({ key: r.key, label: r.label, link: r as RelationDef | undefined, detail: undefined })),
    ...details.filter((d) => d.detail?.onEntity !== false),
  ];
};

/** A floor's name in a sentence: "your own floor", "the org floor", or the team's name. */
export const floorWords = (name: string) => (name === 'You' ? 'your own floor' : name === 'Org' ? 'the org floor' : name);

/** A property's name, read from this entity's side: a link that comes in reads backwards. */
export const propertyLabel = (ontology: Ontology | undefined, entityType: string, key: string, direction: 'out' | 'in' = 'out') => {
  const relation = ontology?.relations.find((r) => r.key === key);
  if (relation) return direction === 'in' ? relation.inverse : relation.label;
  return (ontology && detailsOf(ontology, entityType).find((d) => d.key === key)?.label) ?? key;
};

/** What a fact or observation says, from this entity's side: "Flag state: Panama", "Operated by Northwind". */
export const saying = (ontology: Ontology | undefined, entityType: string, x: { property: string; value?: string; other?: OtherEnd; direction: 'out' | 'in' }) => {
  const label = propertyLabel(ontology, entityType, x.property, x.direction);
  if (x.value !== undefined) return `${label}: ${x.value}`;
  const other = x.other;
  if (!other || 'missing' in other) return `${label} an entity that no longer exists`;
  if ('hidden' in other) return `${label} an entity you can’t see from here`;
  return `${label} ${other.label}`;
};

/** A day, as people write it: 1 Sep 2026. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const day = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** When a fact holds, in words. */
export const span = (f: { validFrom?: string; validTo?: string }) =>
  f.validFrom && f.validTo ? `${day(f.validFrom)} to ${day(f.validTo)}` : f.validFrom ? `Since ${day(f.validFrom)}` : f.validTo ? `Until ${day(f.validTo)}` : 'No dates given';

/** Where an observation came from, in a few words. */
export const sourceLine = (s: Source) => (s.kind === 'person' ? 'Seen or heard by whoever recorded it' : s.kind === 'document' ? `From ${s.document.title}` : s.note);
