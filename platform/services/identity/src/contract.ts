/**
 * What contracts/identity.openapi.yaml says about the API as a whole. The paths and shapes come from the
 * routes and src/schemas.ts; `pnpm contracts` writes the file and CI checks it is in step (ADR 0055).
 * Bump `version` as docs/versioning.md says when the API changes.
 */
import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { ME_SCHEMAS } from './me.ts';
import { SCHEMAS } from './schemas.ts';

export const info = {
  title: 'Identity',
  version: '1.25.0',
  description: [
    "Who people are. Reached through the gateway, which verifies the caller's",
    'sign-in token and passes the caller on in x-user-* headers.',
    'The /admin paths manage people and roles, kept in the sign-in provider',
    "(Keycloak), and departments, which are identity's own teams (copied in once",
    "from the provider's groups). Every /admin path answers 403 to a caller",
    "without the admin role, and 503 when identity isn't connected to the",
    'provider. Changes are audited, never a password. /organisation is the',
    "organisation's name, time zone and email sender (ADR 0042), for anyone",
    'signed in and any service; only an admin changes them.',
  ].join(' '),
};

/**
 * Collects the routes for the contract and adds the named schemas. Responses are sent as plain JSON,
 * as before: the response schemas document the API, they don't filter what is sent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any server type: this only reads the routes.
export const describeApi = async (app: FastifyInstance<any, any, any, any, any>, prefix: string) => {
  await app.register(swagger, {
    openapi: { openapi: '3.1.0', info, servers: [{ url: prefix }] },
    refResolver: { buildLocalReference: (json, _base, _fragment, i) => String(json.$id ?? `def-${i}`) },
  });
  for (const schema of [...SCHEMAS, ...ME_SCHEMAS]) app.addSchema(schema);
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
};
