/** One app the platform keeps a database schema and a bucket for, and the secrets they open with. */
import { appSecretFor, reservedIdProblem } from '@augur/service-kit';

export interface AppStorage {
  app: string;
  /** The password of the app's own database login. */
  databasePassword: string;
  /** The secret of the app's own bucket key, 64 hex characters. Its key id is derived from it. */
  bucketSecret: string;
}

export interface StorageConfig {
  /** An admin login to the platform's database, to make each app's login and schema. */
  databaseUrl: string;
  /** Where apps reach the database, as host:port, for the address printed for each app. */
  databaseHost: string;
  /** Garage's admin API, and its S3 API. Without them there is no object storage, and only databases are made. */
  garage?: { url: string; token: string; s3Url: string };
  apps: AppStorage[];
  /**
   * A pull request's preview whose scratch storage is taken away instead (APP_STORAGE_DROP): its
   * database login and schema, and its bucket with everything in it. Only ever a preview's.
   */
  drop?: AppStorage;
  /**
   * The secret of the registry's key to the bucket of apps' frontends (FRONTENDS_BUCKET_SECRET),
   * 64 hex characters. Without it apps' frontends aren't kept by version (docs/upgrade.md).
   */
  frontendsSecret?: string;
  /**
   * The platform's own services that get a login owning only their schema (PLATFORM_DATABASE_LOGINS),
   * each with its password (<SERVICE>_DATABASE_PASSWORD).
   */
  services: { service: string; databasePassword: string }[];
  /** Keycloak's own login and database (KEYCLOAK_DATABASE_PASSWORD, KEYCLOAK_DATABASE), when set. */
  keycloak?: { database: string; role: string; password: string };
}

/** The bucket each app's frontend is kept in, by version, and served from at /apps/<id>/<version>/. */
export const FRONTENDS_BUCKET = 'augur-frontends';
/** The name the registry's key to it carries in Garage. */
export const FRONTENDS_KEY = 'platform-frontends';

const APP_ID = /^[a-z][a-z0-9-]{1,39}$/;
/** A pull request's preview of an app keeps its scratch data under its own id: notes-pr12. */
export const PREVIEW_ID = /^[a-z][a-z0-9-]{1,39}-pr\d{1,6}$/;

/** The prefix of an app's settings in .env: "folio" → FOLIO, "team-notes" → TEAM_NOTES. */
export const envPrefix = (app: string) => app.toUpperCase().replace(/-/g, '_');

/** The settings, or what is wrong with them, every problem at once so one edit of .env fixes them all. */
export const configFromEnv = (env: Record<string, string | undefined> = process.env): StorageConfig | { problems: string[] } => {
  const problems: string[] = [];
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) problems.push('DATABASE_URL is not set: it is the admin login used to make each app’s database login.');
  const ids = (env.APP_STORAGE ?? '').split(/[\s,]+/).filter(Boolean);
  const apps: AppStorage[] = [];
  // A secret in .env wins; otherwise it's worked out from APP_SECRETS_KEY, as the app runner does.
  const key = env.APP_SECRETS_KEY || undefined;
  const secretsOf = (app: string) => {
    const prefix = envPrefix(app);
    return {
      prefix,
      databasePassword: env[`${prefix}_DATABASE_PASSWORD`] || (key ? appSecretFor(key, app, 'database') : ''),
      bucketSecret: env[`${prefix}_BUCKET_SECRET`] || (key ? appSecretFor(key, app, 'bucket') : ''),
    };
  };
  for (const app of ids) {
    if (!APP_ID.test(app) && !PREVIEW_ID.test(app)) {
      problems.push(`"${app}" in APP_STORAGE is not an app id (2 to 40 lowercase letters, digits and dashes).`);
      continue;
    }
    if (app.startsWith('augur-')) {
      problems.push(`"${app}" in APP_STORAGE starts with augur-, which is kept for the platform's own buckets.`);
      continue;
    }
    const reserved = reservedIdProblem(app);
    if (reserved) {
      problems.push(`APP_STORAGE: ${reserved}`);
      continue;
    }
    const { prefix, databasePassword, bucketSecret } = secretsOf(app);
    if (databasePassword.length < 16) problems.push(`${prefix}_DATABASE_PASSWORD must be at least 16 characters (or set APP_SECRETS_KEY); \`openssl rand -hex 32\` makes one.`);
    if (env.GARAGE_ADMIN_TOKEN && !/^[0-9a-f]{64}$/.test(bucketSecret)) problems.push(`${prefix}_BUCKET_SECRET must be 64 lowercase hex characters; \`openssl rand -hex 32\` makes one.`);
    apps.push({ app, databasePassword, bucketSecret });
  }
  const dropping = env.APP_STORAGE_DROP || undefined;
  if (dropping && !PREVIEW_ID.test(dropping)) problems.push(`"${dropping}" in APP_STORAGE_DROP isn’t a preview’s storage (such as notes-pr12); an app’s own is never dropped this way.`);
  if (dropping && ids.length) problems.push('APP_STORAGE_DROP takes a preview’s storage away on its own: leave APP_STORAGE empty beside it.');
  if (env.APP_SECRETS_KEY && env.APP_SECRETS_KEY.length < 32) problems.push('APP_SECRETS_KEY must be at least 32 characters; `openssl rand -hex 32` makes one.');
  const frontendsSecret = env.FRONTENDS_BUCKET_SECRET || undefined;
  if (frontendsSecret && !/^[0-9a-f]{64}$/.test(frontendsSecret)) problems.push('FRONTENDS_BUCKET_SECRET must be 64 lowercase hex characters; `openssl rand -hex 32` makes one.');
  const services: StorageConfig['services'] = [];
  for (const service of (env.PLATFORM_DATABASE_LOGINS ?? '').split(/[\s,]+/).filter(Boolean)) {
    if (!APP_ID.test(service)) {
      problems.push(`"${service}" in PLATFORM_DATABASE_LOGINS is not a service name (2 to 40 lowercase letters, digits and dashes).`);
      continue;
    }
    const databasePassword = env[`${envPrefix(service)}_DATABASE_PASSWORD`] ?? '';
    if (databasePassword.length < 16) problems.push(`${envPrefix(service)}_DATABASE_PASSWORD must be at least 16 characters; \`openssl rand -hex 32\` makes one.`);
    else services.push({ service, databasePassword });
  }
  const keycloakPassword = env.KEYCLOAK_DATABASE_PASSWORD || undefined;
  if (keycloakPassword && keycloakPassword.length < 16) problems.push('KEYCLOAK_DATABASE_PASSWORD must be at least 16 characters; `openssl rand -hex 32` makes one.');
  if (problems.length || !databaseUrl) return { problems };
  const url = new URL(databaseUrl);
  return {
    databaseUrl,
    databaseHost: env.APP_DATABASE_HOST ?? `${url.hostname}:${url.port || 5432}`,
    garage: env.GARAGE_ADMIN_TOKEN ? { url: env.GARAGE_ADMIN_URL ?? 'http://garage:3903', token: env.GARAGE_ADMIN_TOKEN, s3Url: env.GARAGE_S3_URL ?? 'http://garage:3900' } : undefined,
    apps,
    ...(dropping ? { drop: { app: dropping, ...(({ databasePassword, bucketSecret }) => ({ databasePassword, bucketSecret }))(secretsOf(dropping)) } } : {}),
    ...(frontendsSecret ? { frontendsSecret } : {}),
    services,
    ...(keycloakPassword ? { keycloak: { database: env.KEYCLOAK_DATABASE || 'keycloak', role: env.KEYCLOAK_DATABASE_USER || 'keycloak', password: keycloakPassword } } : {}),
  };
};
