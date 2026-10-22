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
   * The floor the request is for, when the app named one (`X-Workspace-Id`)
   * and the gateway checked the caller is on it. Absent means no floor was asked for.
   */
  workspace?: CallerWorkspace;
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
} as const;

/** The floor a request is for. An app sends only the id; the gateway replaces all three once it has checked it. */
export const WORKSPACE_HEADERS = {
  id: 'x-workspace-id',
  kind: 'x-workspace-kind',
  role: 'x-workspace-role',
} as const;

const HEADER_NAMES: readonly string[] = [...Object.values(CALLER_HEADERS), ...Object.values(WORKSPACE_HEADERS)];
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
  ...(caller.workspace
    ? {
        [WORKSPACE_HEADERS.id]: encodeURIComponent(caller.workspace.id),
        [WORKSPACE_HEADERS.kind]: caller.workspace.kind,
        [WORKSPACE_HEADERS.role]: caller.workspace.role,
      }
    : {}),
});

/** Removes any caller and floor headers, so a client cannot claim to be someone or to be on a floor. The gateway calls this on every request. */
export const withoutCallerHeaders = <H extends Headers>(headers: H): H =>
  Object.fromEntries(Object.entries(headers).filter(([k]) => !HEADER_NAMES.includes(k.toLowerCase()))) as H;

/** The caller the gateway passed on, or undefined when the request carries none. */
export const callerFromHeaders = (headers: Headers): Caller | undefined => {
  const id = one(headers[CALLER_HEADERS.id]);
  if (!id) return undefined;
  const email = one(headers[CALLER_HEADERS.email]);
  const floor = one(headers[WORKSPACE_HEADERS.id]);
  const kind = one(headers[WORKSPACE_HEADERS.kind]);
  return {
    id: decode(id),
    name: decode(one(headers[CALLER_HEADERS.name]) ?? id),
    ...(email ? { email: decode(email) } : {}),
    departments: list(one(headers[CALLER_HEADERS.departments])),
    roles: list(one(headers[CALLER_HEADERS.roles])),
    ...(floor && kind && KINDS.includes(kind)
      ? { workspace: { id: decode(floor), kind: kind as CallerWorkspace['kind'], role: one(headers[WORKSPACE_HEADERS.role]) === 'lead' ? 'lead' : 'member' } }
      : {}),
  };
};
