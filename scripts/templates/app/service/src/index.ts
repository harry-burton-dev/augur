import { readFileSync } from 'node:fs';
import { registerApp } from '@platform/service-kit';
import { buildApp } from './app.ts';

const port = Number(process.env.PORT ?? 8090);
const app = await buildApp();
await app.listen({ port, host: '0.0.0.0' });

// Put __NAME__ in the platform's catalogue, so the shell can offer it.
const { REGISTRY_URL, SERVICE_TOKEN, APP_MANIFEST } = process.env;
if (REGISTRY_URL && SERVICE_TOKEN) {
  const manifest = JSON.parse(readFileSync(APP_MANIFEST ?? new URL('../../manifest.json', import.meta.url), 'utf8'));
  registerApp({ registryUrl: REGISTRY_URL, credentials: { name: '__ID__', token: SERVICE_TOKEN }, manifest })
    .then(() => app.log.info({ app: manifest.id, version: manifest.version }, 'registered with the platform'))
    .catch((err: Error) => app.log.error(err.message));
} else {
  app.log.info('REGISTRY_URL or SERVICE_TOKEN is not set, so __NAME__ is not in the catalogue (fine under pnpm dev:app).');
}
