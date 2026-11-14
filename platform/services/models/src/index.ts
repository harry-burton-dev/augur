import { callerCheckFromEnv, commonSettings, loadConfigOrExit, platformCredentialsFromEnv, registryGrants, registryRequiredRole, serviceVerifierFromEnv, shadowFromEnv, startupLog, serve } from '@augur/service-kit';
import { auditTo, buildApp } from './app.ts';
import { providerFromEnv } from './config.ts';
import { PgModelStore } from './store.ts';

const log = startupLog('models');

// Every setting the model gateway reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('models', [
  commonSettings.database,
  commonSettings.registry,
  commonSettings.events,
  commonSettings.issuer,
  commonSettings.issuerInside,
  { ...commonSettings.clientSecret, required: false },
  commonSettings.gateway,
  commonSettings.permissions,
  { name: 'MODEL_API_URL', about: 'an OpenAI-style API for the model behind Agents; without it models stay off.' },
  { name: 'MODEL_API_KEY', about: 'the key to MODEL_API_URL.', secret: true },
  { name: 'MODEL_NAME', about: 'which model MODEL_API_URL serves.' },
  { name: 'MODEL_EMBEDDING_NAME', about: 'the model at MODEL_API_URL that turns text into vectors, for matching by meaning.' },
  { name: 'MODEL_TIMEOUT_SECONDS', about: 'how long to wait for the model to answer, in seconds (default 60).' },
]);

const port = Number(process.env.PORT ?? 8085);

// Settings and each app's use live in Postgres, locally too: the dev stack's
// (`docker compose -f infra/docker-compose.yml up -d postgres`). There is no in-memory copy.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set: the model gateway keeps its settings and each app’s use in Postgres. Locally, start the dev stack’s (docker compose -f infra/docker-compose.yml up -d postgres).');
}
const store = await PgModelStore.connect(process.env.DATABASE_URL);

const provider = providerFromEnv();
if (!provider) log.warn('MODEL_API_URL is not set: there is no model, so models can’t be turned on.');

// The gateway signs in as itself (platform-models) to check apps' grants and write the audit log.
const { REGISTRY_URL = 'http://localhost:8082', EVENTS_URL = 'http://localhost:8084' } = process.env;
const credentials = platformCredentialsFromEnv('models');
if (!credentials) log.warn('SERVICE_CLIENT_SECRET is not set: calls can’t be recorded, so none are made.');
const grants = credentials ? registryGrants({ registryUrl: REGISTRY_URL, credentials }) : undefined;
const requiredRole = credentials ? registryRequiredRole({ registryUrl: REGISTRY_URL, credentials }) : undefined;
const audit = credentials ? auditTo(EVENTS_URL, credentials) : undefined;

const app = await buildApp({ callers: callerCheckFromEnv('models'), store, provider, verifyService: serviceVerifierFromEnv(), grants, requiredRole, audit, shadow: shadowFromEnv(credentials, log) });
await serve(app, { port, ready: [{ name: 'database', check: () => store.ping() }], close: [() => store.close()] });
