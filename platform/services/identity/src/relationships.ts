import Type from 'typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { identifyService, ServiceAuthUnavailable, type ServiceVerifier } from '@augur/service-kit';
import { DEPLOYMENT_ADMIN_ROLE, PUBLISHER_ROLE, type Directory } from './directory.ts';
import { refused } from './schemas.ts';
import type { WorkspaceStore } from './workspaces.ts';

/**
 * What the permissions service copies from identity into OpenFGA (ADR 0085, ADR 0089): the org, the teams and
 * where each sits, everyone's own floor, the positions on each team and who holds them now, and who is in the
 * org. Identity stays where these are true; the copy is rebuilt from this answer, so one it missed heals.
 */
export const Relationships = Type.Object(
  {
    org: Type.String({ description: 'The organisation floor' }),
    teams: Type.Array(Type.Object({ id: Type.String(), parent: Type.String({ description: 'The team or the org right above it' }) }), { description: 'Live teams, parents first' }),
    personal: Type.Array(Type.Object({ id: Type.String(), owner: Type.String() }), { description: 'Live personal floors' }),
    positions: Type.Array(
      Type.Object({ id: Type.String(), team: Type.String(), role: Type.Union([Type.Literal('member'), Type.Literal('lead')]), holder: Type.Optional(Type.String()) }),
      { description: 'Positions on live teams; a vacant one has no holder' },
    ),
    people: Type.Optional(Type.Array(Type.String(), { description: 'Everyone whose sign-in is on. Absent where identity has no directory to ask.' })),
    roles: Type.Optional(
      Type.Object(
        {
          admin: Type.Array(Type.String()),
          'deployment-admin': Type.Array(Type.String()),
          publisher: Type.Array(Type.String()),
        },
        { description: 'Who holds each of the Keycloak roles AUGUR still checks today, among those whose sign-in is on. Copied until each check moves to the permissions service (ADR 0085). Absent with people.' },
      ),
    ),
  },
  { description: 'Who and what the permissions service copies from identity' },
);

/** The Keycloak roles today's checks read (`caller.roles.includes(...)`), which shadow mode compares against. */
const withRoles = (people: { id: string; roles: string[] }[]) => {
  const holding = (role: string) => people.filter((p) => p.roles.includes(role)).map((p) => p.id);
  return { people: people.map((p) => p.id), roles: { admin: holding('admin'), 'deployment-admin': holding(DEPLOYMENT_ADMIN_ROLE.name), publisher: holding(PUBLISHER_ROLE.name) } };
};

export interface RelationshipOptions {
  workspaces: WorkspaceStore;
  directory?: Pick<Directory, 'people'>;
  verifyService?: ServiceVerifier;
}

export const relationshipRoutes =
  ({ workspaces, directory, verifyService }: RelationshipOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();

    const platformOnly = async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        if ((await identifyService(req.headers, verifyService))?.kind === 'platform') return true;
        void reply.code(403).send({ error: 'forbidden', message: 'Only AUGUR’s own services can read who holds what.' });
      } catch (err) {
        if (!(err instanceof ServiceAuthUnavailable)) throw err;
        void reply.code(503).send({ error: 'unavailable', message: err.message });
      }
      return false;
    };

    app.get(
      '/relationships',
      {
        schema: {
          summary: 'Floors, positions and who holds them, for the permissions service (platform services only)',
          description: 'Everything the permissions service copies into OpenFGA, as it is now. It asks for it whole and writes what changed.',
          response: { 200: Relationships, 403: refused('Not one of AUGUR’s own services'), 503: refused('Service sign-in can’t be checked now') },
        },
      },
      async (req, reply) => {
        if (!(await platformOnly(req, reply))) return reply;
        const [org, teams, personal, positions, people] = await Promise.all([
          workspaces.org(),
          workspaces.teams(),
          workspaces.personalFloors(),
          workspaces.positions(),
          directory?.people(),
        ]);
        const live = new Set(teams.map((t) => t.id));
        return {
          org: org.id,
          teams: teams.map((t) => ({ id: t.id, parent: t.parentId ?? org.id })),
          personal,
          positions: positions.filter((p) => live.has(p.workspace)).map((p) => ({ id: p.id, team: p.workspace, role: p.role, ...(p.holder ? { holder: p.holder } : {}) })),
          ...(people ? withRoles(people.filter((p) => p.enabled)) : {}),
        };
      },
    );
  };
