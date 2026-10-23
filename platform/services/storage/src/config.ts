/** One app the platform keeps a database schema and a bucket for, and the secrets they open with. */
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
  /** Garage's admin API. Without it there is no object storage, and only databases are made. */
  garage?: { url: string; token: string };
  apps: AppStorage[];
}

const APP_ID = /^[a-z][a-z0-9-]{1,39}$/;

/** The prefix of an app's settings in .env: "folio" → FOLIO, "team-notes" → TEAM_NOTES. */
export const envPrefix = (app: string) => app.toUpperCase().replace(/-/g, '_');

/** The settings, or what is wrong with them, every problem at once so one edit of .env fixes them all. */
export const configFromEnv = (env: Record<string, string | undefined> = process.env): StorageConfig | { problems: string[] } => {
  const problems: string[] = [];
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) problems.push('DATABASE_URL is not set: it is the admin login used to make each app’s database login.');
  const ids = (env.APP_STORAGE ?? '').split(/[\s,]+/).filter(Boolean);
  const apps: AppStorage[] = [];
  for (const app of ids) {
    if (!APP_ID.test(app)) {
      problems.push(`"${app}" in APP_STORAGE is not an app id (2 to 40 lowercase letters, digits and dashes).`);
      continue;
    }
    const prefix = envPrefix(app);
    const databasePassword = env[`${prefix}_DATABASE_PASSWORD`] ?? '';
    const bucketSecret = env[`${prefix}_BUCKET_SECRET`] ?? '';
    if (databasePassword.length < 16) problems.push(`${prefix}_DATABASE_PASSWORD must be at least 16 characters; \`openssl rand -hex 32\` makes one.`);
    if (env.GARAGE_ADMIN_TOKEN && !/^[0-9a-f]{64}$/.test(bucketSecret)) problems.push(`${prefix}_BUCKET_SECRET must be 64 lowercase hex characters; \`openssl rand -hex 32\` makes one.`);
    apps.push({ app, databasePassword, bucketSecret });
  }
  if (problems.length || !databaseUrl) return { problems };
  const url = new URL(databaseUrl);
  return {
    databaseUrl,
    databaseHost: env.APP_DATABASE_HOST ?? `${url.hostname}:${url.port || 5432}`,
    garage: env.GARAGE_ADMIN_TOKEN ? { url: env.GARAGE_ADMIN_URL ?? 'http://garage:3903', token: env.GARAGE_ADMIN_TOKEN } : undefined,
    apps,
  };
};
