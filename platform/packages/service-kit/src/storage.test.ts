import { describe, expect, it } from 'vitest';
import { appStorageFromEnv, bucketKeyIdFor } from './storage.js';

describe('appStorageFromEnv', () => {
  it('reads the database and the bucket the platform gave the app', () => {
    expect(
      appStorageFromEnv({
        DATABASE_URL: 'postgres://app_folio:pw@postgres:5432/platform',
        S3_ENDPOINT: 'http://garage:3900',
        S3_BUCKET: 'folio',
        S3_ACCESS_KEY_ID: 'GKabc',
        S3_SECRET_ACCESS_KEY: 'secret',
      }),
    ).toEqual({
      databaseUrl: 'postgres://app_folio:pw@postgres:5432/platform',
      bucket: { endpoint: 'http://garage:3900', region: 'garage', name: 'folio', accessKeyId: 'GKabc', secretAccessKey: 'secret', forcePathStyle: true },
    });
  });

  it('has no bucket until every part of it is set', () => {
    expect(appStorageFromEnv({ S3_ENDPOINT: 'http://garage:3900', S3_BUCKET: 'folio' })).toEqual({ databaseUrl: undefined, bucket: undefined });
  });

  it('names the key after its secret when only the secret is given, as the platform does', () => {
    const secret = '6c6f63616c2d6f6e6c792d666f6c696f2d6275636b65742d7365637265742d30';
    expect(bucketKeyIdFor(secret)).toBe('GK999cf764e1807dfcdb6310d6');
    const storage = appStorageFromEnv({ S3_ENDPOINT: 'http://garage:3900', S3_BUCKET: 'folio', S3_SECRET_ACCESS_KEY: secret });
    expect(storage.bucket?.accessKeyId).toBe('GK999cf764e1807dfcdb6310d6');
  });
});
