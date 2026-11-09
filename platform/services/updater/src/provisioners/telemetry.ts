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

export const telemetry: Provisioner = {
  type: 'augur-telemetry',
  uri: 'template://augur/telemetry',
  params: [],
  check: () => [],
  needs: [],
  outputs: ({ app, part, env }) => ({
    otlp_endpoint: { value: collectorOf(env) },
    service_name: { value: `${app}-${part}` },
  }),
  compose: () => ({}),
};
