/**
 * The ids an app may not take, because a part of AUGUR already answers to them. An app's id becomes its
 * /api/<id> at the gateway, its /apps/<id>/ at the front door, its Compose service when the app runner
 * runs it, its database schema and login, and its bucket, so it must not be any of these. The registry
 * refuses a manifest with one, and the storage service makes no schema for one.
 */
export const RESERVED_APP_IDS: Readonly<Record<string, string>> = {
  // The platform's services: each has its /api/<name>, its own schema and its own sign-in (platform-<name>).
  identity: 'the identity service',
  registry: 'the registry',
  events: 'the events service',
  models: 'the models service',
  storage: 'the storage service',
  gateway: 'the gateway',
  updater: 'the updater',
  // The platform's own apps, which the shell serves itself.
  shell: 'the shell',
  home: 'Home',
  admin: 'Admin',
  upgrades: 'the Upgrade Centre',
  'sign-in-theme': 'AUGUR’s sign-in pages and emails, in its Keycloak image',
  // What every deployment runs beside them (infra/deploy/compose.yml).
  web: 'the front door',
  postgres: 'the database',
  keycloak: 'the sign-in service',
  'keycloak-config': 'the sign-in realm’s set-up job',
  garage: 'the object store',
  backup: 'the backups',
  tailscale: 'the tailnet',
  'docker-proxy': 'the updater’s line to Docker',
  'otel-lgtm': 'the observability stack',
  // The paths the front door serves itself (infra/deploy/nginx.conf).
  api: 'the gateway’s path, /api/',
  sso: 'the sign-in path, /sso/',
  apps: 'the apps’ path, /apps/',
  kit: 'the UI kit’s path, /kit/',
  shared: 'the shared modules’ path, /shared/',
  assets: 'the shell’s assets, /assets/',
  // Names the deployment itself goes by: its database, sign-in realm and Compose project, and Postgres's own schemas.
  augur: 'AUGUR itself',
  platform: 'AUGUR’s database, sign-in realm and Compose project',
  public: 'the database’s shared schema',
  'information-schema': 'the database’s own schema',
};

/** Beginnings an app's id may not have, and what they're kept for. */
export const RESERVED_APP_ID_PREFIXES: Readonly<Record<string, string>> = {
  'augur-': 'the platform’s own buckets',
  'pg-': 'the database’s own schemas',
};

/** Why an app can't take `id` because AUGUR keeps it, or undefined when it can. */
export const reservedIdProblem = (id: string): string | undefined => {
  const kept = Object.hasOwn(RESERVED_APP_IDS, id) ? RESERVED_APP_IDS[id] : undefined;
  if (kept) return `"${id}" is kept for ${kept}, a part of AUGUR. Choose another id for the app.`;
  const prefix = Object.keys(RESERVED_APP_ID_PREFIXES).find((p) => id.startsWith(p));
  if (prefix) return `"${id}" starts with ${prefix}, which is kept for ${RESERVED_APP_ID_PREFIXES[prefix]}. Choose another id for the app.`;
  return undefined;
};
