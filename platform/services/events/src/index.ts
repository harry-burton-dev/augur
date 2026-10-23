import { registryGrants, serviceVerifierFromEnv } from '@platform/service-kit';
import { buildApp } from './app.ts';
import { MemoryEventStore, PgEventStore, type EventStore } from './store.ts';

const port = Number(process.env.PORT ?? 8084);

let store: EventStore;
if (process.env.DATABASE_URL) {
  store = await PgEventStore.connect(process.env.DATABASE_URL);
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is not set: the events service needs Postgres for notifications and the audit log.');
} else {
  console.warn('DATABASE_URL is not set: keeping notifications and the audit log in memory until the service restarts.');
  store = new MemoryEventStore();
}

const { SERVICE_TOKEN, REGISTRY_URL = 'http://localhost:8082' } = process.env;
// Apps sign in as themselves and are held to what the registry grants them. The shared service token still works until every service has its own.
const grants = SERVICE_TOKEN ? registryGrants({ registryUrl: REGISTRY_URL, credentials: { name: 'events', token: SERVICE_TOKEN } }) : undefined;
const app = await buildApp({ store, serviceToken: SERVICE_TOKEN, verifyService: serviceVerifierFromEnv(), grants });
await app.listen({ port, host: '0.0.0.0' });
