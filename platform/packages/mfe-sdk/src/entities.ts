import type { Intent, MountContext } from './contract.js';
import { isDocumentRef, type DocumentRef } from './documents.js';
import { IntentError } from './intents.js';
import { isMarkingOrNone, type Marking } from './refs.js';

/**
 * The standard entity intents (SDK 1.5). Data Atlas handles them out of the box;
 * any app that points at real things (a ship, a port, a person) opens one with
 * `openEntity`, asks the person for some with `pickEntities`, and asks why one
 * shows the way it does with `explainEntity`, without knowing which app keeps them.
 */
export const ENTITY_OPEN = 'entity.open';
export const ENTITY_PICK = 'entity.pick';
export const ENTITY_EXPLAIN = 'entity.explain';
/** Offers what a passage names to the app that keeps entities, to be decided there (SDK 1.5): `proposeEntity`. */
export const ENTITY_PROPOSE = 'entity.propose';

/** One entity, as apps pass it between them: enough to open it and to name it. */
export interface EntityRef {
  kind: 'entity';
  /** `ent_` and a ULID; it never changes, and survives merges (the old id leads to the new one). */
  id: string;
  /** Its kind in the ontology, e.g. "vessel". */
  type: string;
  /** What it was called when the reference was made, so the asking app can show it before opening it. */
  label?: string;
  /** When it was meant, for a reference about a moment (an ISO date or time). Without it, now. */
  at?: string;
  /** Reserved (SDK 1.10, ADR 0029): a protective marking, kept as found and never enforced yet. */
  marking?: Marking;
}

/** What `pickEntities` asks for. */
export interface EntityPick {
  /** What the picker says it's for, e.g. "Bind to this intent". */
  purpose?: string;
  /** Kinds to offer, e.g. ["vessel", "port"]; their subkinds come too. Without it, any. */
  types?: string[];
  /** True to let the person pick more than one. */
  multiple?: boolean;
}

const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** True for something shaped like an EntityRef: what another app answers is checked before it is used. */
export const isEntityRef = (v: unknown): v is EntityRef => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    r.kind === 'entity' &&
    typeof r.id === 'string' &&
    /^ent_[0-9A-HJKMNP-TV-Z]{26}$/.test(r.id) &&
    text(r.type, 80) &&
    (r.label === undefined || text(r.label, 300)) &&
    (r.at === undefined || text(r.at, 40)) &&
    isMarkingOrNone(r.marking)
  );
};

/** Opens an entity in whichever app handles `entity.open`. */
export const openEntity = (ctx: Pick<MountContext, 'raise'>, ref: EntityRef): Promise<void> =>
  ctx.raise({ type: ENTITY_OPEN, payload: ref } satisfies Intent<EntityRef>);

/** Shows why an entity shows the way it does from here: where it's kept, and what backs it. */
export const explainEntity = (ctx: Pick<MountContext, 'raise'>, ref: EntityRef): Promise<void> =>
  ctx.raise({ type: ENTITY_EXPLAIN, payload: ref } satisfies Intent<EntityRef>);

/**
 * Asks the person to pick entities, in whichever app handles `entity.pick`. Answers
 * a list: one entity unless `multiple` is set. Rejects with IntentCancelled when they
 * close it (see isIntentCancelled), and with an IntentError when no app they can open
 * handles it or the answer isn't entities.
 */
export const pickEntities = async (ctx: Pick<MountContext, 'request'>, pick: EntityPick = {}): Promise<EntityRef[]> => {
  const answer = await ctx.request<unknown>({ type: ENTITY_PICK, payload: pick } satisfies Intent<EntityPick>);
  const refs = Array.isArray(answer) ? answer : [answer];
  if (refs.length === 0 || !refs.every(isEntityRef)) throw new IntentError('The picker answered with something that is not an entity.');
  return pick.multiple ? refs : refs.slice(0, 1);
};

/** What `proposeEntity` offers: words someone marked in a document, and where they are. */
export interface EntityProposal {
  /** The document, and the version the words were read in. */
  source: DocumentRef;
  /** The block the words are in, by its anchor in the reader copy (e.g. "p-12"). */
  anchor?: string;
  /** The words marked: what names the thing, e.g. "N. Tern". */
  text: string;
  /** The sentence or paragraph around them, so whoever decides sees them in context. */
  context?: string;
  /** What kind of thing the asking app thinks it is, e.g. "vessel". */
  type?: string;
}

/** What the app that takes a proposal answers: the proposal it made, to be decided in its Triage. */
export interface ProposalReceipt {
  /** Its id in the app that keeps it. */
  proposal: string;
  /** What to call where it went, e.g. "Maritime desk's Triage". */
  queue: string;
}

/**
 * Offers what a passage names to whichever app handles `entity.propose` (Data
 * Atlas), which asks the person what it is and files it for that floor's leads
 * to decide. Nothing becomes knowledge until they do. Rejects with
 * IntentCancelled when the person closes it, and with an IntentError when no
 * app they can open handles it or the answer isn't a receipt.
 */
export const proposeEntity = async (ctx: Pick<MountContext, 'request'>, proposal: EntityProposal): Promise<ProposalReceipt> => {
  if (!isDocumentRef(proposal.source) || !text(proposal.text, 300)) throw new IntentError('A proposal needs a document and the words that name the thing.');
  const answer = await ctx.request<unknown>({ type: ENTITY_PROPOSE, payload: proposal } satisfies Intent<EntityProposal>);
  const r = answer as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || !text(r.proposal, 80) || !text(r.queue, 300)) throw new IntentError('Whatever took the proposal answered with something that is not a receipt.');
  return { proposal: r.proposal as string, queue: r.queue as string };
};
