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

const app = await buildApp({ store, serviceToken: process.env.SERVICE_TOKEN });
await app.listen({ port, host: '0.0.0.0' });
