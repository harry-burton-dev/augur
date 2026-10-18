import { buildApp } from './app.ts';
import { MemoryPreferenceStore, PgPreferenceStore, type PreferenceStore } from './store.ts';

const port = Number(process.env.PORT ?? 8081);

let store: PreferenceStore;
if (process.env.DATABASE_URL) {
  store = await PgPreferenceStore.connect(process.env.DATABASE_URL);
} else if (process.env.NODE_ENV === 'production') {
  throw new Error("DATABASE_URL is not set: identity needs Postgres to keep people's preferences.");
} else {
  console.warn("DATABASE_URL is not set: keeping people's preferences in memory until identity restarts.");
  store = new MemoryPreferenceStore();
}

const app = await buildApp({ store });
await app.listen({ port, host: '0.0.0.0' });
