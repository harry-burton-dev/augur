import pg from 'pg';
import { askModel, callerCheckFromEnv,commonSettings, floorPlaces, identityPrincipals, loadConfigOrExit, platformCredentialsFromEnv, startupLog } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { fileLedger } from './ledger.ts';
import { outboxRelay } from './outbox.ts';
import { DEFAULT_BUDGETS, reflectScheduler } from './reflect.ts';
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
  { name: 'KNOWLEDGE_REFLECT_DEBOUNCE_SECONDS', about: 'how long an entity’s beliefs must be quiet before reflect summarises it, such as 600.' },
  { name: 'KNOWLEDGE_REFLECT_DAILY_BUDGET', about: 'the most summaries reflect writes a day for the whole deployment, such as 400; keep it under the models service’s daily limit, with room for extraction.' },
  { name: 'KNOWLEDGE_REFLECT_FLOOR_BUDGET', about: 'the most summaries reflect writes a day on any one floor, such as 100.' },
  { name: 'KNOWLEDGE_LEDGER_DIR', about: 'the folder, on a volume of its own, where each forget is written so a restore from backup forgets it again.', required: true },
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
const { KNOWLEDGE_LEDGER_DIR } = process.env;
if (!KNOWLEDGE_LEDGER_DIR) log.warn('KNOWLEDGE_LEDGER_DIR is not set: what people forget is forgotten, but a restore from backup would bring its words back.');
const ledger = KNOWLEDGE_LEDGER_DIR ? fileLedger(KNOWLEDGE_LEDGER_DIR) : undefined;
const app = await buildApp({ store, standing, callers: callerCheckFromEnv('knowledge'), extract, ledger, pageLimit, subgraphDepth });
await app.listen({ port, host: '0.0.0.0' });
// Reflect writes each floor's summaries from its own beliefs, through the models service, within its budgets.
if (MODELS_URL && credentials) {
  const budgets = {
    debounceSeconds: positive('KNOWLEDGE_REFLECT_DEBOUNCE_SECONDS', DEFAULT_BUDGETS.debounceSeconds) ?? DEFAULT_BUDGETS.debounceSeconds,
    daily: positive('KNOWLEDGE_REFLECT_DAILY_BUDGET', DEFAULT_BUDGETS.daily) ?? DEFAULT_BUDGETS.daily,
    perFloor: positive('KNOWLEDGE_REFLECT_FLOOR_BUDGET', DEFAULT_BUDGETS.perFloor) ?? DEFAULT_BUDGETS.perFloor,
  };
  reflectScheduler({
    pool: store,
    budgets,
    ask: async (messages, floor) => {
      const answer = await askModel({ modelsUrl: MODELS_URL, credentials, workspace: floor, messages });
      return { content: answer.message.content, model: answer.model };
    },
    log: (msg, detail) => app.log.info(detail ?? {}, msg),
  }).start();
} else {
  log.warn('Reflect is off: without MODELS_URL and the service’s sign-in, entities show their beliefs without summaries.');
}
if (credentials) outboxRelay({ pool: store, eventsUrl: EVENTS_URL, credentials, onError: (err) => app.log.error({ err }, 'the outbox could not be sent') }).start();
