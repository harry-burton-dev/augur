import pg from 'pg';
import { auditTo, buildApp } from './app.ts';
import { callerCheckFromEnv, callService, commonSettings, loadConfigOrExit, notify, platformCredentialsFromEnv, registryGrants, serviceVerifierFromEnv, startupLog, steadyPool } from '@augur/service-kit';
import { KeycloakAppClients, retrying, type AppClients } from './clients.ts';
import { KeycloakDirectory, type Directory } from './directory.ts';
import { KeycloakAccounts, type AccountSource } from './me.ts';
import { IDENTITY_RIGHTS, realmLookFromEnv } from './realm.ts';
import { PgPreferenceStore } from './store.ts';
import { PgWorkspaceStore } from './workspaces.ts';
import { organisationSettings, PgOrganisationStore } from './organisation.ts';
import { PgLifecycleStore } from './lifecycle.ts';
import { reconcile, PgReconcileStore } from './reconcile.ts';
import { copySignIns, PgSignInCursorStore, type KcEvent } from './sign-ins.ts';

const log = startupLog('identity');

// Every setting identity reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('identity', [
  commonSettings.database,
  commonSettings.events,
  commonSettings.registry,
  commonSettings.issuer,
  commonSettings.issuerInside,
  commonSettings.clientSecret,
  commonSettings.gateway,
  { name: 'KEYCLOAK_URL', about: 'Keycloak as identity reaches it, such as http://keycloak:8080/sso.', required: true },
  { name: 'KEYCLOAK_REALM', about: 'the Keycloak realm people sign in to (default platform).' },
  { name: 'KEYCLOAK_ADMIN_USER', about: 'Keycloak’s own admin, only for a local stack with no SERVICE_CLIENT_SECRET; on a server the realm job uses it, never identity.' },
  { name: 'KEYCLOAK_ADMIN_PASSWORD', about: 'that admin’s password.', secret: true },
  { name: 'ORG_NAME', about: 'what the top floor, the whole organisation, is called (default Organisation).' },
]);

const port = Number(process.env.PORT ?? 8081);
const production = process.env.NODE_ENV === 'production';

// What the org's own floor is called; people see it as the top floor.
const orgName = process.env.ORG_NAME || 'Organisation';

// Identity keeps people's preferences, teams and the organisation's settings in Postgres, locally too: the
// dev stack's (`docker compose -f infra/docker-compose.yml up -d postgres`). There is no in-memory copy.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set: identity keeps people's preferences and teams in Postgres. Locally, start the dev stack's (docker compose -f infra/docker-compose.yml up -d postgres).");
}
const pool = steadyPool(new pg.Pool({ connectionString: process.env.DATABASE_URL }));
const store = new PgPreferenceStore(pool);
await store.migrate();
const workspaces = new PgWorkspaceStore(pool, { orgName });
const organisation = new PgOrganisationStore(pool);
const signInCursor = new PgSignInCursorStore(pool);
const lifecycle = new PgLifecycleStore(pool);
const reconcileStore = new PgReconcileStore(pool);

// Locally this is the dev stack's Keycloak and its admin/admin console login.
const { KEYCLOAK_URL = 'http://localhost:8180', KEYCLOAK_REALM = 'platform', KEYCLOAK_ADMIN_USER = production ? undefined : 'admin' } = process.env;
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? (production ? undefined : 'admin');
const IDENTITY_CLIENT = 'platform-identity';
// The shell's public client in the realm (infra/deploy/keycloak/platform-realm.json).
const SHELL_CLIENT = 'shell';
const ownSecret = process.env.SERVICE_CLIENT_SECRET;
// Keycloak's master admin is only for a local stack without secrets. On a server the realm job
// (realm-job.ts) holds it, sets the realm up and gives identity's own client its rights.
const keycloakAdmin = !ownSecret && KEYCLOAK_ADMIN_USER && KEYCLOAK_ADMIN_PASSWORD ? { user: KEYCLOAK_ADMIN_USER, password: KEYCLOAK_ADMIN_PASSWORD } : undefined;
if (ownSecret && production && process.env.KEYCLOAK_ADMIN_PASSWORD) {
  log.warn("Keycloak's admin password is in identity's settings but identity never uses it: take KEYCLOAK_ADMIN_PASSWORD out of identity's environment. The realm job is the only part that needs it.");
}
let directory: Directory | undefined;
let keycloakEvents: ((path: string) => Promise<KcEvent[]>) | undefined;
let appClients: AppClients | undefined;
let accounts: AccountSource | undefined;
if (ownSecret || keycloakAdmin) {
  // Identity manages people as its own client, whose rights stop at people, departments and apps'
  // sign-ins in this realm (IDENTITY_RIGHTS): it can't change how anyone signs in.
  // An invite's link ends in AUGUR itself: the shell's client, at the address people sign in from (OIDC_ISSUER's).
  const origin = process.env.OIDC_ISSUER ? new URL(process.env.OIDC_ISSUER).origin : undefined;
  const keycloak = new KeycloakDirectory({
    url: KEYCLOAK_URL,
    realm: KEYCLOAK_REALM,
    signIn: ownSecret ? { client: { id: IDENTITY_CLIENT, secret: ownSecret } } : { admin: keycloakAdmin! },
    ...(origin ? { invite: { clientId: SHELL_CLIENT, redirectUri: `${origin}/` } } : {}),
  });
  directory = keycloak;
  appClients = new KeycloakAppClients(keycloak);
  accounts = new KeycloakAccounts(keycloak);
  keycloakEvents = async (path) => (await keycloak.call<KcEvent[]>('GET', path)).data;
  if (ownSecret) {
    // Keycloak may still be starting: keep trying, then say plainly if identity's own sign-in can't do its job.
    retrying(() => keycloak.hasRights(IDENTITY_RIGHTS))
      .then((ok) => {
        if (!ok) {
          log.error(
            `identity's own sign-in (${IDENTITY_CLIENT}) doesn't have the rights it needs in the ${KEYCLOAK_REALM} realm (${IDENTITY_RIGHTS.join(', ')}), so admins can't manage people. ` +
              'Run the realm job, which gives them: pc run --rm keycloak-config (docs/deploy.md, "The realm job").',
          );
        }
      })
      .catch((err: Error) => log.error(`The sign-in service couldn't be reached: people can't be managed until it can (${err.message}).`));
  } else {
    log.warn("SERVICE_CLIENT_SECRET is not set: identity manages people as Keycloak's own admin. That's for a local stack only.");
  }
} else {
  log.warn('Neither SERVICE_CLIENT_SECRET nor KEYCLOAK_ADMIN_USER and KEYCLOAK_ADMIN_PASSWORD is set: admins cannot manage people and departments.');
}

// Identity signs in as itself (platform-identity) to write the audit log.
const { EVENTS_URL } = process.env;
const credentials = platformCredentialsFromEnv('identity');
const audit = EVENTS_URL && credentials ? auditTo(EVENTS_URL, credentials) : undefined;
if (!audit) log.warn('EVENTS_URL or SERVICE_CLIENT_SECRET is not set: admins’ changes to people and departments are not audited.');

// What apps are granted, so one with people:read can look people up for sharing.
const { REGISTRY_URL } = process.env;
const grants = REGISTRY_URL && credentials ? registryGrants({ registryUrl: REGISTRY_URL, credentials }) : undefined;
if (!grants) log.warn('REGISTRY_URL or SERVICE_CLIENT_SECRET is not set: apps can’t look people up.');

// Admins hear when someone asks to leave; a person's download carries what the events service keeps about them.
const tell = EVENTS_URL && credentials ? (notification: Parameters<typeof notify>[0]['notification']) => notify({ eventsUrl: EVENTS_URL, credentials, notification }) : undefined;
const dataFrom =
  EVENTS_URL && credentials
    ? { events: (person: string) => callService({ method: 'GET', url: `${EVENTS_URL.replace(/\/$/, '')}/v1/people/${encodeURIComponent(person)}/data`, credentials, what: 'read their notifications, inbox and activity' }) }
    : undefined;

// Sign-ins and failed ones reach Activity (ADR 0040): copied from Keycloak each minute.
if (keycloakEvents && audit) {
  const events = keycloakEvents;
  const copy = () =>
    copySignIns({ events, store: signInCursor, audit: (entry) => audit(entry), signedIn: (person, at) => lifecycle.signedIn(person, at) }).catch((err: Error) =>
      log.error(`Sign-ins couldn't be copied into Activity this time; identity tries again in a minute (${err.message}).`),
    );
  setInterval(copy, 60_000).unref();
  void copy();
}

// A sign-in turned off or on in Keycloak itself (its console, or later its idle Workflow) is noticed within
// five minutes: sessions end, identity keeps it, and Activity and followers hear it (PER-194).
if (directory) {
  const people = directory;
  const compare = () =>
    reconcile({ directory: people, lifecycle, store: reconcileStore, audit, idle: async () => (await organisationSettings(workspaces, organisation)).idle }).catch((err: Error) =>
      log.error(`Identity couldn't compare sign-ins with Keycloak this time; it tries again in five minutes (${err.message}).`),
    );
  setInterval(compare, 5 * 60_000).unref();
  void compare();
}

const app = await buildApp({ callers: callerCheckFromEnv('identity'), store, workspaces, directory, accounts, appClients, audit, verifyService: serviceVerifierFromEnv(), grants, tell, dataFrom, languages: realmLookFromEnv(process.env, (m) => log.warn(m)).languages, organisation, lifecycle });
await app.listen({ port, host: '0.0.0.0' });
