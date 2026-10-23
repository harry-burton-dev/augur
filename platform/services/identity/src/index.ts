import pg from 'pg';
import { auditTo, buildApp } from './app.ts';
import { platformCredentialsFromEnv } from '@platform/service-kit';
import { ensureClients, KeycloakAppClients, parseClientSecrets, type AppClients } from './clients.ts';
import { KeycloakDirectory, type Directory } from './directory.ts';
import { MemoryPreferenceStore, PgPreferenceStore, type PreferenceStore } from './store.ts';
import { MemoryWorkspaceStore, PgWorkspaceStore, type WorkspaceStore } from './workspaces.ts';

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

const app = await buildApp({ store, workspaces, directory, appClients, audit });
await app.listen({ port, host: '0.0.0.0' });
