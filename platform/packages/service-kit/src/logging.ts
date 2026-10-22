import { randomUUID } from 'node:crypto';

/** One id per request, set by the gateway and passed to every service it calls, so one request can be followed across all their logs. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * The Fastify options every service starts with: JSON logs (off in tests), each
 * line labelled with the request id the gateway passed on, or a new one.
 */
export const serviceLogging = (env = process.env) => ({
  logger: env.NODE_ENV !== 'test',
  requestIdHeader: REQUEST_ID_HEADER,
  requestIdLogLabel: 'requestId',
  genReqId: () => randomUUID(),
});
