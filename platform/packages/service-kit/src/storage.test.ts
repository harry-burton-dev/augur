import { describe, expect, it } from 'vitest';
import { appStorageFromEnv } from './storage.js';

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
});
