import { callerCheckFromEnv, commonSettings, floorMembers, floorPlaces, identityAudience, identityDirectory, identityPrincipals, loadConfigOrExit, platformCredentialsFromEnv, registryGrants, registryInboxKinds, registryNotificationKinds, serviceVerifierFromEnv } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { policyKeepDays, pruneActivity, untilNight } from './retention.ts';
import { PgEventStore, type EventStore } from './store.ts';

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
  { name: 'INBOX_KEEP_DAYS', about: 'how many days closed inbox items are kept (default 90).' },
]);

const port = Number(process.env.PORT ?? 8084);

// Notifications, Activity and the inbox live in Postgres, locally too: the dev stack's
// (`docker compose -f infra/docker-compose.yml up -d postgres`). There is no in-memory copy.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set: the events service keeps notifications and the audit log in Postgres. Locally, start the dev stack’s (docker compose -f infra/docker-compose.yml up -d postgres).');
}
const store: EventStore = await PgEventStore.connect(process.env.DATABASE_URL);

// Apps sign in as themselves and are held to what the registry grants them; events asks the registry as itself (platform-events).
const { REGISTRY_URL = 'http://localhost:8082', IDENTITY_URL = 'http://localhost:8081' } = process.env;
const credentials = platformCredentialsFromEnv('events');
if (!credentials) console.warn('SERVICE_CLIENT_SECRET is not set: apps’ grants can’t be checked, so only platform services can notify or write the audit log.');
const grants = credentials ? registryGrants({ registryUrl: REGISTRY_URL, credentials }) : undefined;
// The inbox kinds each app's manifest declares; an item of another kind is refused.
const inboxKinds = credentials ? registryInboxKinds({ registryUrl: REGISTRY_URL, credentials }) : undefined;
// The notification kinds each app's manifest declares; a notification of another kind is refused.
const notificationKinds = credentials ? registryNotificationKinds({ registryUrl: REGISTRY_URL, credentials }) : undefined;
// Where floors sit, and who is on a team, come from identity, asked as events.
const floors = credentials ? floorPlaces({ identityUrl: IDENTITY_URL, credentials }) : undefined;
const members = credentials ? floorMembers({ identityUrl: IDENTITY_URL, credentials }) : undefined;
// Who an audience such as role:deployment-admin reaches, for the platform's own notifications (ADR 0044).
const audience = credentials ? identityAudience({ identityUrl: IDENTITY_URL, credentials }) : undefined;
// An inbox item's owner must be someone who can sign in (the directory lists only them), and a person's teams decide which team items they see.
const directory = credentials ? identityDirectory({ identityUrl: IDENTITY_URL, credentials }) : undefined;
const principals = credentials ? identityPrincipals({ identityUrl: IDENTITY_URL, credentials }) : undefined;
const app = await buildApp({ callers: callerCheckFromEnv('events'), store, verifyService: serviceVerifierFromEnv(), grants, floors, members, audience, directory, principals, inboxKinds, notificationKinds });
await app.listen({ port, host: '0.0.0.0' });

// Domain events are for followers to catch up on, not a record: they're kept DOMAIN_EVENTS_KEEP_DAYS (30) days.
const keepDays = Number(process.env.DOMAIN_EVENTS_KEEP_DAYS || 30);
// Closed inbox items are kept INBOX_KEEP_DAYS (90) days, then go with their history; the audit log keeps every step.
const inboxDays = Number(process.env.INBOX_KEEP_DAYS || 90);
const prune = () =>
  Promise.all([
    store.pruneEvents(keepDays).then(
      (n) => n && app.log.info({ removed: n, keepDays }, 'old domain events removed'),
      (err) => app.log.error({ err: String(err) }, 'removing old domain events failed'),
    ),
    store.inbox.prune(inboxDays).then(
      (n) => n && app.log.info({ removed: n, keepDays: inboxDays }, 'old closed inbox items removed'),
      (err) => app.log.error({ err: String(err) }, 'removing old inbox items failed'),
    ),
  ]);
void prune();
setInterval(prune, 3_600_000).unref();

// Activity keeps entries for the organisation's retention period (Admin, Settings), 365 days when identity can't say;
// once a night the older ones go, and the removal is itself recorded in Activity.
const keepActivity = policyKeepDays({ identityUrl: IDENTITY_URL, credentials });
const pruneOld = () =>
  pruneActivity(store, keepActivity).then(
    ({ removed, days, defaulted }) => {
      if (defaulted) app.log.warn({ keepDays: days, why: defaulted }, 'Activity retention: using the default');
      if (removed) app.log.info({ removed, keepDays: days }, 'old Activity entries removed');
    },
    (err) => app.log.error({ err: String(err) }, 'removing old Activity entries failed'),
  );
setTimeout(() => {
  void pruneOld();
  setInterval(pruneOld, 86_400_000).unref();
}, untilNight()).unref();
