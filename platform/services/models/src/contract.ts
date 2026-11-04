/**
 * What contracts/models.openapi.yaml says about the API as a whole. The paths and shapes come from the
 * routes and src/schemas.ts; `pnpm contracts` writes the file and CI checks it is in step (ADR 0055).
 * Bump `version` as docs/versioning.md says when the API changes.
 */
import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { SCHEMAS } from './schemas.ts';

const paragraph = (...lines: string[]) => lines.join(' ');

export const info = {
  title: 'Models',
  version: '1.1.0',
  description: [
    paragraph(
      "The model gateway: the only place AUGUR keeps a model provider's key. It",
      'speaks the OpenAI-style chat completions API to whichever provider the',
      'server is set up with (MODEL_API_URL: OpenRouter, a LiteLLM proxy, any',
      'compatible API, or the built-in stand-in model), so nothing else holds an',
      'AI key or knows the provider.',
    ),
    paragraph(
      "Two kinds of caller. An app's service signs in as itself (a bearer token",
      'for its Keycloak client app-<id>, audience platform-services) and needs',
      'models:use granted by the registry on the floor named by x-workspace-id.',
      'A person reaches it through the gateway (caller in x-user-* headers) from',
      "the shell's Agents, naming the agent they are talking to: \"assistant\", the",
      "shell's own, or an AI app granted models:use on their floor.",
    ),
    paragraph(
      "Apps' services may also turn text into vectors (/embeddings, 1.1), to",
      'match by meaning, when an embedding model is set up (MODEL_EMBEDDING_NAME;',
      'the stand-in always has one). Each request counts as one call and is',
      'recorded as model.embedded, with how many texts and never what they say.',
    ),
    paragraph(
      'Every call is written to the audit log (model.called, with the model, how',
      'many messages and which tools, never what was said) before it is made; a',
      "call that can't be recorded isn't made (503). Each app (the shell's",
      'assistant counts as one) gets a number of calls a day, UTC (429 after).',
      'Models are off until an admin turns them on (403 while off).',
    ),
  ].join('\n'),
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
