import { serviceVerifierFromEnv } from '@platform/service-kit';
import { auditTo, buildApp } from './app.ts';
import { MemoryAppStore, PgAppStore, type AppStore } from './store.ts';

const port = Number(process.env.PORT ?? 8082);

let store: AppStore;
if (process.env.DATABASE_URL) {
  store = await PgAppStore.connect(process.env.DATABASE_URL);
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is not set: the registry needs Postgres to keep the catalogue.');
} else {
  console.warn('DATABASE_URL is not set: keeping registered apps in memory until the registry restarts.');
  store = new MemoryAppStore();
}

const { SERVICE_TOKEN, EVENTS_URL } = process.env;
const audit = EVENTS_URL && SERVICE_TOKEN ? auditTo(EVENTS_URL, { name: 'registry', token: SERVICE_TOKEN }) : undefined;
if (!audit) console.warn('EVENTS_URL or SERVICE_TOKEN is not set: changes to the catalogue are not audited.');

// Apps sign in as themselves (their Keycloak client); the shared service token still works until every service has its own.
const app = await buildApp({ store, serviceToken: SERVICE_TOKEN, verifyService: serviceVerifierFromEnv(), audit });
await app.listen({ port, host: '0.0.0.0' });
