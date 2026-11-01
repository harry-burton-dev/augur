import type { EntityRef } from './entities.js';

/**
 * A protective marking on a piece of information (SDK 1.10), such as how widely
 * it may be shared. Reserved: nothing sets or enforces markings yet, because
 * whether a deployment marks its information, and with which scheme, is still
 * open (ADR 0029). An app that carries a `Ref` keeps its `marking` as it found
 * it, so marked data stays marked once a scheme is chosen.
 */
export interface Marking {
  /** The scheme the label comes from, as the deployment names it. */
  scheme: string;
  /** The marking as people read it, in that scheme. */
  label: string;
}

/**
 * Anything an app keeps, as apps pass it between them (SDK 1.10): which app,
 * what kind of thing, which one, and what to call it. Use it where no more
 * specific reference (DocumentRef, UnitRef, EntityRef) fits, such as the
 * subject of a binding to an entity (ADR 0025).
 */
export interface Ref {
  kind: 'ref';
  /** The app that keeps it, e.g. "intent". */
  app: string;
  /** Its kind within that app, e.g. "task". */
  type: string;
  /** Unique within that app and kind. */
  id: string;
  /** What it was called when the reference was made, so another app can show it without asking. */
  label?: string;
  /** Reserved (ADR 0029): kept as found, never enforced yet. */
  marking?: Marking;
}

/**
 * What an app publishes, as `<app>.bound` or `<app>.unbound` through its outbox
 * (SDK 1.10, ADR 0025), when someone links one of its things to an entity or
 * takes the link away. The app keeps its bindings itself; Data Atlas follows
 * these events to answer "what points at this entity".
 */
export interface EntityBinding {
  /** The app's own thing. */
  subject: Ref;
  /** The entity it is about. */
  entity: EntityRef;
}

/**
 * The working context someone has chosen inside a floor (SDK 1.10), such as
 * "Operation Alpha, phase 2". Reserved (ADR 0029): the shell doesn't let anyone
 * choose one yet, so `ctx.focus` is always undefined for now. An app that
 * declares `focus: true` in its manifest should treat undefined as "the whole
 * floor", which is what it means today.
 */
export interface Focus {
  /** The thing the work is under, in whichever app keeps it. */
  ref: Ref;
  /** How the shell names the context to people, e.g. "Operation Alpha · Phase 2". */
  label: string;
}

const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** True for something shaped like a Marking, or for no marking at all. */
export const isMarkingOrNone = (v: unknown): v is Marking | undefined => {
  if (v === undefined) return true;
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return text(m.scheme, 40) && text(m.label, 80);
};

/** True for something shaped like a Ref: what another app answers is checked before it is used. */
export const isRef = (v: unknown): v is Ref => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    r.kind === 'ref' &&
    text(r.app, 40) &&
    text(r.type, 80) &&
    text(r.id, 200) &&
    (r.label === undefined || text(r.label, 300)) &&
    isMarkingOrNone(r.marking)
  );
};
