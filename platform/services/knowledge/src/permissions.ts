// Who settles and who raises on a floor, asked of AUGUR's permissions service (ADR 0085; ADR 0095 makes both
// holdable by a position or a person, set in Admin). The knowledge service asks as itself, once per request,
// for every team floor the person stands on, in batches of AuthZEN evaluations. When the permissions service
// can't answer, the answer is no: the person holds neither role anywhere until it can (D9).
import { callService, type ServiceCredentials } from '@augur/service-kit';
import type { FloorRow } from './standing.ts';

export type FloorRole = 'settler' | 'raiser';
/** The model's relation for each role, which already takes a block into account. */
const RELATION: Record<FloorRole, string> = { settler: 'can_settle', raiser: 'can_raise' };
/** The most evaluations one request to the permissions service may carry. */
export const BATCH = 50;

/** Which roles a person holds on which floors. Throws RolesUnavailable when the permissions service can't say. */
export type RolesLookup = (person: string, floors: readonly FloorRow[]) => Promise<{ floor: string; role: FloorRole }[]>;

export class RolesUnavailable extends Error {}

export const permissionsRoles = ({ permissionsUrl, credentials, fetchImpl }: { permissionsUrl: string; credentials: ServiceCredentials; fetchImpl?: typeof fetch }): RolesLookup =>
  async (person, floors) => {
    // The org and personal floors have no settler or raiser: the org is OpenFGA's org type, and a personal floor holds as memory.
    const asked = floors.filter((f) => f.kind === 'team').flatMap((f) => (Object.keys(RELATION) as FloorRole[]).map((role) => ({ floor: f.id, role })));
    const held: { floor: string; role: FloorRole }[] = [];
    for (let i = 0; i < asked.length; i += BATCH) {
      const batch = asked.slice(i, i + BATCH);
      let reply: { evaluations?: { decision?: boolean }[] };
      try {
        reply = (await callService({
          method: 'POST',
          url: `${permissionsUrl.replace(/\/$/, '')}/access/v1/evaluations`,
          credentials,
          fetchImpl,
          what: 'ask the permissions service who settles and raises',
          body: { subject: { type: 'person', id: person }, evaluations: batch.map((a) => ({ action: { name: RELATION[a.role] }, resource: { type: 'floor', id: a.floor } })) },
        })) as typeof reply;
      } catch (err) {
        throw new RolesUnavailable((err as Error).message);
      }
      const decisions = reply.evaluations ?? [];
      if (decisions.length !== batch.length) throw new RolesUnavailable(`The permissions service answered ${decisions.length} of ${batch.length} questions.`);
      batch.forEach((a, n) => {
        if (decisions[n]!.decision === true) held.push(a);
      });
    }
    return held;
  };
