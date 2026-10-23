import { readFileSync } from 'node:fs';
import { appCredentialsFromEnv, registerApp } from '@platform/service-kit';
import { buildApp } from './app.ts';

const port = Number(process.env.PORT ?? 8090);
const app = await buildApp();
await app.listen({ port, host: '0.0.0.0' });

// Put __NAME__ in the platform's catalogue, so the shell can offer it.
// It signs in as itself with SERVICE_CLIENT_SECRET (issued for it by an admin), or with the shared SERVICE_TOKEN while that still works.
const { REGISTRY_URL, APP_MANIFEST } = process.env;
const credentials = appCredentialsFromEnv('__ID__');
if (REGISTRY_URL && credentials) {
  const manifest = JSON.parse(readFileSync(APP_MANIFEST ?? new URL('../../manifest.json', import.meta.url), 'utf8'));
  registerApp({ registryUrl: REGISTRY_URL, credentials, manifest })
    .then(() => app.log.info({ app: manifest.id, version: manifest.version }, 'registered with the platform'))
    .catch((err: Error) => app.log.error(err.message));
} else {
  app.log.info('REGISTRY_URL or the app’s sign-in (SERVICE_CLIENT_SECRET) is not set, so __NAME__ is not in the catalogue (fine under pnpm dev:app).');
}
