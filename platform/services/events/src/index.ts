import { callerCheckFromEnv, commonSettings, floorMembers, floorPlaces, identityAudience, loadConfigOrExit, platformCredentialsFromEnv, registryGrants, serviceVerifierFromEnv } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { MemoryEventStore, PgEventStore, type EventStore } from './store.ts';

// Every setting events reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('events', [
  commonSettings.database,
  commonSettings.registry,
  commonSettings.identity,
  commonSettings.issuer,
  commonSettings.issuerInside,
  commonSettings.clientSecret,
  commonSettings.gateway,
  { name: 'DOMAIN_EVENTS_KEEP_DAYS', about: 'how many days apps’ domain events are kept (default 30).' },
]);

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

// Apps sign in as themselves and are held to what the registry grants them; events asks the registry as itself (platform-events).
const { REGISTRY_URL = 'http://localhost:8082', IDENTITY_URL = 'http://localhost:8081' } = process.env;
const credentials = platformCredentialsFromEnv('events');
if (!credentials) console.warn('SERVICE_CLIENT_SECRET is not set: apps’ grants can’t be checked, so only platform services can notify or write the audit log.');
const grants = credentials ? registryGrants({ registryUrl: REGISTRY_URL, credentials }) : undefined;
// Where floors sit, and who is on a team, come from identity, asked as events.
const floors = credentials ? floorPlaces({ identityUrl: IDENTITY_URL, credentials }) : undefined;
const members = credentials ? floorMembers({ identityUrl: IDENTITY_URL, credentials }) : undefined;
// Who an audience such as role:deployment-admin reaches, for the platform's own notifications (ADR 0044).
const audience = credentials ? identityAudience({ identityUrl: IDENTITY_URL, credentials }) : undefined;
const app = await buildApp({ callers: callerCheckFromEnv('events'), store, verifyService: serviceVerifierFromEnv(), grants, floors, members, audience });
await app.listen({ port, host: '0.0.0.0' });

// Domain events are for followers to catch up on, not a record: they're kept DOMAIN_EVENTS_KEEP_DAYS (30) days.
const keepDays = Number(process.env.DOMAIN_EVENTS_KEEP_DAYS ?? 30);
const prune = () =>
  store.pruneEvents(keepDays).then(
    (n) => n && app.log.info({ removed: n, keepDays }, 'old domain events removed'),
    (err) => app.log.error({ err: String(err) }, 'removing old domain events failed'),
  );
void prune();
setInterval(prune, 3_600_000).unref();
