import { callerCheckFromEnv, commonSettings, loadConfigOrExit, platformCredentialsFromEnv, registryGrants, serviceVerifierFromEnv } from '@augur/service-kit';
import { auditTo, buildApp } from './app.ts';
import { providerFromEnv } from './config.ts';
import { MemoryModelStore, PgModelStore, type ModelStore } from './store.ts';

// Every setting the model gateway reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('models', [
  commonSettings.database,
  commonSettings.registry,
  commonSettings.events,
  commonSettings.issuer,
  commonSettings.issuerInside,
  { ...commonSettings.clientSecret, required: false },
  commonSettings.gateway,
  { name: 'MODEL_API_URL', about: 'an OpenAI-style API for the model behind Agents; without it models stay off.' },
  { name: 'MODEL_API_KEY', about: 'the key to MODEL_API_URL.', secret: true },
  { name: 'MODEL_NAME', about: 'which model MODEL_API_URL serves.' },
  { name: 'MODEL_EMBEDDING_NAME', about: 'the model at MODEL_API_URL that turns text into vectors, for matching by meaning.' },
]);

const port = Number(process.env.PORT ?? 8085);

let store: ModelStore;
if (process.env.DATABASE_URL) {
  store = await PgModelStore.connect(process.env.DATABASE_URL);
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is not set: the model gateway needs Postgres for its settings and each app’s use.');
} else {
  console.warn('DATABASE_URL is not set: keeping the settings and use in memory until the service restarts.');
  store = new MemoryModelStore();
}

const provider = providerFromEnv();
if (!provider) console.warn('MODEL_API_URL is not set: there is no model, so models can’t be turned on.');

// The gateway signs in as itself (platform-models) to check apps' grants and write the audit log.
const { REGISTRY_URL = 'http://localhost:8082', EVENTS_URL = 'http://localhost:8084' } = process.env;
const credentials = platformCredentialsFromEnv('models');
if (!credentials) console.warn('SERVICE_CLIENT_SECRET is not set: calls can’t be recorded, so none are made.');
const grants = credentials ? registryGrants({ registryUrl: REGISTRY_URL, credentials }) : undefined;
const audit = credentials ? auditTo(EVENTS_URL, credentials) : undefined;

const app = await buildApp({ callers: callerCheckFromEnv('models'), store, provider, verifyService: serviceVerifierFromEnv(), grants, audit });
await app.listen({ port, host: '0.0.0.0' });
