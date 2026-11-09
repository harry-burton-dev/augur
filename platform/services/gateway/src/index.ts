import { commonSettings, loadConfigOrExit } from '@augur/service-kit';
import { buildApp } from './app.ts';

// Every setting the gateway reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('gateway', [
  commonSettings.identity,
  commonSettings.registry,
  commonSettings.events,
  commonSettings.models,
  { name: 'KNOWLEDGE_URL', about: 'where the knowledge graph service is, such as http://knowledge:8086.', required: true },
  commonSettings.issuer,
  { name: 'OIDC_JWKS_URL', about: 'where the sign-in service’s signing keys are, when the gateway reaches it at another address than browsers do.' },
  { name: 'OIDC_AUDIENCE', about: 'the audience people’s tokens are issued for (default platform-api).' },
  { name: 'OIDC_SERVICE_AUDIENCE', about: 'the audience apps’ and platform services’ own tokens are issued for (default platform-services).' },
  { name: 'OIDC_INTERNAL_URL', about: 'the sign-in service as the gateway reaches it, where a part’s client-credentials grant is passed on to.' },
  { name: 'OIDC_TOKEN_URL', about: 'the sign-in service’s token endpoint, when it isn’t OIDC_INTERNAL_URL’s.' },
  { name: 'APP_DELEGATION_SECONDS', about: 'how long a delegated caller lasts, in seconds (default 300).' },
  { name: 'APP_CONNECT_TIMEOUT_MS', about: 'how long to wait to connect to an app’s part before answering 502 (default 5000).' },
  { name: 'APP_RESPONSE_TIMEOUT_MS', about: 'how long an app’s part may take to answer before 504 (default 60000).' },
  { name: 'APP_CONCURRENT_CALLS', about: 'how many calls one app may have in flight before the next answers 503 (default 64).' },
  { name: 'CALLER_SIGNING_KEY', about: 'the key the gateway signs callers with (64 hex); without it a new one is made each start, so only one gateway can run.', secret: true },
  { name: 'APP_UPSTREAMS', about: 'apps’ services the gateway is started with, name=url, comma separated.' },
  { name: 'BACKUP_DIR', about: 'where the backup container writes its results, for Status.' },
  { name: 'SEED_ALLOWED', about: 'true lets an admin fill this deployment with synthetic sample data (pnpm seed); off unless set.' },
  { name: 'PUBLIC_ACCESS_FILE', about: 'what infra/deploy/public.sh writes when AUGUR is open to the internet, for Status.' },
]);

const port = Number(process.env.PORT ?? 8080);
const app = await buildApp();
await app.listen({ port, host: '0.0.0.0' });
