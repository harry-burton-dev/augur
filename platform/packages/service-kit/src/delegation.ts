import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { appClientId } from './apps.js';
import type { Caller } from './caller.js';
import { CALLER_ISSUER, callerFromClaims, CallerKeysUnavailable, CallerTokenError, type CallerSigner } from './signed-caller.js';

/**
 * Acting for a person (contract 3, spec 8.5). When the host calls the gateway for an app, the gateway
 * signs a delegated caller: the signed caller of signed-caller.ts with `app` and `scopes` added,
 * audience `app-<id>`, lasting `APP_DELEGATION_SECONDS` rather than a minute. The app's inbound part
 * receives it as `x-augur-caller`. When the part in turn calls AUGUR for that person, it sends its own
 * app token plus that delegated caller in `x-augur-delegation`; the gateway checks the delegation and
 * signs a fresh one-minute caller for the target carrying the same person, floor, app and scopes. No
 * token for the person ever reaches a part.
 */

/** The header a part sends the gateway with the delegated caller it received, beside its own bearer token. */
export const DELEGATION_HEADER = 'x-augur-delegation';
/** How long a delegated caller lasts unless the deployment says (`APP_DELEGATION_SECONDS`). */
export const DEFAULT_DELEGATION_SECONDS = 300;

/** The setting that changes how long a delegated caller lasts. */
export const DELEGATION_SECONDS_SETTING = 'APP_DELEGATION_SECONDS';
export const delegationSecondsFromEnv = (env = process.env): number => {
  const raw = env[DELEGATION_SECONDS_SETTING];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DELEGATION_SECONDS;
};

export interface DelegationOptions {
  /** The app acting; the token's audience is its client, `app-<id>`. */
  app: string;
  /** The scopes the app is granted on the caller's floor, which bound the call. */
  scopes: readonly string[];
  lifetimeSeconds?: number;
}

/** The caller with the app and its scopes added: what a delegated caller names. */
export const delegatedCaller = (caller: Caller, { app, scopes }: Pick<DelegationOptions, 'app' | 'scopes'>): Caller => ({ ...caller, app, scopes: [...scopes] });

/** Signs a delegated caller for the app's inbound part (audience `app-<id>`). The gateway alone does this. */
export const signDelegation = (signer: CallerSigner, caller: Caller, { app, scopes, lifetimeSeconds = DEFAULT_DELEGATION_SECONDS }: DelegationOptions): Promise<string> =>
  signer.sign(delegatedCaller(caller, { app, scopes }), appClientId(app), { lifetimeSeconds });

/** A delegation that is missing, forged, expired, for another app, or not a delegation at all. */
export class DelegationError extends CallerTokenError {}

export interface DelegationCheckOptions {
  keys: JWTVerifyGetKey;
}

/**
 * Checks a delegation a part sent back: it must be a signed caller for that app (audience `app-<id>`),
 * still valid, and its `app` claim must be the app whose token made the call, so one app can't present
 * another's delegation. Returns the caller it names, `app` and `scopes` included.
 */
export const delegationCheck =
  ({ keys }: DelegationCheckOptions) =>
  async (token: string, app: string): Promise<Caller> => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer: CALLER_ISSUER, audience: appClientId(app), algorithms: ['EdDSA'], clockTolerance: 10 });
      if (!payload.sub) throw new DelegationError('The delegation names nobody.');
      if (payload.app !== app) throw new DelegationError(`The delegation is for ${typeof payload.app === 'string' ? payload.app : 'no app'}, not ${app}.`);
      return callerFromClaims(payload);
    } catch (err) {
      if (err instanceof CallerTokenError) throw err;
      if (err instanceof errors.JWKSTimeout || !(err instanceof errors.JOSEError)) throw new CallerKeysUnavailable((err as Error).message);
      throw new DelegationError(err.code === 'ERR_JWT_EXPIRED' ? 'The delegation has expired.' : 'The delegation is not valid.');
    }
  };

export type DelegationCheck = ReturnType<typeof delegationCheck>;
