import { http, HttpResponse, type HttpHandler } from 'msw';
import { TEST_BASE } from './context.js';

/**
 * The parts of an OpenAPI 3.x document `contractHandlers` reads. Pass the
 * whole parsed document (load the YAML or JSON yourself); local `$ref`s
 * (`#/components/…`) are followed.
 */
export interface OpenApiDocument {
  openapi: string;
  servers?: { url: string; variables?: Record<string, { default: string }> }[];
  paths?: Record<string, Record<string, unknown> | undefined>;
  components?: Record<string, unknown>;
}

/** What a handler is told about the request it answers. */
export interface ContractRequest {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
  /** The operation's key: its `operationId`, or `METHOD /path` as the contract writes it. */
  operation: string;
}

/**
 * An answer for one operation: a JSON body sent with the operation's first
 * documented 2xx status, a `Response` sent as it is, or a function of the
 * request that returns either.
 */
export type ContractAnswer = ((req: ContractRequest) => unknown) | object | string | number | boolean | null | undefined;

export interface ContractHandlerOptions {
  /** Where the service is reached, before the contract's server path: `http://augur.test/api/registry`. Default `TEST_BASE`. */
  base?: string;
  /**
   * Answers by operation, overriding the contract's examples. The key is the
   * `operationId`, or `METHOD /path` (`GET /me/apps`) for an operation without
   * one. A key that names no operation throws, so a typo can't pass silently.
   */
  answers?: Record<string, ContractAnswer>;
}

const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'] as const;
type Method = (typeof methods)[number];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Follows a local `$ref` chain, `#/components/responses/Problem` and the like. */
const resolve = (doc: OpenApiDocument, value: unknown, seen = new Set<string>()): unknown => {
  if (!isObject(value) || typeof value.$ref !== 'string') return value;
  const ref = value.$ref;
  if (!ref.startsWith('#/') || seen.has(ref)) return undefined;
  seen.add(ref);
  let target: unknown = doc;
  for (const part of ref.slice(2).split('/')) {
    target = isObject(target) ? target[part.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined;
  }
  return resolve(doc, target, seen);
};

/** The path the first server names, without its origin: `/v1`. */
const serverPath = (doc: OpenApiDocument): string => {
  const server = doc.servers?.[0];
  if (!server) return '';
  const url = server.url.replace(/\{([^}]+)\}/g, (_, name: string) => server.variables?.[name]?.default ?? '');
  const path = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? new URL(url).pathname : url;
  return path.replace(/\/+$/, '');
};

/** `/apps/{id}/upstream` as MSW writes it: `/apps/:id/upstream`. */
const mswPath = (path: string): string => path.replace(/\{([^}]+)\}/g, (_, name: string) => `:${name.replace(/\W/g, '_')}`);

/** Orders paths so `/apps/mine` is tried before `/apps/{id}`: MSW answers with the first handler that matches. */
const byLiteralFirst = (a: string, b: string): number => {
  const as = a.split('/');
  const bs = b.split('/');
  for (let i = 0; i < Math.min(as.length, bs.length); i++) {
    const ap = as[i]!.includes('{');
    const bp = bs[i]!.includes('{');
    if (ap !== bp) return ap ? 1 : -1;
  }
  return 0;
};

type Example = { found: true; status: number; body: unknown } | { found: false; why: string };

const jsonTypes = (content: Record<string, unknown>): string[] => {
  const types = Object.keys(content);
  return ['application/json', ...types.filter((t) => t !== 'application/json' && /[/+]json\b/.test(t))].filter((t) => t in content);
};

/** The documented example of the operation's first 2xx response. */
const exampleOf = (doc: OpenApiDocument, operation: Record<string, unknown>): Example => {
  const responses = resolve(doc, operation.responses);
  if (!isObject(responses)) return { found: false, why: 'documents no responses' };
  const success = Object.keys(responses)
    .filter((code) => /^2(\d\d|XX)$/i.test(code))
    .sort()[0];
  if (!success) return { found: false, why: 'documents no 2xx response' };
  const status = /^\d+$/.test(success) ? Number(success) : 200;
  const response = resolve(doc, responses[success]);
  const content = isObject(response) ? resolve(doc, response.content) : undefined;
  if (!isObject(content) || Object.keys(content).length === 0) return { found: true, status, body: undefined };
  for (const type of jsonTypes(content)) {
    const media = resolve(doc, content[type]);
    if (!isObject(media)) continue;
    if ('example' in media) return { found: true, status, body: media.example };
    const examples = resolve(doc, media.examples);
    const first = isObject(examples) ? resolve(doc, Object.values(examples)[0]) : undefined;
    if (isObject(first) && 'value' in first) return { found: true, status, body: first.value };
  }
  return { found: false, why: `has no example for its ${success} response` };
};

const send = (status: number, body: unknown): Response =>
  body instanceof Response ? body.clone() : body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });

/**
 * MSW handlers for every operation in an OpenAPI 3.x contract, so an app can
 * be tested against what a service promises without running it. Each answers
 * with `answers[operation]` if given, else the example documented for its
 * first 2xx response, else a 501 problem saying the example is missing.
 */
export const contractHandlers = (doc: OpenApiDocument, options: ContractHandlerOptions = {}): HttpHandler[] => {
  const prefix = `${(options.base ?? TEST_BASE).replace(/\/+$/, '')}${serverPath(doc)}`;
  const answers = options.answers ?? {};
  const used = new Set<string>();
  const handlers: HttpHandler[] = [];

  for (const [path, rawItem] of Object.entries(doc.paths ?? {}).sort(([a], [b]) => byLiteralFirst(a, b))) {
    const item = resolve(doc, rawItem);
    if (!isObject(item)) continue;
    for (const method of methods) {
      const operation = resolve(doc, item[method]);
      if (!isObject(operation)) continue;
      const route = `${method.toUpperCase()} ${path}`;
      const id = typeof operation.operationId === 'string' ? operation.operationId : undefined;
      const key = id !== undefined && Object.hasOwn(answers, id) ? id : Object.hasOwn(answers, route) ? route : undefined;
      if (key !== undefined) used.add(key);
      const name = id ?? route;
      const example = exampleOf(doc, operation);
      handlers.push(
        http[method as Method](`${prefix}${mswPath(path)}`, async ({ request, params }) => {
          if (key !== undefined) {
            const answer = answers[key];
            const status = example.found ? example.status : 200;
            return send(status, await (typeof answer === 'function' ? answer({ request, params, operation: name }) : answer));
          }
          if (example.found) return send(example.status, structuredClone(example.body));
          return HttpResponse.json(
            {
              type: 'about:blank',
              title: 'Not Implemented',
              status: 501,
              detail: `${name} isn't answered in this test.`,
              reason: `The contract's ${name} ${example.why}, so there's nothing to answer with.`,
              whoCanChange: `Whoever writes this test: add an answer for "${id ?? route}", or an example to the contract.`,
              operation: name,
            },
            { status: 501, headers: { 'content-type': 'application/problem+json' } },
          );
        }),
      );
    }
  }

  const unknown = Object.keys(answers).filter((key) => !used.has(key));
  if (unknown.length) throw new Error(`contractHandlers: no operation in the contract is called ${unknown.map((k) => `"${k}"`).join(', ')}.`);
  return handlers;
};
