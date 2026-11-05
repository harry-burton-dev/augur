import { pino } from 'pino';

/** What a service says before, or outside, its Fastify app: the same JSON lines, through the same logger. */
export interface StartupLog {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/**
 * A service's log for what it says at start-up, or in a job with no Fastify app: pino, as Fastify logs
 * with, so the lines are JSON like the rest and OpenTelemetry sends them with the service's other logs
 * (the service kit's telemetry instruments pino). Each line names the service. Silent in tests, as
 * `serviceLogging` is. `to` is for tests: where the lines go instead of standard output.
 */
export const startupLog = (service: string, env: Record<string, string | undefined> = process.env, to?: { write(line: string): void }): StartupLog => {
  const options = { name: service, level: env.NODE_ENV === 'test' ? 'silent' : 'info' };
  const log = to ? pino(options, to) : pino(options);
  return {
    info: (message, fields = {}) => log.info(fields, message),
    warn: (message, fields = {}) => log.warn(fields, message),
    error: (message, fields = {}) => log.error(fields, message),
  };
};
