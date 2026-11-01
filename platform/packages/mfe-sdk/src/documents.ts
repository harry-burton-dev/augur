import type { Intent, MountContext } from './contract.js';
import { IntentError } from './intents.js';
import { isMarkingOrNone, type Marking } from './refs.js';

/**
 * The standard document intents (SDK 1.4). Any app may handle them by listing
 * them in its manifest's `handles`; Folio does out of the box. An app that keeps
 * documents opens one with `openDocument`, and asks the person for one with
 * `pickDocument`, without knowing which app holds them.
 */
export const DOCUMENT_OPEN = 'document.open';
export const DOCUMENT_PICK = 'document.pick';
/** Opens a whole library of documents: `openLibrary`. */
export const LIBRARY_OPEN = 'library.open';

/** One document, as apps pass it between them: enough to open it and to name it. */
export interface DocumentRef {
  /** The app that keeps it, e.g. "folio". */
  app: string;
  /** Unique within that app. */
  id: string;
  /** The version meant, when it matters; without it, the latest the person may read. */
  version?: string;
  /** What to call it, so the asking app can show it before opening it. */
  title: string;
  /** Reserved (SDK 1.10, ADR 0029): a protective marking, kept as found and never enforced yet. */
  marking?: Marking;
}

/** A library of documents, as apps pass it between them. */
export interface LibraryRef {
  /** The app that keeps it, e.g. "folio". */
  app: string;
  /** Unique within that app. */
  id: string;
  /** What to call it. */
  name: string;
}

/** What `pickDocument` asks for. */
export interface DocumentPick {
  /** What the picker says it's for, e.g. "Attach a policy". */
  purpose?: string;
  /** Media types to offer, e.g. ["application/pdf"]. Without it, any. */
  accept?: string[];
}

const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** True for something shaped like a DocumentRef: what another app answers is checked before it is used. */
export const isDocumentRef = (v: unknown): v is DocumentRef => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return text(r.app, 40) && text(r.id, 200) && text(r.title, 300) && (r.version === undefined || text(r.version, 40)) && isMarkingOrNone(r.marking);
};

/** True for something shaped like a LibraryRef. */
export const isLibraryRef = (v: unknown): v is LibraryRef => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return text(r.app, 40) && text(r.id, 200) && text(r.name, 300);
};

/** Opens a library in whichever app handles `library.open`. */
export const openLibrary = (ctx: Pick<MountContext, 'raise'>, ref: LibraryRef): Promise<void> =>
  ctx.raise({ type: LIBRARY_OPEN, payload: ref } satisfies Intent<LibraryRef>);

/** Opens a document in whichever app handles `document.open`. */
export const openDocument = (ctx: Pick<MountContext, 'raise'>, ref: DocumentRef): Promise<void> =>
  ctx.raise({ type: DOCUMENT_OPEN, payload: ref } satisfies Intent<DocumentRef>);

/**
 * Asks the person to pick a document, in whichever app handles `document.pick`.
 * Rejects with IntentCancelled when they close it (see isIntentCancelled), and
 * with an IntentError when no app they can open handles it or the answer isn't a DocumentRef.
 */
export const pickDocument = async (ctx: Pick<MountContext, 'request'>, pick: DocumentPick = {}): Promise<DocumentRef> => {
  const answer = await ctx.request<unknown>({ type: DOCUMENT_PICK, payload: pick } satisfies Intent<DocumentPick>);
  if (!isDocumentRef(answer)) throw new IntentError('The picker answered with something that is not a document.');
  return answer;
};
