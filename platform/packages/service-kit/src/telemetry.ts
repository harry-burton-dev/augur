/**
 * OpenTelemetry for a service (ADR 0034): traces, metrics and logs over OTLP to
 * whatever collector the deployment names. Off unless OTEL_EXPORTER_OTLP_ENDPOINT
 * is set. Load it before the service's own code, as compose does:
 *
 *   NODE_OPTIONS="--import @augur/service-kit/telemetry" node dist/index.js
 *
 * Everything else is the standard OTEL_* settings (service name, sampling,
 * headers), read by the SDK itself. See docs/observability.md.
 */
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join } from 'node:path';

/** The settings telemetry reads: process.env, or a test's own. */
export type TelemetryEnv = Record<string, string | undefined>;

/** True when the settings name a collector and don't turn the SDK off. */
export const telemetryOn = (env: TelemetryEnv = process.env): boolean =>
  Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) && env.OTEL_SDK_DISABLED !== 'true';

/**
 * Names the service after its own package unless OTEL_SERVICE_NAME does (`@augur/registry` is
 * `registry`), and adds its version, so a deployment's compose file needn't name each one.
 */
export const nameService = (env: TelemetryEnv = process.env, dir = process.cwd()): void => {
  let pkg: { name?: string; version?: string };
  try {
    pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  } catch {
    return;
  }
  if (!env.OTEL_SERVICE_NAME && pkg.name) env.OTEL_SERVICE_NAME = pkg.name.replace(/^@[^/]+\//, '');
  if (pkg.version && !/(^|,)service\.version=/.test(env.OTEL_RESOURCE_ATTRIBUTES ?? '')) {
    env.OTEL_RESOURCE_ATTRIBUTES = [env.OTEL_RESOURCE_ATTRIBUTES, `service.version=${pkg.version}`].filter(Boolean).join(',');
  }
};

/** How long a stopping service waits to send what it still holds. */
const FLUSH_MS = 3000;

if (telemetryOn()) {
  nameService();
  // Services are ES modules: this hook lets the instrumentations see `pg` and `pino` as they're imported.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
  const [{ NodeSDK }, { HttpInstrumentation }, { UndiciInstrumentation }, { PgInstrumentation }, { PinoInstrumentation }] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-undici'),
    import('@opentelemetry/instrumentation-pg'),
    import('@opentelemetry/instrumentation-pino'),
  ]);
  const sdk = new NodeSDK({
    instrumentations: [
      // Health checks every 30 seconds would drown everything else.
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => req.url === '/healthz' }),
      new UndiciInstrumentation(),
      new PgInstrumentation(),
      // Each log line gets the trace it belongs to, and goes to the collector too.
      new PinoInstrumentation(),
    ],
  });
  sdk.start();
  // Sends what's left when Docker stops the service, then stops as Docker asked.
  process.once('SIGTERM', () => {
    const stop = () => process.kill(process.pid, 'SIGTERM');
    Promise.race([sdk.shutdown(), new Promise((r) => setTimeout(r, FLUSH_MS))]).then(stop, stop);
  });
}
