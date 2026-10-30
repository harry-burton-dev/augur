/**
 * Relationships: typed links from one record to another, in the same app or
 * another one. A link is kept by the app whose record it starts from; the other
 * end is named by a RecordRef, so it can point at a document in Artifacts, an
 * entity in Data Atlas or an intent in Mandate without the app knowing them.
 */

/** Something a link can point at, in any app. */
export interface RecordRef {
  /** The app that keeps it, by id: `folio`, `atlas`, `mandate`. */
  app: string;
  /** What kind of thing it is there: `unit`, `entity`, `intent`. */
  kind: string;
  id: string;
  /** What it was called when the link was made, to show before it's opened. */
  label?: string;
}

/** A kind of link, read from the record it starts at, and back from the other end. */
export interface RelationDef<R extends string = string> {
  id: R;
  /** "Supersedes". */
  name: string;
  /** Read from the other end: "Superseded by". */
  inverse: string;
}

/** The kinds of link any app starts with. An app may add its own. */
export const RELATIONS = [
  { id: 'relates-to', name: 'Relates to', inverse: 'Relates to' },
  { id: 'supersedes', name: 'Supersedes', inverse: 'Superseded by' },
  { id: 'responds-to', name: 'Responds to', inverse: 'Answered by' },
  { id: 'about', name: 'About', inverse: 'Written about in' },
  { id: 'serves', name: 'Serves', inverse: 'Served by' },
] as const satisfies readonly RelationDef[];
export type Relation = (typeof RELATIONS)[number]['id'];

export const isRelation = (r: unknown): r is Relation => RELATIONS.some((d) => d.id === r);

const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** True for something shaped like a RecordRef. What a client sends is checked before it's kept. */
export const isRecordRef = (v: unknown): v is RecordRef => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return /^[a-z][a-z0-9-]{1,39}$/.test(String(r.app)) && /^[a-z][a-z-]{1,29}$/.test(String(r.kind)) && text(r.id, 100) && (r.label === undefined || text(r.label, 300));
};

/**
 * Which kind of link fits which kind of thing at the other end: `about` points
 * at entities (what a document is about), `serves` at intents (what it's for),
 * the rest at other records of the same app.
 */
export const fits = (relation: Relation, to: Pick<RecordRef, 'app' | 'kind'>, own: string) => {
  if (relation === 'about') return to.kind === 'entity';
  if (relation === 'serves') return to.kind === 'intent';
  return to.app === own;
};

/** One link, as it's kept. */
export interface Link<R extends string = Relation> {
  id: string;
  from: string;
  relation: R;
  to: RecordRef;
  by: string;
  at: string;
}
