import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { GrantsUnavailable, identifyService, ServiceAuthUnavailable, type GrantLookup, type ServiceVerifier } from '@augur/service-kit';
import type { Person } from './directory.ts';
import { refused } from './schemas.ts';
import type { TeamDirectory } from './teams.ts';
import type { Workspace, WorkspaceStore } from './workspaces.ts';

/** The scope an app needs to look people and teams up. */
export const PEOPLE_SCOPE = 'people:read';

/** How long the directory's list of people is kept: the sign-in service is slow to ask, and a new person shows within this. */
const PEOPLE_TTL_MS = 30_000;
const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 20;

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
 * someone on a team below); and `org`, which everyone is in. Platform services
 * may also name `role:<realm role>` (ADR 0044), such as the deployment's admins.
 */
export const principalsOf = (person: string, teams: readonly Workspace[], memberOf: readonly string[]): string[] => {
  const live = new Map(teams.map((t) => [t.id, t]));
  const direct = memberOf.filter((id) => live.has(id));
  const above = new Set(direct.flatMap((id) => live.get(id)!.path.filter((p) => live.has(p))));
  return [`person:${person}`, ...[...new Set(direct)].sort().map((id) => `team:${id}`), ...[...above].sort().map((id) => `tree:${id}`), 'org'];
};

/**
 * Everyone who stands for at least one of `principals`, among `people`: so an
 * app can tell an audience ("Finance and the teams below it") something.
 */
export const membersOf = (
  principals: readonly string[],
  people: readonly Pick<Person, 'id' | 'roles'>[],
  teams: readonly Workspace[],
  memberships: readonly { workspace: string; person: string }[],
): string[] => {
  const wanted = new Set(principals);
  if (wanted.has('org')) return people.map((p) => p.id).sort();
  const live = new Map(teams.map((t) => [t.id, t]));
  const found = new Set<string>();
  for (const m of memberships) {
    const team = live.get(m.workspace);
    if (team && (wanted.has(`team:${team.id}`) || team.path.some((id) => wanted.has(`tree:${id}`)))) found.add(m.person);
  }
  for (const p of principals) if (p.startsWith('person:')) found.add(p.slice('person:'.length));
  for (const p of people) if (p.roles.some((r) => wanted.has(`role:${r}`))) found.add(p.id);
  const known = new Set(people.map((p) => p.id));
  return [...found].filter((id) => known.has(id)).sort();
};

const nameOf = (p: Pick<Person, 'firstName' | 'lastName' | 'username'>) => [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;
const fold = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

/** Everyone whose sign-in is on, kept for a short while: the sign-in service is slow to ask. */
export const signedInPeople = (teams: TeamDirectory | undefined, now: () => number = Date.now) => {
  let people: { list: Person[]; at: number } | undefined;
  return async (): Promise<Person[]> => {
    if (!teams) return [];
    if (people && now() - people.at < PEOPLE_TTL_MS) return people.list;
    people = { list: (await teams.people()).filter((p) => p.enabled), at: now() };
    return people.list;
  };
};

/** What the directory is asked: words to find, or the ids to name. */
export const DirectoryQuery = Type.Object(
  {
    q: Type.Optional(Type.String({ maxLength: 100 })),
    ids: Type.Optional(Type.String({ maxLength: 4000, description: 'Comma-separated person and team ids' })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_RESULTS, default: DEFAULT_RESULTS })),
  },
  { additionalProperties: false },
);

export const DirectoryAnswer = Type.Object(
  {
    people: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), email: Type.Optional(Type.String()) })),
    teams: Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        within: Type.Array(Type.String(), { description: 'Names of the teams it sits in, from the top down' }),
        path: Type.Optional(Type.Array(Type.String(), { description: 'The ids of those teams, then its own (1.9)' })),
      }),
    ),
  },
  { description: 'People and teams' },
);

/**
 * People whose name, email or username has `q` in it (accents and case aside),
 * and teams whose name does, each sorted by name, the first `limit` of each.
 * With `ids` instead, the people and teams with those ids, all of them.
 */
export const findInDirectory = (folks: readonly Person[], all: readonly Workspace[], query: { q?: string; ids?: string; limit?: number }) => {
  const byId = new Map(all.map((t) => [t.id, t]));
  const ids = query.ids !== undefined ? new Set(query.ids.split(',').map((s) => s.trim()).filter(Boolean)) : undefined;
  // Names asked for by id all come back; a search gives the first `limit` of each.
  const limit = ids ? undefined : (query.limit ?? DEFAULT_RESULTS);
  const q = fold(query.q?.trim() ?? '');
  const matches = (...words: (string | undefined)[]) => !q || words.some((w) => w && fold(w).includes(q));
  const people = folks
    .filter((p) => (ids ? ids.has(p.id) : matches(nameOf(p), p.email, p.username)))
    .map((p) => ({ id: p.id, name: nameOf(p), ...(p.email ? { email: p.email } : {}) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
  const teams = all
    .filter((t) => (ids ? ids.has(t.id) : matches(t.name)))
    .map((t) => {
      const above = t.path.slice(0, -1).filter((id) => byId.has(id));
      return { id: t.id, name: t.name, within: above.map((id) => byId.get(id)!.name), path: [...above, t.id] };
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
  return { people, teams };
};

/**
 * People and teams for apps' services: who someone is (`/people/:id/principals`),
 * a directory to find people and teams by name (`/directory`), so an app can
 * let someone share with a colleague or a team, and who an audience reaches
 * (`/members`), so it can tell them. Platform services may ask; an app needs
 * `people:read`.
 */
export const peopleRoutes =
  ({ workspaces, teams, verifyService, grants, now = Date.now }: PeopleOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    const everyone = signedInPeople(teams, now);

    /** Which kind of service is asking, when it may; false once the reply has been sent. */
    const allowed = async (req: FastifyRequest, reply: FastifyReply): Promise<'platform' | 'app' | false> => {
      try {
        const service = await identifyService(req.headers, verifyService);
        if (service?.kind === 'platform') return 'platform';
        if (service?.kind === 'app') {
          if (!grants) throw new GrantsUnavailable('Identity has no registry to check grants with.');
          if ((await grants(service.app)).includes(PEOPLE_SCOPE)) return 'app';
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

    const notAllowed = {
      403: refused('Not a platform service, or an app without people:read'),
      503: refused("The caller's token or the app's grants can't be checked right now"),
    };

    app.get(
      '/people/:id/principals',
      {
        schema: {
          summary: 'Who a person stands for (platform services, and apps with people:read)',
          description: [
            "The principals an app matches against who may see something: person:<id>;",
            "team:<id> for each team they're on; tree:<id> for each of those teams and",
            'every team above it (shared with a team and the teams below it); and org,',
            "which everyone is in. Archived teams don't count. Apps keep each answer",
            'for 30 seconds (identityPrincipals in the service kit).',
          ].join(' '),
          params: Type.Object({ id: Type.String({ minLength: 1, maxLength: 100 }) }),
          response: {
            200: Type.Object({ person: Type.String(), principals: Type.Array(Type.String()) }, { description: 'Their principals' }),
            400: refused('An id longer than 100 characters'),
            ...notAllowed,
          },
        },
      },
      async (req, reply) => {
        if (!(await allowed(req, reply))) return reply;
        await teams?.ready();
        const [all, mine] = await Promise.all([workspaces.teams(), workspaces.memberships({ person: req.params.id })]);
        return { person: req.params.id, principals: principalsOf(req.params.id, all, mine.map((m) => m.workspace)) };
      },
    );

    app.get(
      '/directory',
      {
        schema: {
          summary: 'Find people and teams (platform services, and apps with people:read)',
          description: [
            "For sharing: people whose name, email or username has `q` in it, and teams",
            'whose name does, each sorted by name, first `limit` of each. With `ids`',
            'instead, the people and teams with those ids, so an app can name who it',
            "has shared with. People whose sign-in is turned off aren't listed.",
            'A signed-in person asks the same at /me/directory (1.15).',
          ].join(' '),
          querystring: DirectoryQuery,
          response: { 200: DirectoryAnswer, 400: refused('A query it does not know, or a value out of range'), ...notAllowed },
        },
      },
      async (req, reply) => {
        if (!(await allowed(req, reply))) return reply;
        await teams?.ready();
        const [all, folks] = await Promise.all([workspaces.teams(), everyone()]);
        return findInDirectory(folks, all, req.query);
      },
    );

    app.get(
      '/members',
      {
        schema: {
          summary: 'Who an audience reaches (platform services, and apps with people:read)',
          description: [
            'The ids of everyone who stands for at least one of the principals',
            '(person:, team:, tree: or org), so an app can tell an audience that',
            'something was published to it. People whose sign-in is turned off',
            "aren't listed. Since 1.9. Platform services may also name",
            'role:<realm role>, such as role:deployment-admin (1.14, ADR 0044); an',
            'app that does is refused with 403.',
          ].join(' '),
          querystring: Type.Object(
            { principals: Type.String({ minLength: 1, maxLength: 4000, description: 'Comma-separated principals' }) },
            { additionalProperties: false },
          ),
          response: {
            200: Type.Object({ people: Type.Array(Type.String()) }, { description: 'Person ids, sorted' }),
            400: refused('No principals, or a query it does not know'),
            ...notAllowed,
          },
        },
      },
      async (req, reply) => {
        const asker = await allowed(req, reply);
        if (!asker) return reply;
        const principals = req.query.principals.split(',').map((s) => s.trim()).filter(Boolean);
        // Who holds a role is the platform's business: an app tells people, not "every admin".
        if (asker !== 'platform' && principals.some((p) => p.startsWith('role:'))) {
          return reply.code(403).send({ error: 'forbidden', message: 'Only AUGUR’s own services can reach people by role.' });
        }
        await teams?.ready();
        const [all, folks, members] = await Promise.all([workspaces.teams(), everyone(), workspaces.memberships()]);
        return { people: membersOf(principals, folks, all, members) };
      },
    );
  };
