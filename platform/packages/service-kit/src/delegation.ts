import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { appClientId, scopeWords, type ServiceIdentity, type ServiceVerifier } from './apps.js';
import { callerFromHeaders, delegationAllows, isDelegated, type Caller } from './caller.js';
import { identifyService } from './service.js';
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

/** The header a part sends the gateway with the delegated caller it received, beside its own bearer token (`withoutCallerHeaders` strips it too). */
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

/**
 * Who a route open to services is answering (contract 3, spec 8.5): a service by its own token, as
 * `identifyService` says, or an app acting for a person through the delegated caller the gateway signed
 * (`app` and `scopes` beside the person, no token of the app's own). `person` is set whenever the call is
 * made for someone: the delegated caller itself, or the person a part's onward call carries beside its
 * own token. The service then applies the smaller of the two with `delegationAllows(person, scope)`, its
 * second line behind the gateway's.
 */
export type ServiceCaller = ServiceIdentity & { person?: Caller };

/** The id the gateway gives the caller it signs for an app's own call (no person): the app itself, with `app` and `scopes` set. */
export const appCallerId = (app: string): string => `app:${app}`;
/** Whether a caller is an app on its own account rather than a person it acts for. */
export const isAppItself = (caller: Pick<Caller, 'id' | 'app'> | undefined): boolean => isDelegated(caller) && caller.id === appCallerId(caller.app);

/**
 * Who is calling a route open to services: see `ServiceCaller`. Throws `ServiceAuthUnavailable` as
 * `identifyService` does. A token names the service whatever else the call carries; the person beside an
 * app's token is kept even when the delegation names another app, so `delegationRefusal` can say so.
 */
export const identifyServiceCaller = async (headers: Record<string, string | string[] | undefined>, verify: ServiceVerifier | undefined): Promise<ServiceCaller | undefined> => {
  const caller = callerFromHeaders(headers);
  const person = isDelegated(caller) && !isAppItself(caller) ? caller : undefined;
  const service = await identifyService(headers, verify);
  if (service) return person && service.kind === 'app' ? { ...service, person } : service;
  if (person) return { kind: 'app', app: person.app, person };
  return isDelegated(caller) ? { kind: 'app', app: caller.app } : undefined;
};

/**
 * Why an app acting for a person may not do what `scope` names on this call, in words a person reads;
 * undefined when it may, or when nobody is acted for. The delegation carries the scopes the app held where
 * the call was made for, so this is the smaller of the person's access and the app's; a delegation made
 * for another app is no good to this one.
 */
export const delegationRefusal = (who: ServiceCaller, scope: string): string | undefined => {
  if (who.kind !== 'app' || !who.person) return undefined;
  if (who.person.app !== who.app) return `${who.app} can’t act on a delegation made for ${who.person.app}.`;
  return delegationAllows(who.person, scope) ? undefined : `${who.app} isn’t allowed to ${scopeWords(scope)} (${scope}) when acting for ${who.person.name}.`;
};
