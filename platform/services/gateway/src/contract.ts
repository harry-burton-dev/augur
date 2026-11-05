/**
 * What contracts/gateway.openapi.yaml says about the gateway's own API. The paths and shapes come from
 * its routes and src/schemas.ts; `pnpm contracts` writes the file and CI checks it is in step (ADR 0055).
 * Bump `version` as docs/versioning.md says when the API changes.
 */
import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { SCHEMAS } from './schemas.ts';

export const info = {
  title: 'Gateway',
  version: '1.7.0',
  description: [
    "The gateway's own API, beside the services it forwards to. Reached at",
    '/api/gateway/v1 by a signed-in caller. Everything else under /api/<service>',
    'is forwarded to that service with the caller in x-user-* headers and in',
    'x-augur-caller, a token the gateway signs (EdDSA, one minute) for that',
    "service alone (its `aud` is the service's name), and without the caller's",
    'Authorization header. Services that check callers believe only the signed',
    'one. Every path but /healthz and /caller-keys needs a signed-in caller,',
    "however it is spelt. x-user-signed-in-at (and the token's `signedInAt`)",
    "carries when the caller last entered their password (the token's",
    'auth_time, ISO 8601), for a service that wants a fresh sign-in for',
    "something drastic; the shell's /auth/again?return=<path> asks for the",
    'password and comes back.',
  ].join(' '),
};

/**
 * Collects the gateway's own routes for the contract and adds the named schemas. Only routes under
 * `prefix` (/api/gateway/<major>) are its own API, listed relative to it as the server is; everything it
 * forwards (/api/<service>/…) and its internal routes stay out. Responses are sent as plain JSON, as
 * before: the response schemas document the API, they don't filter what is sent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any server type: this only reads the routes.
export const describeApi = async (app: FastifyInstance<any, any, any, any, any>, prefix: string, server: string) => {
  await app.register(swagger, {
    openapi: { openapi: '3.1.0', info, servers: [{ url: server }] },
    refResolver: { buildLocalReference: (json, _base, _fragment, i) => String(json.$id ?? `def-${i}`) },
    transform: ({ schema, url }) =>
      url.startsWith(`${prefix}/`) ? { schema, url: url.slice(prefix.length) } : { schema: { ...schema, hide: true }, url },
  });
  for (const schema of SCHEMAS) app.addSchema(schema);
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
};
