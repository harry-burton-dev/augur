import { commonSettings, loadConfigOrExit } from '@augur/service-kit';
import { buildApp } from './app.ts';

// Every setting the gateway reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('gateway', [
  commonSettings.identity,
  commonSettings.registry,
  commonSettings.events,
  commonSettings.models,
  commonSettings.issuer,
  { name: 'OIDC_JWKS_URL', about: 'where the sign-in service’s signing keys are, when the gateway reaches it at another address than browsers do.' },
  { name: 'OIDC_AUDIENCE', about: 'the audience people’s tokens are issued for (default platform-api).' },
  { name: 'CALLER_SIGNING_KEY', about: 'the key the gateway signs callers with (64 hex); without it a new one is made each start, so only one gateway can run.', secret: true },
  { name: 'APP_UPSTREAMS', about: 'apps’ services the gateway is started with, name=url, comma separated.' },
  { name: 'BACKUP_DIR', about: 'where the backup container writes its results, for Status.' },
]);

const port = Number(process.env.PORT ?? 8080);
const app = await buildApp();
await app.listen({ port, host: '0.0.0.0' });
