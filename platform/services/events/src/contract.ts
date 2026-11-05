/**
 * What contracts/events.openapi.yaml says about the API as a whole. The paths and shapes come from the
 * routes and src/schemas.ts; `pnpm contracts` writes the file and CI checks it is in step (ADR 0055).
 * Bump `version` as docs/versioning.md says when the API changes.
 */
import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { SCHEMAS } from './schemas.ts';

export const info = {
  title: 'Events',
  version: '1.11.0',
  description: [
    "Notifications for the Shell's stream, and AUGUR's audit log.",
    'People reach it through the gateway, which passes the caller in x-user-*',
    'headers. Services call it on the internal network (see @augur/service-kit:',
    'notify, recordAudit). An app\'s service signs in as itself (a bearer token',
    'for its Keycloak client app-<id>, audience platform-services), may send only',
    'for itself, and needs the scope (notifications:send, audit:write) that the',
    'registry grants it on the floor named by x-workspace-id; otherwise 403, or',
    "503 while that can't be checked. Platform services sign in the same way as",
    'their own clients (platform-<name>). A service call that names a floor',
    '(x-workspace-id) records it, with the floor\'s path from the root as it',
    'stands then (asked of identity), on each notification and audit entry: 400',
    "for a floor that doesn't exist, 503 while identity can't be reached.",
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
  for (const schema of SCHEMAS) app.addSchema(schema);
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
};
