/**
 * What contracts/knowledge.openapi.yaml says about the API as a whole. The paths and shapes come from the
 * routes and src/schemas.ts; `pnpm contracts` writes the file and CI checks it is in step (ADR 0055).
 * Bump `version` as docs/versioning.md says when the API changes.
 */
import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { SCHEMAS } from './schemas.ts';

const paragraph = (...lines: string[]) => lines.join(' ');

export const info = {
  title: 'Knowledge',
  version: '0.1.0',
  description: [
    paragraph(
      'The knowledge graph of each floor (ADR 0079): the entities AUGUR knows about and what each floor',
      'believes of them, with the evidence. A floor sees itself and every floor above it; your own floor also',
      'sees the floors you are on. Nothing below or beside a floor is in its sight, and what you may know',
      'exists but cannot open comes back as an Unseen, which never carries a label.',
    ),
    paragraph(
      'A person reaches it through the gateway, standing on a floor (X-Workspace-Id). Every change is an',
      'action posted to POST /actions/{action}, whose input is the one GET /actions gives, with an',
      'Idempotency-Key; reads answer as the person on the floor they name. Apps reach it through its',
      'client in a later release.',
    ),
    paragraph('0.x while the seam fills in: draft 4 of the spec is its target, and paths are added until it is met.'),
  ].join('\n'),
};

/**
 * Collects the routes for the contract and adds the named schemas. Responses are sent as plain JSON:
 * the response schemas document the API, they don't filter what is sent.
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
