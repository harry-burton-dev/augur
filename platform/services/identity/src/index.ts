import pg from 'pg';
import { auditTo, buildApp } from './app.ts';
import { callerCheckFromEnv, commonSettings, loadConfigOrExit, platformCredentialsFromEnv, registryGrants, serviceVerifierFromEnv } from '@augur/service-kit';
import { ensureClients, KeycloakAppClients, parseClientSecrets, type AppClients } from './clients.ts';
import { KeycloakDirectory, PLATFORM_ROLES, type Directory } from './directory.ts';
import { MemoryPreferenceStore, PgPreferenceStore, type PreferenceStore } from './store.ts';
import { MemoryWorkspaceStore, PgWorkspaceStore, type WorkspaceStore } from './workspaces.ts';

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
  { name: 'KEYCLOAK_ADMIN_USER', about: 'the Keycloak admin identity manages people as.', required: true },
  { name: 'KEYCLOAK_ADMIN_PASSWORD', about: 'that admin’s password.', required: true, secret: true },
  { name: 'SERVICE_CLIENT_SECRETS', about: 'each platform service’s sign-in secret, client=secret, comma separated, for identity to make their Keycloak clients.', secret: true },
  { name: 'ORG_NAME', about: 'what the top floor, the whole organisation, is called (default Organisation).' },
]);

const port = Number(process.env.PORT ?? 8081);
const production = process.env.NODE_ENV === 'production';

// What the org's own floor is called; people see it as the top floor.
const orgName = process.env.ORG_NAME || 'Organisation';

let store: PreferenceStore;
let workspaces: WorkspaceStore;
if (process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prefs = new PgPreferenceStore(pool);
  await prefs.migrate();
  store = prefs;
  workspaces = new PgWorkspaceStore(pool, { orgName });
} else if (production) {
  throw new Error("DATABASE_URL is not set: identity needs Postgres to keep people's preferences and teams.");
} else {
  console.warn("DATABASE_URL is not set: keeping people's preferences and teams in memory until identity restarts.");
  store = new MemoryPreferenceStore();
  workspaces = new MemoryWorkspaceStore({ orgName });
}

// Locally this is the dev stack's Keycloak and its admin/admin console login.
const { KEYCLOAK_URL = 'http://localhost:8180', KEYCLOAK_REALM = 'platform', KEYCLOAK_ADMIN_USER = production ? undefined : 'admin' } = process.env;
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? (production ? undefined : 'admin');
let directory: Directory | undefined;
let appClients: AppClients | undefined;
if (KEYCLOAK_ADMIN_USER && KEYCLOAK_ADMIN_PASSWORD) {
  const keycloak = new KeycloakDirectory({ url: KEYCLOAK_URL, realm: KEYCLOAK_REALM, adminUser: KEYCLOAK_ADMIN_USER, adminPassword: KEYCLOAK_ADMIN_PASSWORD });
  directory = keycloak;
  appClients = new KeycloakAppClients(keycloak);
  // A server set up before a role was added gets it now; Keycloak reads its realm file only when it first starts.
  keycloak
    .ensureRoles(PLATFORM_ROLES)
    .then((made) => made.length && console.info(`Added the ${made.join(', ')} role${made.length === 1 ? '' : 's'} to the sign-in service.`))
    .catch((err: Error) => console.error(`The platform's roles couldn't be checked in the sign-in service (${err.message}).`));
} else {
  console.warn('KEYCLOAK_ADMIN_USER or KEYCLOAK_ADMIN_PASSWORD is not set: admins cannot manage people and departments.');
}

// The platform's own services (and, locally, the sample apps) sign in with secrets from the server's settings;
// identity makes their Keycloak clients, since the realm file is only read when Keycloak first starts.
const secrets = parseClientSecrets(process.env.SERVICE_CLIENT_SECRETS);
if (appClients && secrets.length) {
  ensureClients(appClients, secrets, (message) => console.info(message)).catch((err: Error) =>
    console.error(`The platform's services can't sign in: their sign-ins couldn't be made (${err.message}).`),
  );
}

// Identity signs in as itself (platform-identity) to write the audit log.
const { EVENTS_URL } = process.env;
const credentials = platformCredentialsFromEnv('identity');
const audit = EVENTS_URL && credentials ? auditTo(EVENTS_URL, credentials) : undefined;
if (!audit) console.warn('EVENTS_URL or SERVICE_CLIENT_SECRET is not set: admins’ changes to people and departments are not audited.');

// What apps are granted, so one with people:read can look people up for sharing.
const { REGISTRY_URL } = process.env;
const grants = REGISTRY_URL && credentials ? registryGrants({ registryUrl: REGISTRY_URL, credentials }) : undefined;
if (!grants) console.warn('REGISTRY_URL or SERVICE_CLIENT_SECRET is not set: apps can’t look people up.');

const app = await buildApp({ callers: callerCheckFromEnv('identity'), store, workspaces, directory, appClients, audit, verifyService: serviceVerifierFromEnv(), grants });
await app.listen({ port, host: '0.0.0.0' });
