import pg from 'pg';
import { askModel, callerCheckFromEnv,commonSettings, floorPlaces, identityPrincipals, loadConfigOrExit, platformCredentialsFromEnv, startupLog } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { outboxRelay } from './outbox.ts';
import { identityStanding } from './standing.ts';

const log = startupLog('knowledge');

// Every setting the knowledge service reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('knowledge', [
  { ...commonSettings.database, about: 'the Postgres address and the knowledge service’s own login (kg_app), which row security fences.' },
  commonSettings.identity,
  commonSettings.events,
  commonSettings.issuer,
  commonSettings.issuerInside,
  commonSettings.clientSecret,
  commonSettings.gateway,
  { ...commonSettings.models, required: false, about: 'where the model gateway is, such as http://models:8085. Without it, retain takes no text to extract from.' },
  { name: 'KNOWLEDGE_PAGE_LIMIT', about: 'the most one page of a read gives, such as 100.' },
  { name: 'KNOWLEDGE_SUBGRAPH_DEPTH', about: 'the most hops a subgraph read goes from its entity, such as 3.' },
]);

const port = Number(process.env.PORT ?? 8086);
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set: the knowledge service keeps the graph in Postgres, as its own login kg_app. Locally, start the dev stack’s (docker compose -f infra/docker-compose.yml up -d postgres).');
}
// kg_app owns nothing and writes only through the store's actions: the migration job made the schema.
const store = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

const { IDENTITY_URL = 'http://localhost:8081', EVENTS_URL = 'http://localhost:8084' } = process.env;
const credentials = platformCredentialsFromEnv('knowledge');
if (!credentials) log.warn('SERVICE_CLIENT_SECRET is not set: identity can’t be asked where people stand, so every read and action is refused for now.');
const standing = credentials ? identityStanding({ principals: identityPrincipals({ identityUrl: IDENTITY_URL, credentials }), places: floorPlaces({ identityUrl: IDENTITY_URL, credentials }) }) : undefined;

/** A whole number above 0 from the environment, or undefined for the service's default. */
const positive = (name: string, example: number) => {
  const raw = process.env[name];
  if (!raw) return undefined;
  const n = Number(raw);
  if (!(Number.isInteger(n) && n > 0)) throw new Error(`${name} must be a whole number above 0, such as ${example}.`);
  return n;
};
const pageLimit = positive('KNOWLEDGE_PAGE_LIMIT', 100);
const subgraphDepth = positive('KNOWLEDGE_SUBGRAPH_DEPTH', 3);
const { MODELS_URL } = process.env;
if (!MODELS_URL) log.warn('MODELS_URL is not set: retain takes only what was already extracted, not text to read.');
// The model reads for the floor the text is retained on, so the floor's model rules and its record apply.
const extract =
  MODELS_URL && credentials
    ? async (messages: { role: 'system' | 'user'; content: string }[], floor: string | undefined) =>
        (await askModel({ modelsUrl: MODELS_URL, credentials, workspace: floor, messages })).message.content
    : undefined;
const app = await buildApp({ store, standing, callers: callerCheckFromEnv('knowledge'), extract, pageLimit, subgraphDepth });
await app.listen({ port, host: '0.0.0.0' });
if (credentials) outboxRelay({ pool: store, eventsUrl: EVENTS_URL, credentials, onError: (err) => app.log.error({ err }, 'the outbox could not be sent') }).start();
