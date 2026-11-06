import { callerCheckFromEnv, commonSettings, createJobs, floorMembers, floorPlaces, identityAudience, identityDirectory, identityPrincipals, loadConfigOrExit, platformCredentialsFromEnv, registryGrants, registryInboxKinds, registryNotificationKinds, serviceHeaders, serviceVerifierFromEnv, startupLog } from '@augur/service-kit';
import { Mailer, mailRelayFromEnv, organisationSender } from '@augur/service-kit/mail';
import { buildApp } from './app.ts';
import { finishReleases } from './inbox-routes.ts';
import { identityDigestPeople, sendDigests } from './digests.ts';
import { identityNoticeSettings, sendDueEmails } from './notice-emails.ts';
import { policyKeepDays, pruneActivity, untilNight } from './retention.ts';
import { PgEventStore, type EventStore } from './store.ts';

const log = startupLog('events');

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
  { name: 'INBOX_DONE_DAYS', about: 'how many days back the Inbox’s Done tab looks (default 30).' },
  { name: 'PLATFORM_URL', about: 'AUGUR’s address, for the link back in notice emails.' },
  { name: 'ORG_PRODUCT_NAME', about: 'what people call the product, in notice emails (default AUGUR).' },
  { name: 'SMTP_HOST', about: 'the organisation’s mail relay; without one, no notice is emailed and Account says why.' },
  { name: 'SMTP_PORT', about: 'the relay’s port.' },
  { name: 'SMTP_SECURITY', about: 'starttls, tls or none.' },
  { name: 'SMTP_FROM', about: 'the address mail comes from until an admin sets the organisation’s sender.' },
  { name: 'SMTP_USER', about: 'the relay sign-in, when it needs one.' },
  { name: 'SMTP_PASSWORD', about: 'the relay password.', secret: true },
]);

const port = Number(process.env.PORT ?? 8084);

// Notifications, Activity and the inbox live in Postgres, locally too: the dev stack's
// (`docker compose -f infra/docker-compose.yml up -d postgres`). There is no in-memory copy.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set: the events service keeps notifications and the audit log in Postgres. Locally, start the dev stack’s (docker compose -f infra/docker-compose.yml up -d postgres).');
}
// The Inbox's Done tab shows items closed in the last INBOX_DONE_DAYS (30) days; the shell reads the number from /inbox/counts.
const inboxDoneDays = Number(process.env.INBOX_DONE_DAYS || 30);
const store: EventStore = await PgEventStore.connect(process.env.DATABASE_URL, { inboxDoneDays });

// Apps sign in as themselves and are held to what the registry grants them; events asks the registry as itself (platform-events).
const { REGISTRY_URL = 'http://localhost:8082', IDENTITY_URL = 'http://localhost:8081' } = process.env;
const credentials = platformCredentialsFromEnv('events');
if (!credentials) log.warn('SERVICE_CLIENT_SECRET is not set: apps’ grants can’t be checked, so only platform services can notify or write the audit log.');
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

// A leaver's team items that couldn't all go back as the change was recorded are given back here.
const giveBack = () =>
  finishReleases(store, (err) => app.log.error({ err: String(err) }, 'could not give back a leaver’s inbox items yet')).catch((err: unknown) =>
    app.log.error({ err: String(err) }, 'could not read which inbox items to give back'),
  );
setInterval(giveBack, 5 * 60_000).unref();

// Activity keeps entries for the organisation's retention period (Admin, Settings). Once a night the older ones go,
// and the removal is itself recorded in Activity; on a night identity can't say what the period is, none do.
const keepActivity = policyKeepDays({ identityUrl: IDENTITY_URL, credentials });
const pruneOld = () =>
  pruneActivity(store, keepActivity).then(
    ({ removed, days, defaulted }) => {
      if (defaulted) app.log.warn({ why: defaulted }, 'Activity retention: nothing removed tonight');
      if (removed) app.log.info({ removed, keepDays: days }, 'old Activity entries removed');
    },
    (err) => app.log.error({ err: String(err) }, 'removing old Activity entries failed'),
  );
setTimeout(() => {
  void pruneOld();
  setInterval(pruneOld, 86_400_000).unref();
}, untilNight()).unref();

// Notices that need someone are emailed to them (ADR 0044, D7): once a minute, across every instance, the
// notice-emails job sends what is due, as each person chose in Account → Notifications. From the organisation's sender.
const mailer = new Mailer({
  relay: mailRelayFromEnv(process.env, (message) => log.warn(message)),
  productName: process.env.ORG_PRODUCT_NAME || 'AUGUR',
  sender: credentials ? organisationSender({ identityUrl: IDENTITY_URL, headers: () => serviceHeaders(credentials), warn: (message) => log.warn(message) }) : undefined,
});
if (!mailer.configured) log.warn('SMTP_HOST is not set: no notice is emailed, and Account says why.');
if (!process.env.PLATFORM_URL) log.warn('PLATFORM_URL is not set: notice emails go without a link back to AUGUR.');
const jobs = createJobs({ app: 'events', databaseUrl: process.env.DATABASE_URL, log: app.log });
if (credentials) {
  const settings = identityNoticeSettings({ identityUrl: IDENTITY_URL, credentials });
  jobs.schedule('notice-emails', '* * * * *', async () => {
    const done = await sendDueEmails({ outbox: store.emails, settings, mailer, platformUrl: process.env.PLATFORM_URL, log: app.log });
    if (done.sent || done.failed) app.log.info(done, 'notice emails');
  });
  // The daily and weekly digests, each person's at 08:00 their time (Mondays for weekly): looked at every hour.
  const people = identityDigestPeople({ identityUrl: IDENTITY_URL, credentials });
  jobs.schedule('digests', '0 * * * *', async () => {
    for (const kind of ['daily', 'weekly'] as const) {
      const done = await sendDigests({ kind, people, store: store.digests, mailer, platformUrl: process.env.PLATFORM_URL, log: app.log });
      if (done.sent || done.failed) app.log.info({ kind, ...done }, 'digests');
    }
  });
} else log.warn('SERVICE_CLIENT_SECRET is not set: identity can’t be asked how people want notices, so none is emailed.');
await jobs.launch();
