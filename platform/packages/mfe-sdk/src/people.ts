import type { MountContext } from './contract.js';

/** Where a signed-in person finds people and teams: identity, through the gateway (identity API 1.15). */
export const DIRECTORY_PATH = '/api/identity/v1/me/directory';

/**
 * A person or a team, as the directory names them (SDK 1.12): enough to show
 * them in a picker and to share with them. It has the same shape as Quill's
 * `PeoplePicker` takes, so an app hands `searchPrincipals` straight to it.
 */
export interface DirectoryPrincipal {
  kind: 'person' | 'team';
  id: string;
  name: string;
  /** For a person, their email; for a team, where it sits ("Finance › Payroll"). */
  detail?: string;
}

export interface PrincipalSearch {
  /** `people`, `teams`, or `both` (the default). */
  kinds?: 'people' | 'teams' | 'both';
  /** The most of each kind, 1 to 50. Without it, identity's default (20). */
  limit?: number;
}

/** The directory couldn't answer. `message` says so in words a person can read. */
export class DirectoryUnavailable extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DirectoryUnavailable';
    this.status = status;
  }
}

interface Answer {
  people: { id: string; name: string; email?: string }[];
  teams: { id: string; name: string; within: string[] }[];
}

const ask = async (ctx: Pick<MountContext, 'fetch'>, query: URLSearchParams): Promise<Answer> => {
  let res: Response;
  try {
    res = await ctx.fetch(`${DIRECTORY_PATH}?${query}`, { headers: { accept: 'application/json' } });
  } catch {
    throw new DirectoryUnavailable('Can’t reach the directory. Check your connection and try again.', 0);
  }
  if (!res.ok) {
    const said = await res.json().then((b: { message?: unknown }) => (typeof b?.message === 'string' ? b.message : undefined), () => undefined);
    throw new DirectoryUnavailable(said ?? 'Can’t search people right now. Try again in a minute.', res.status);
  }
  return (await res.json()) as Answer;
};

const principals = ({ people, teams }: Answer, kinds: PrincipalSearch['kinds'] = 'both'): DirectoryPrincipal[] => [
  ...(kinds === 'teams' ? [] : people.map((p): DirectoryPrincipal => ({ kind: 'person', id: p.id, name: p.name, ...(p.email ? { detail: p.email } : {}) }))),
  ...(kinds === 'people' ? [] : teams.map((t): DirectoryPrincipal => ({ kind: 'team', id: t.id, name: t.name, ...(t.within.length ? { detail: t.within.join(' › ') } : {}) }))),
];

/**
 * Finds people and teams whose name has `query` in it (a person's email too),
 * for sharing, handing work on, or a mention. People come first, then teams,
 * each sorted by name. Teams the person isn't on are found too, as on their
 * map; people whose sign-in is off aren't. An empty query finds nothing.
 * Rejects with DirectoryUnavailable, whose message can be shown as it is.
 *
 * With Quill: `<PeoplePicker search={(q) => searchPrincipals(ctx, q)} />`.
 */
export const searchPrincipals = async (ctx: Pick<MountContext, 'fetch'>, query: string, search: PrincipalSearch = {}): Promise<DirectoryPrincipal[]> => {
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const params = new URLSearchParams({ q });
  if (search.limit !== undefined) params.set('limit', String(Math.min(50, Math.max(1, Math.round(search.limit)))));
  return principals(await ask(ctx, params), search.kinds);
};

/**
 * Names people and teams by id, so an app can show who it has shared with.
 * Ones the directory no longer knows (removed, sign-in off, team gone) are left
 * out: compare by id to tell the person which. Up to 100 at a time.
 */
export const namePrincipals = async (ctx: Pick<MountContext, 'fetch'>, refs: readonly Pick<DirectoryPrincipal, 'kind' | 'id'>[]): Promise<DirectoryPrincipal[]> => {
  const ids = [...new Set(refs.map((r) => r.id))];
  if (ids.length === 0) return [];
  if (ids.length > 100) throw new RangeError('namePrincipals names up to 100 at a time.');
  const wanted = new Set(refs.map((r) => `${r.kind}:${r.id}`));
  return principals(await ask(ctx, new URLSearchParams({ ids: ids.join(',') }))).filter((p) => wanted.has(`${p.kind}:${p.id}`));
};
