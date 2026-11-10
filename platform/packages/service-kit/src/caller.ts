/**
 * The person a request is made for. The gateway verifies the sign-in token,
 * then passes the caller to services in these headers; a service behind the
 * gateway reads them and never parses tokens itself.
 */
export interface Caller {
  id: string;
  name: string;
  email?: string;
  departments: string[];
  roles: string[];
  /**
   * When they last entered their password (the token's `auth_time`). A service that needs a
   * fresh sign-in for something drastic, such as an upgrade, checks it is recent.
   */
  signedInAt?: string;
  /**
   * The floor the request is for, when the app named one (`X-Workspace-Id`)
   * and the gateway checked the caller is on it. Absent means no floor was asked for.
   */
  workspace?: CallerWorkspace;
  /**
   * The app acting for the person (contract 3, spec 8.5): set when the gateway signed a delegated
   * caller for a call made for an app, from the host's `x-augur-app` or a part's delegation. A
   * service that sees it applies the smaller of the person's access and `scopes`. Absent means the
   * person themselves, as every call was before contract 3.
   */
  app?: string;
  /** With `app`: the scopes the app is granted on this floor, which bound what the call may do. */
  scopes?: string[];
  /**
   * The admin persona the person is acting as (ADR 0086, PDR-024 "Act as"): set by the gateway only while
   * the permissions service has a live session for it. `id` stays the person, so both are recorded. Absent
   * means the person as themselves.
   */
  persona?: string;
}

export interface CallerWorkspace {
  id: string;
  kind: 'personal' | 'team' | 'org';
  /** The caller's role there; `lead` on their own floor. */
  role: 'member' | 'lead';
}

export const CALLER_HEADERS = {
  id: 'x-user-id',
  name: 'x-user-name',
  email: 'x-user-email',
  departments: 'x-user-departments',
  roles: 'x-user-roles',
  signedInAt: 'x-user-signed-in-at',
  persona: 'x-user-persona',
} as const;

/**
 * The header the shell sends while someone is acting as an admin persona: its id. The gateway checks the
 * permissions service has a live session for it before the caller carries it, and strips it before forwarding.
 */
export const PERSONA_HEADER = 'x-augur-persona';

/**
 * The header the shell's host sets on a call it makes for an app (contract 3, spec 8.5): the app's id,
 * set by the host and never by the sandbox. The gateway reads it, checks the app is on for the person on
 * that floor, and signs a delegated caller; it strips it, like every incoming `x-augur-*` header, before
 * forwarding.
 */
export const APP_HEADER = 'x-augur-app';

/** The app acting for the person, and what it may do, when a call is made for an app (contract 3). */
export const DELEGATION_HEADERS = {
  app: 'x-augur-acting-app',
  scopes: 'x-augur-acting-scopes',
} as const;

/** The floor a request is for. An app sends only the id; the gateway replaces all three once it has checked it. */
export const WORKSPACE_HEADERS = {
  id: 'x-workspace-id',
  kind: 'x-workspace-kind',
  role: 'x-workspace-role',
} as const;

const HEADER_NAMES: readonly string[] = [...Object.values(CALLER_HEADERS), ...Object.values(WORKSPACE_HEADERS), ...Object.values(DELEGATION_HEADERS), APP_HEADER, PERSONA_HEADER, 'x-augur-delegation'];
const KINDS: readonly string[] = ['personal', 'team', 'org'];

type Headers = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const decode = (v: string) => {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};
const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => decode(s.trim()))
    .filter(Boolean);

/** Headers that carry a caller. Values are URI-encoded so names and departments can hold any character. */
export const callerHeaders = (caller: Caller): Record<string, string> => ({
  [CALLER_HEADERS.id]: encodeURIComponent(caller.id),
  [CALLER_HEADERS.name]: encodeURIComponent(caller.name),
  ...(caller.email ? { [CALLER_HEADERS.email]: encodeURIComponent(caller.email) } : {}),
  [CALLER_HEADERS.departments]: caller.departments.map(encodeURIComponent).join(','),
  [CALLER_HEADERS.roles]: caller.roles.map(encodeURIComponent).join(','),
  ...(caller.signedInAt ? { [CALLER_HEADERS.signedInAt]: caller.signedInAt } : {}),
  ...(caller.persona ? { [CALLER_HEADERS.persona]: encodeURIComponent(caller.persona) } : {}),
  ...(caller.workspace
    ? {
        [WORKSPACE_HEADERS.id]: encodeURIComponent(caller.workspace.id),
        [WORKSPACE_HEADERS.kind]: caller.workspace.kind,
        [WORKSPACE_HEADERS.role]: caller.workspace.role,
      }
    : {}),
  ...(caller.app
    ? {
        [DELEGATION_HEADERS.app]: encodeURIComponent(caller.app),
        [DELEGATION_HEADERS.scopes]: (caller.scopes ?? []).map(encodeURIComponent).join(','),
      }
    : {}),
});

/**
 * Removes any caller, floor and delegation headers, so a client cannot claim to be someone, to be on a
 * floor or to act for an app. The gateway calls this on every request, after reading `x-augur-app` and
 * `x-augur-delegation` itself.
 */
export const withoutCallerHeaders = <H extends Headers>(headers: H): H =>
  Object.fromEntries(Object.entries(headers).filter(([k]) => !HEADER_NAMES.includes(k.toLowerCase()))) as H;

/** The caller the gateway passed on, or undefined when the request carries none. */
export const callerFromHeaders = (headers: Headers): Caller | undefined => {
  const id = one(headers[CALLER_HEADERS.id]);
  if (!id) return undefined;
  const email = one(headers[CALLER_HEADERS.email]);
  const signedInAt = one(headers[CALLER_HEADERS.signedInAt]);
  const floor = one(headers[WORKSPACE_HEADERS.id]);
  const kind = one(headers[WORKSPACE_HEADERS.kind]);
  const app = one(headers[DELEGATION_HEADERS.app]);
  const persona = one(headers[CALLER_HEADERS.persona]);
  return {
    id: decode(id),
    name: decode(one(headers[CALLER_HEADERS.name]) ?? id),
    ...(email ? { email: decode(email) } : {}),
    departments: list(one(headers[CALLER_HEADERS.departments])),
    roles: list(one(headers[CALLER_HEADERS.roles])),
    ...(signedInAt && !Number.isNaN(Date.parse(signedInAt)) ? { signedInAt } : {}),
    ...(floor && kind && KINDS.includes(kind)
      ? { workspace: { id: decode(floor), kind: kind as CallerWorkspace['kind'], role: one(headers[WORKSPACE_HEADERS.role]) === 'lead' ? 'lead' : 'member' } }
      : {}),
    ...(app ? { app: decode(app), scopes: list(one(headers[DELEGATION_HEADERS.scopes])) } : {}),
    ...(persona ? { persona: decode(persona) } : {}),
  };
};

/** Whether a call is made for an app rather than by the person alone (contract 3). */
export const isDelegated = (caller: Pick<Caller, 'app'> | undefined): caller is Caller & { app: string } => typeof caller?.app === 'string';

/**
 * Whether a delegated caller may do what `scope` names. A person's own call (no `app`) is not bounded
 * here: their access is the service's own check, as before. A service applies both.
 */
export const delegationAllows = (caller: Pick<Caller, 'app' | 'scopes'> | undefined, scope: string): boolean => !isDelegated(caller) || (caller.scopes ?? []).includes(scope);

/** Whether the caller entered their password within `withinMs`; false when the gateway didn't say. */
export const signedInRecently = (caller: Pick<Caller, 'signedInAt'> | undefined, withinMs: number, now = Date.now()) =>
  caller?.signedInAt !== undefined && now - Date.parse(caller.signedInAt) <= withinMs;
