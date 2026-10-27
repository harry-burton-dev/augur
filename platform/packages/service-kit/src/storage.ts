import { createHash, createHmac } from 'node:crypto';

/**
 * Where an app's own storage is, from the settings the platform gives its service
 * (see docs/app-storage.md): its database login, which owns one schema and is
 * placed in it, and its bucket on the platform's S3-compatible object store.
 */
export interface AppStorage {
  /** The app's own login; its search_path is its schema, so unqualified table names land there. */
  databaseUrl?: string;
  bucket?: {
    endpoint: string;
    region: string;
    name: string;
    accessKeyId: string;
    secretAccessKey: string;
    /** Garage, like MinIO, wants bucket names in the path rather than the host. */
    forcePathStyle: true;
  };
}

/**
 * The id of the bucket key the platform makes from an app's bucket secret (`<ID>_BUCKET_SECRET`):
 * `GK` and the first 24 hex of its SHA-256. An app given only S3_SECRET_ACCESS_KEY uses it.
 */
export const bucketKeyIdFor = (secret: string) => `GK${createHash('sha256').update(secret).digest('hex').slice(0, 24)}`;

/** The app's storage settings, or what's missing. Pass them straight to `pg` and an S3 client. */
export const appStorageFromEnv = (env: Record<string, string | undefined> = process.env): AppStorage => {
  const { DATABASE_URL, S3_ENDPOINT, S3_REGION = 'garage', S3_BUCKET, S3_SECRET_ACCESS_KEY } = env;
  // The platform's store names each app's key after its secret, so the secret is enough.
  const S3_ACCESS_KEY_ID = env.S3_ACCESS_KEY_ID || (S3_SECRET_ACCESS_KEY ? bucketKeyIdFor(S3_SECRET_ACCESS_KEY) : undefined);
  const bucket =
    S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
      ? { endpoint: S3_ENDPOINT, region: S3_REGION, name: S3_BUCKET, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, forcePathStyle: true as const }
      : undefined;
  return { databaseUrl: DATABASE_URL || undefined, bucket };
};

/** What an app's secret opens: its database login, its bucket key, or its sign-in. */
export type AppSecretPurpose = 'database' | 'bucket' | 'sign-in';

/**
 * One of an app's secrets, worked out from the deployment's APP_SECRETS_KEY rather than kept
 * anywhere: 64 hex characters, different for each app and purpose, the same every time. The
 * storage container, identity and the app runner each work it out, so installing an app needs
 * no secret written into .env, and a new APP_SECRETS_KEY changes every app's secrets at once.
 */
export const appSecretFor = (key: string, app: string, purpose: AppSecretPurpose) => createHmac('sha256', key).update(`augur-app-secret:v1:${app}:${purpose}`).digest('hex');
