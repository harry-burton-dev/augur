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

/** The app's storage settings, or what's missing. Pass them straight to `pg` and an S3 client. */
export const appStorageFromEnv = (env: Record<string, string | undefined> = process.env): AppStorage => {
  const { DATABASE_URL, S3_ENDPOINT, S3_REGION = 'garage', S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  const bucket =
    S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
      ? { endpoint: S3_ENDPOINT, region: S3_REGION, name: S3_BUCKET, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, forcePathStyle: true as const }
      : undefined;
  return { databaseUrl: DATABASE_URL || undefined, bucket };
};
