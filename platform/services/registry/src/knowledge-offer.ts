/**
 * What the deployment's knowledge graph offers apps (ADR 0079, D15), asked at install: the actions its catalogue
 * has (GET /v1/actions) and the classes its ontology has now (GET /v1/meta). Both are read without a caller, as
 * any service may. An install whose augur-floor-graphs names more is refused (release-check.ts).
 */
import { withDeadline } from '@augur/service-kit';
import type { KnowledgeOffer } from './release-check.ts';

export interface KnowledgeOfferOptions {
  /** The knowledge service inside the deployment (KNOWLEDGE_URL). */
  knowledgeUrl: string;
  fetchImpl?: typeof fetch;
}

/** Asks the knowledge graph what it offers; never throws: when it can't be asked, says why. */
export const knowledgeOffer =
  ({ knowledgeUrl, fetchImpl = fetch }: KnowledgeOfferOptions) =>
  async (): Promise<KnowledgeOffer> => {
    const get = withDeadline(fetchImpl);
    try {
      const [catalogue, meta] = await Promise.all(['actions', 'meta'].map((path) => get(`${knowledgeUrl}/v1/${path}`, { headers: { accept: 'application/json' } })));
      const failed = [catalogue!, meta!].find((r) => !r.ok);
      if (failed) return { unavailable: `the knowledge graph answered HTTP ${failed.status}.` };
      const { actions } = (await catalogue!.json()) as { actions: { name: string }[] };
      const { ontology } = (await meta!.json()) as { ontology: { classes?: string[]; baseClasses?: string[] } };
      // A knowledge graph from before 1.6 gives only its base classes.
      return { actions: actions.map((a) => a.name), classes: ontology.classes ?? ontology.baseClasses ?? [] };
    } catch {
      return { unavailable: 'the knowledge graph couldn’t be reached.' };
    }
  };
