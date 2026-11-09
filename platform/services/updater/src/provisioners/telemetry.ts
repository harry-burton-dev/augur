/** augur-telemetry: the deployment's collector, when it has one; without one the endpoint is empty and the part carries on (spec 4.6). */
import { envValue } from '../env-file.ts';
import type { Provisioner } from './types.ts';

/** The deployment's own collector, as compose.yml names it when .env names none. */
export const OWN_COLLECTOR = 'http://otel-lgtm:4318';

/** Where AUGUR's own services send telemetry (compose.yml's x-otel): none when it's turned off or otel-lgtm doesn't run. */
export const collectorOf = (env: string) => {
  if (envValue(env, 'OTEL_SDK_DISABLED') === 'true') return '';
  const named = envValue(env, 'OTEL_EXPORTER_OTLP_ENDPOINT');
  if (named) return named;
  return envValue(env, 'OTEL_LGTM_REPLICAS') === '0' ? '' : OWN_COLLECTOR;
};

/**
 * Where an app's parts may send telemetry: AUGUR's own collector, which joins the app's network, or none.
 * A collector elsewhere is outside, which an app's network doesn't reach (spec 4.8), so the parts send nothing.
 */
export const appCollectorOf = (env: string) => (collectorOf(env) === OWN_COLLECTOR ? OWN_COLLECTOR : '');

export const telemetry: Provisioner = {
  type: 'augur-telemetry',
  uri: 'template://augur/telemetry',
  params: [],
  check: () => [],
  needs: [],
  outputs: ({ app, part, env }) => ({
    otlp_endpoint: { value: appCollectorOf(env) },
    service_name: { value: `${app}-${part}` },
  }),
  compose: () => ({}),
};
