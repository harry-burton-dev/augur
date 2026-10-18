import { buildApp } from './app.ts';
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

const app = await buildApp({ store, registrationToken: process.env.REGISTRATION_TOKEN });
await app.listen({ port, host: '0.0.0.0' });
