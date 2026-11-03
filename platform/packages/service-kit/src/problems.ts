import { STATUS_CODES } from 'node:http';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { serviceLogging } from './logging.js';

/**
 * Every AUGUR service answers an error the same way: an RFC 9457 problem details body
 * (`application/problem+json`), with two AUGUR extensions.
 *
 * - `reason` is a stable code a client can switch on (`forbidden`, `not_found`, `unavailable`, …).
 *   It never changes for a given cause, so a screen can say why something can't be done.
 * - `whoCanChange` says, in plain words, who can fix it, when someone can ("An admin, in Admin,
 *   Apps."). Left out when nobody can, such as a thing that no longer exists.
 *
 * `type` is `about:blank` unless a problem names its own: per RFC 9457 §4.2.1 that means the
 * problem is no more than its status, so `title` is the status's own phrase. AUGUR's finer
 * meaning is in `reason`, which keeps working across deployments with no URL to host or keep up.
 * A problem that does get its own documentation page can pass it as `type`.
 *
 * Bodies also carry `error` (the same as `reason`) and `message` (the same as `detail`), which is
 * what SDK 1.x clients and the shell read today.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  reason: string;
  whoCanChange?: string;
  /** The same as `reason`, for SDK 1.x clients. */
  error: string;
  /** The same as `detail`, for SDK 1.x clients. */
  message: string;
  [extension: string]: unknown;
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export interface ProblemOptions {
  /** Who can fix it, in plain words, when someone can. */
  whoCanChange?: string;
  /** A short summary of the problem's type. Defaults to the status's phrase. */
  title?: string;
  /** A URI for the problem's type. Defaults to `about:blank`. */
  type?: string;
  /** A URI for this occurrence. */
  instance?: string;
  /** More fields to answer with, such as what a client needs to recover. */
  extensions?: Record<string, unknown>;
}

const statusTitle = (status: number) => STATUS_CODES[status] ?? 'Error';

/** The body for a problem. Extensions come first, so they can't overwrite the standard fields. */
export const problemBody = (status: number, reason: string, detail: string, options: ProblemOptions = {}): ProblemDetails => ({
  ...options.extensions,
  type: options.type ?? 'about:blank',
  title: options.title ?? statusTitle(status),
  status,
  detail,
  ...(options.instance ? { instance: options.instance } : {}),
  reason,
  ...(options.whoCanChange ? { whoCanChange: options.whoCanChange } : {}),
  error: reason,
  message: detail,
});

/** An error a handler can throw to answer with a problem: `throw new Problem(404, 'not_found', 'That claim no longer exists.')`. */
export class Problem extends Error {
  override readonly name = 'Problem';
  constructor(
    readonly status: number,
    readonly reason: string,
    readonly detail: string,
    readonly options: ProblemOptions = {},
  ) {
    super(detail);
  }
  get whoCanChange() {
    return this.options.whoCanChange;
  }
  toJSON(): ProblemDetails {
    return problemBody(this.status, this.reason, this.detail, this.options);
  }
}

/** Answers with a problem: `return sendProblem(reply, 403, 'forbidden', 'Only an admin can do that.', { whoCanChange: 'An admin.' })`. */
export function sendProblem(reply: FastifyReply, problem: Problem): FastifyReply;
export function sendProblem(reply: FastifyReply, status: number, reason: string, detail: string, options?: ProblemOptions): FastifyReply;
export function sendProblem(reply: FastifyReply, first: Problem | number, reason?: string, detail?: string, options?: ProblemOptions): FastifyReply {
  const body = first instanceof Problem ? first.toJSON() : problemBody(first, reason!, detail!, options);
  return reply.code(body.status).type(PROBLEM_CONTENT_TYPE).send(body);
}

/** Error classes such as `PeopleUnavailable`: a part this service needs can't be reached right now. Subclasses keep the name `Error`, so the class's own name counts too. */
const isUnavailable = (err: Error) => /Unavailable$/.test(err.name) || /Unavailable$/.test(err.constructor?.name ?? '');

/** `PeopleUnavailable` → `people`, `CallerKeysUnavailable` → `caller keys`. */
const unavailablePart = (err: Error) => {
  const name = /Unavailable$/.test(err.constructor?.name ?? '') ? err.constructor.name : err.name;
  return name
    .replace(/Unavailable$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
};

/** Reasons for Fastify's own client errors, so a client never has to switch on a Fastify code. */
const FASTIFY_REASONS: Record<string, string> = {
  FST_ERR_CTP_BODY_TOO_LARGE: 'too_large',
  FST_ERR_CTP_INVALID_MEDIA_TYPE: 'unsupported_media_type',
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: 'bad_request',
  FST_ERR_CTP_EMPTY_JSON_BODY: 'bad_request',
  FST_ERR_CTP_INVALID_JSON_BODY: 'bad_request',
};

/** A reason from a status's phrase: 413 → `payload_too_large`. */
const statusReason = (status: number) =>
  statusTitle(status)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const ADMIN_STATUS = 'An admin can see which part of AUGUR isn’t answering in Admin.';

const answerError = (err: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
  if (err instanceof Problem) {
    if (err.status >= 500) req.log.error({ err }, 'request failed');
    return sendProblem(reply, err);
  }
  if (err.validation) return sendProblem(reply, 400, 'bad_request', err.message);
  if (isUnavailable(err)) {
    req.log.warn({ err }, 'a part this service needs is unavailable');
    const part = unavailablePart(err);
    const what = part ? `This needs ${part}, which can’t be reached right now.` : 'Something this needs can’t be reached right now.';
    return sendProblem(reply, 503, 'unavailable', `${what} Try again in a moment.`, { whoCanChange: ADMIN_STATUS });
  }
  const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
  if (status >= 400 && status < 500) {
    return sendProblem(reply, status, (err.code && FASTIFY_REASONS[err.code]) || statusReason(status), err.message || statusTitle(status));
  }
  // Never the error's own words: they can name internal hosts, queries or files.
  req.log.error({ err }, 'request failed');
  return sendProblem(reply, status >= 500 && status < 600 ? status : 500, 'internal', 'Something went wrong on AUGUR’s side, so this didn’t finish. Try again; if it keeps happening, tell an admin, quoting the request id.', {
    whoCanChange: 'An admin, who can find the request in the service’s logs by its id.',
  });
};

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/**
 * A handler's `{ error, message }` answer, made a problem: the fields it had stay, so clients
 * that read `error` and `message` keep working. A body that already has a `type` is left as is.
 */
export const upgradeLegacyError = (status: number, body: unknown): ProblemDetails | undefined => {
  if (status < 400 || !isPlainObject(body) || 'type' in body || typeof body.error !== 'string') return undefined;
  const detail = typeof body.message === 'string' ? body.message : statusTitle(status);
  return {
    ...body,
    type: 'about:blank',
    title: statusTitle(status),
    status,
    detail: typeof body.detail === 'string' ? body.detail : detail,
    reason: typeof body.reason === 'string' ? body.reason : body.error,
    error: body.error,
    message: detail,
  };
};

const problems = async (app: FastifyInstance) => {
  app.setErrorHandler(answerError);
  app.setNotFoundHandler((req, reply) => sendProblem(reply, 404, 'not_found', `Nothing here answers ${req.method} ${req.url.split('?')[0]}.`));
  app.addHook('preSerialization', async (_req, reply, payload) => {
    const upgraded = upgradeLegacyError(reply.statusCode, payload);
    if (!upgraded) return payload;
    reply.type(PROBLEM_CONTENT_TYPE);
    return upgraded;
  });
};
// Applies to the whole instance it is registered on, not only to a plugin scope of its own.
Object.assign(problems, { [Symbol.for('skip-override')]: true, [Symbol.for('fastify.display-name')]: 'augur-problem-details' });

/**
 * Makes every error a service answers an RFC 9457 problem (see `ProblemDetails`). Register it first,
 * before any routes: `await app.register(problemDetails())`.
 *
 * - A thrown `Problem` is answered as it is.
 * - A request that fails its schema is a 400 `bad_request`, saying what was wrong.
 * - An error whose class ends in `Unavailable` (`PeopleUnavailable`) is a 503 `unavailable`.
 * - Fastify's other client errors (a body too large, a media type it doesn't take) keep their status.
 * - Anything else is a 500 `internal`. The error is logged; its words are never sent.
 * - An unknown route is a 404 `not_found`.
 * - A handler's `reply.code(4xx).send({ error, message })` gets the problem fields added.
 *
 * A plugin's own `setErrorHandler` still wins inside that plugin, and its `{ error, message }`
 * answers are still made problems.
 */
export const problemDetails = () => problems;

/** The Fastify options every platform service starts with: `serviceLogging`, and request bodies kept as sent. */
export const serviceFastifyOptions = (env = process.env) => ({
  ...serviceLogging(env),
  ajv: { customOptions: { removeAdditional: false as const } },
});
