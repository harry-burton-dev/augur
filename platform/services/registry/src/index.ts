import { floorPlaces, platformCredentialsFromEnv, serviceVerifierFromEnv } from '@platform/service-kit';
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

// The registry signs in as itself (Keycloak client platform-registry) to write the audit log.
const { EVENTS_URL } = process.env;
const credentials = platformCredentialsFromEnv('registry');
const audit = EVENTS_URL && credentials ? auditTo(EVENTS_URL, credentials) : undefined;
if (!audit) console.warn('EVENTS_URL or SERVICE_CLIENT_SECRET is not set: changes to the catalogue are not audited.');

// Where floors sit comes from identity, asked as the registry.
const { IDENTITY_URL = 'http://localhost:8081' } = process.env;
const floors = credentials ? floorPlaces({ identityUrl: IDENTITY_URL, credentials }) : undefined;
if (!floors) console.warn('SERVICE_CLIENT_SECRET is not set: the catalogue can’t be read floor by floor.');

// Apps and platform services sign in as themselves (their Keycloak clients).
const app = await buildApp({ store, verifyService: serviceVerifierFromEnv(), audit, floors });
await app.listen({ port, host: '0.0.0.0' });
