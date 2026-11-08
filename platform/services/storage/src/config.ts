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
   * Apps in APP_STORAGE that get nothing this run, each with why. An app's mistake never stops the
   * platform's own set-up (ADR 0073): the app is skipped, said so in the log, and fails alone.
   */
  skipped: { app: string; problem: string }[];
  /** The most connections each app's database login may hold at once (APP_DATABASE_CONNECTIONS). */
  appConnections: number;
  /**
   * A pull request's preview whose scratch storage is taken away instead (APP_STORAGE_DROP): its
   * database login and schema, and its bucket with everything in it. Only ever a preview's.
   */
  drop?: AppStorage;
  /**
   * Apps AUGUR no longer runs whose data goes, once (RETIRED_APPS, ADR 0075): their database login and schemas, and
   * their bucket with everything in it. Each is done once on a server and remembered, so an app installed later
   * under the same id keeps its own.
   */
  retire: string[];
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
  const skipped: StorageConfig['skipped'] = [];
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
  const appProblem = (app: string) => {
    if (!APP_ID.test(app) && !PREVIEW_ID.test(app)) return `"${app}" in APP_STORAGE is not an app id (2 to 40 lowercase letters, digits and dashes).`;
    if (app.startsWith('augur-')) return `"${app}" in APP_STORAGE starts with augur-, which is kept for AUGUR's own buckets.`;
    const reserved = reservedIdProblem(app);
    if (reserved) return `APP_STORAGE: ${reserved}`;
    const { prefix, databasePassword, bucketSecret } = secretsOf(app);
    if (databasePassword.length < 16) return `${prefix}_DATABASE_PASSWORD must be at least 16 characters (or set APP_SECRETS_KEY); \`openssl rand -hex 32\` makes one.`;
    if (env.GARAGE_ADMIN_TOKEN && !/^[0-9a-f]{64}$/.test(bucketSecret)) return `${prefix}_BUCKET_SECRET must be 64 lowercase hex characters; \`openssl rand -hex 32\` makes one.`;
    return undefined;
  };
  for (const app of ids) {
    const problem = appProblem(app);
    if (problem) skipped.push({ app, problem });
    else apps.push({ app, ...(({ databasePassword, bucketSecret }) => ({ databasePassword, bucketSecret }))(secretsOf(app)) });
  }
  const appConnections = env.APP_DATABASE_CONNECTIONS ? Number(env.APP_DATABASE_CONNECTIONS) : 30;
  if (!Number.isInteger(appConnections) || appConnections < 2 || appConnections > 1000) problems.push('APP_DATABASE_CONNECTIONS must be a whole number from 2 to 1000 (30 when empty).');
  const retire = (env.RETIRED_APPS ?? '').split(/[\s,]+/).filter(Boolean);
  for (const app of retire) {
    if (!APP_ID.test(app)) problems.push(`"${app}" in RETIRED_APPS is not an app id (2 to 40 lowercase letters, digits and dashes).`);
    const reserved = reservedIdProblem(app);
    if (reserved) problems.push(`RETIRED_APPS: ${reserved}`);
  }
  const dropping = env.APP_STORAGE_DROP || undefined;
  // Taking a preview's storage away is that preview's job alone, so it stops at any problem.
  if (dropping) problems.push(...skipped.map(({ problem }) => problem));
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
    skipped,
    retire,
    appConnections,
    ...(dropping ? { drop: { app: dropping, ...(({ databasePassword, bucketSecret }) => ({ databasePassword, bucketSecret }))(secretsOf(dropping)) } } : {}),
    ...(frontendsSecret ? { frontendsSecret } : {}),
    services,
    ...(keycloakPassword ? { keycloak: { database: env.KEYCLOAK_DATABASE || 'keycloak', role: env.KEYCLOAK_DATABASE_USER || 'keycloak', password: keycloakPassword } } : {}),
  };
};
