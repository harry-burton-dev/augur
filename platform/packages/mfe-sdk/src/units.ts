import type { Intent, MountContext } from './contract.js';

/**
 * The standard unit intent (SDK 1.8). A unit is one place in a floor's library,
 * at any level of its shape: a collection, subcollection, series or subseries,
 * or a file. Artifacts handles it out of the box; an app links to one with a
 * `UnitRef` and opens it with `openUnit`, without knowing which app keeps them.
 */
export const UNIT_OPEN = 'unit.open';

/** The levels of a library, top down. Levels can be skipped but never reordered; the org may rename them. */
export const UNIT_LEVELS = ['collection', 'subcollection', 'series', 'subseries', 'file'] as const;
export type UnitLevel = (typeof UNIT_LEVELS)[number];

/** One unit, as apps pass it between them: enough to open it and to name it. */
export interface UnitRef {
  kind: 'unit';
  /** The app that keeps it, e.g. "folio". */
  app: string;
  /** Unique within that app. Artifacts' are `<library>/<unit>`, or the library's own id for the collection at its top. */
  id: string;
  /** Which level of the shape it is: a file is a document. */
  level: UnitLevel;
  /** What it was called when the reference was made, so the asking app can show it before opening it. */
  name: string;
}

const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** True for something shaped like a UnitRef: what another app answers is checked before it is used. */
export const isUnitRef = (v: unknown): v is UnitRef => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return r.kind === 'unit' && text(r.app, 40) && text(r.id, 200) && (UNIT_LEVELS as readonly unknown[]).includes(r.level) && text(r.name, 300);
};

/** Opens a unit in whichever app handles `unit.open`: the place, or the file, as the person may see it. */
export const openUnit = (ctx: Pick<MountContext, 'raise'>, ref: UnitRef): Promise<void> => ctx.raise({ type: UNIT_OPEN, payload: ref } satisfies Intent<UnitRef>);
