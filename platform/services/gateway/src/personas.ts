import { callerHeaders, GATEWAY_CALLER, signedCallerHeaders, withDeadline, type CallerSigner } from '@augur/service-kit';

/**
 * Whether a person is acting as an admin persona now (ADR 0086, PDR-024 "Act as"): the permissions service
 * keeps the sessions. Throws PersonaSessionsUnavailable when that can't be found out, and the gateway then
 * refuses: a call never acts as a persona on an old answer.
 */
export type PersonaSessionCheck = (person: string, persona: string) => Promise<boolean>;

export class PersonaSessionsUnavailable extends Error {}

/** A persona's id as the permissions service gives them: letters, digits, dots, dashes and underscores. */
export const PERSONA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export const permissionsPersonaSessions =
  ({ permissionsUrl, signer, fetchImpl = fetch }: { permissionsUrl: string; signer?: CallerSigner; fetchImpl?: typeof fetch }): PersonaSessionCheck =>
  async (person, persona) => {
    let res: Response;
    try {
      const headers = { 'content-type': 'application/json', ...callerHeaders(GATEWAY_CALLER), ...(signer ? await signedCallerHeaders(signer, GATEWAY_CALLER, 'permissions') : {}) };
      res = await withDeadline(fetchImpl)(`${permissionsUrl.replace(/\/$/, '')}/access/v1/persona-session`, { method: 'POST', headers, body: JSON.stringify({ person, persona }) });
    } catch (err) {
      throw new PersonaSessionsUnavailable(`the permissions service could not be reached (${(err as Error).message})`);
    }
    if (!res.ok) throw new PersonaSessionsUnavailable(`the permissions service answered ${res.status}`);
    const body = (await res.json()) as { live?: unknown };
    return body.live === true;
  };
