/**
 * Set while serve() owns stopping, so the telemetry loaded first (`--import @augur/service-kit/telemetry`)
 * leaves SIGTERM to it and only sends what it holds when serve() asks, after the calls in flight finish.
 * This module imports nothing: telemetry loads it before the libraries it instruments.
 */
export const SERVING = Symbol.for('augur.service-kit.serving');
/** Sends what telemetry still holds; telemetry sets it when it is on. */
export const FLUSH_TELEMETRY = Symbol.for('augur.service-kit.flush-telemetry');
/** What serve() and telemetry leave for each other on globalThis. */
export type ShutdownHooks = { [SERVING]?: boolean; [FLUSH_TELEMETRY]?: () => Promise<unknown> };
