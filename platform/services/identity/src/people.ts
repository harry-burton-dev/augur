import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GrantsUnavailable, identifyService, ServiceAuthUnavailable, type GrantLookup, type ServiceVerifier } from '@augur/service-kit';
import type { Person } from './directory.ts';
import type { TeamDirectory } from './teams.ts';
import type { Workspace, WorkspaceStore } from './workspaces.ts';

/** The scope an app needs to look people and teams up. */
export const PEOPLE_SCOPE = 'people:read';

/** How long the directory's list of people is kept: the sign-in service is slow to ask, and a new person shows within this. */
const PEOPLE_TTL_MS = 30_000;
const MAX_RESULTS = 50;

export interface PeopleOptions {
  workspaces: WorkspaceStore;
  /** Where people are kept. Without it only teams can be found. */
  teams?: TeamDirectory;
  verifyService?: ServiceVerifier;
  /** What apps are granted, from the registry. Without it only the platform's own services may ask. */
  grants?: GrantLookup;
  now?: () => number;
}

/**
 * The principals a person stands for, which apps match against who they let
 * see something: `person:<id>`; `team:<id>` for each team they're on;
 * `tree:<id>` for each of those teams and every team above it (shared with
 * someone on a team below); and `org`, which everyone is in.
 */
export const principalsOf = (person: string, teams: readonly Workspace[], memberOf: readonly string[]): string[] => {
  const live = new Map(teams.map((t) => [t.id, t]));
  const direct = memberOf.filter((id) => live.has(id));
  const above = new Set(direct.flatMap((id) => live.get(id)!.path.filter((p) => live.has(p))));
  return [`person:${person}`, ...[...new Set(direct)].sort().map((id) => `team:${id}`), ...[...above].sort().map((id) => `tree:${id}`), 'org'];
};

const nameOf = (p: Pick<Person, 'firstName' | 'lastName' | 'username'>) => [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;
const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();

/**
 * People and teams for apps' services: who someone is (`/people/:id/principals`)
 * and a directory to find people and teams by name (`/directory`), so an app
 * can let someone share with a colleague or a team. Platform services may ask;
 * an app needs `people:read`.
 */
export const peopleRoutes =
  ({ workspaces, teams, verifyService, grants, now = Date.now }: PeopleOptions) =>
  async (app: FastifyInstance) => {
    let people: { list: Person[]; at: number } | undefined;
    const everyone = async () => {
      if (!teams) return [];
      if (people && now() - people.at < PEOPLE_TTL_MS) return people.list;
      people = { list: (await teams.people()).filter((p) => p.enabled), at: now() };
      return people.list;
    };

    const allowed = async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const service = await identifyService(req.headers, verifyService);
        if (service?.kind === 'platform') return true;
        if (service?.kind === 'app') {
          if (!grants) throw new GrantsUnavailable('Identity has no registry to check grants with.');
          if ((await grants(service.app)).includes(PEOPLE_SCOPE)) return true;
          void reply.code(403).send({ error: 'forbidden', message: `${service.app} isn’t granted ${PEOPLE_SCOPE}.` });
          return false;
        }
        void reply.code(403).send({ error: 'forbidden', message: 'Only platform and app services can look people up.' });
      } catch (err) {
        if (!(err instanceof ServiceAuthUnavailable) && !(err instanceof GrantsUnavailable)) throw err;
        req.log.error({ err: (err as Error).message }, 'could not check who is asking');
        void reply.code(503).send({ error: 'unavailable', message: 'Who may look people up can’t be checked right now. Try again in a moment.' });
      }
      return false;
    };

    app.get<{ Params: { id: string } }>('/people/:id/principals', { schema: { params: { type: 'object', properties: { id: { type: 'string', minLength: 1, maxLength: 100 } } } } }, async (req, reply) => {
      if (!(await allowed(req, reply))) return reply;
      await teams?.ready();
      const [all, mine] = await Promise.all([workspaces.teams(), workspaces.memberships({ person: req.params.id })]);
      return { person: req.params.id, principals: principalsOf(req.params.id, all, mine.map((m) => m.workspace)) };
    });

    app.get<{ Querystring: { q?: string; ids?: string; limit?: number } }>(
      '/directory',
      {
        schema: {
          querystring: {
            type: 'object',
            additionalProperties: false,
            properties: { q: { type: 'string', maxLength: 100 }, ids: { type: 'string', maxLength: 4000 }, limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS } },
          },
        },
      },
      async (req, reply) => {
        if (!(await allowed(req, reply))) return reply;
        await teams?.ready();
        const [all, folks] = await Promise.all([workspaces.teams(), everyone()]);
        const byId = new Map(all.map((t) => [t.id, t]));
        const ids = req.query.ids !== undefined ? new Set(req.query.ids.split(',').map((s) => s.trim()).filter(Boolean)) : undefined;
        // Names asked for by id all come back; a search gives the first `limit` of each.
        const limit = ids ? undefined : (req.query.limit ?? 20);
        const q = fold(req.query.q?.trim() ?? '');
        const matches = (...words: (string | undefined)[]) => !q || words.some((w) => w && fold(w).includes(q));
        const found = folks
          .filter((p) => (ids ? ids.has(p.id) : matches(nameOf(p), p.email, p.username)))
          .map((p) => ({ id: p.id, name: nameOf(p), ...(p.email ? { email: p.email } : {}) }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, limit);
        const groups = all
          .filter((t) => (ids ? ids.has(t.id) : matches(t.name)))
          .map((t) => ({ id: t.id, name: t.name, within: t.path.slice(0, -1).flatMap((id) => (byId.has(id) ? [byId.get(id)!.name] : [])) }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, limit);
        return { people: found, teams: groups };
      },
    );
  };
