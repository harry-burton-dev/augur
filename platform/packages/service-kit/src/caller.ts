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
}

export const CALLER_HEADERS = {
  id: 'x-user-id',
  name: 'x-user-name',
  email: 'x-user-email',
  departments: 'x-user-departments',
  roles: 'x-user-roles',
} as const;

const HEADER_NAMES: readonly string[] = Object.values(CALLER_HEADERS);

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
});

/** Removes any caller headers, so a client cannot claim to be someone. The gateway calls this on every request. */
export const withoutCallerHeaders = <H extends Headers>(headers: H): H =>
  Object.fromEntries(Object.entries(headers).filter(([k]) => !HEADER_NAMES.includes(k.toLowerCase()))) as H;

/** The caller the gateway passed on, or undefined when the request carries none. */
export const callerFromHeaders = (headers: Headers): Caller | undefined => {
  const id = one(headers[CALLER_HEADERS.id]);
  if (!id) return undefined;
  const email = one(headers[CALLER_HEADERS.email]);
  return {
    id: decode(id),
    name: decode(one(headers[CALLER_HEADERS.name]) ?? id),
    ...(email ? { email: decode(email) } : {}),
    departments: list(one(headers[CALLER_HEADERS.departments])),
    roles: list(one(headers[CALLER_HEADERS.roles])),
  };
};
