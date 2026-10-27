import { describe, expect, it } from 'vitest';
import { appSecretFor } from '@augur/service-kit';
import { configFromEnv, envPrefix } from './config.ts';

const secret = 'a'.repeat(64);

describe('configFromEnv', () => {
  it('reads each app’s secrets by its prefix', () => {
    expect(envPrefix('team-notes')).toBe('TEAM_NOTES');
    const config = configFromEnv({
      DATABASE_URL: 'postgres://platform:pw@postgres:5432/platform',
      GARAGE_ADMIN_TOKEN: 't',
      APP_STORAGE: 'folio, team-notes',
      FOLIO_DATABASE_PASSWORD: 'p'.repeat(32),
      FOLIO_BUCKET_SECRET: secret,
      TEAM_NOTES_DATABASE_PASSWORD: 'q'.repeat(32),
      TEAM_NOTES_BUCKET_SECRET: secret,
    });
    expect(config).toEqual({
      databaseUrl: 'postgres://platform:pw@postgres:5432/platform',
      databaseHost: 'postgres:5432',
      garage: { url: 'http://garage:3903', token: 't', s3Url: 'http://garage:3900' },
      apps: [
        { app: 'folio', databasePassword: 'p'.repeat(32), bucketSecret: secret },
        { app: 'team-notes', databasePassword: 'q'.repeat(32), bucketSecret: secret },
      ],
    });
  });

  it('says everything that is wrong at once', () => {
    const config = configFromEnv({ GARAGE_ADMIN_TOKEN: 't', APP_STORAGE: 'Folio folio', FOLIO_DATABASE_PASSWORD: 'short', FOLIO_BUCKET_SECRET: 'nothex' });
    expect('problems' in config && config.problems).toEqual([
      expect.stringContaining('DATABASE_URL is not set'),
      expect.stringContaining('"Folio" in APP_STORAGE is not an app id'),
      expect.stringContaining('FOLIO_DATABASE_PASSWORD must be at least 16'),
      expect.stringContaining('FOLIO_BUCKET_SECRET must be 64'),
    ]);
  });

  it('needs no bucket secret without object storage', () => {
    const config = configFromEnv({ DATABASE_URL: 'postgres://a:b@db/platform', APP_STORAGE: 'folio', FOLIO_DATABASE_PASSWORD: 'p'.repeat(20) });
    expect(config).toMatchObject({ databaseHost: 'db:5432', garage: undefined, apps: [{ app: 'folio', bucketSecret: '' }] });
  });

  it('reads the frontends bucket’s secret, and keeps augur- names for the platform', () => {
    const base = { DATABASE_URL: 'postgres://a:b@db/platform', GARAGE_ADMIN_TOKEN: 't' };
    expect(configFromEnv({ ...base, FRONTENDS_BUCKET_SECRET: secret })).toMatchObject({ frontendsSecret: secret });
    expect(configFromEnv(base)).not.toHaveProperty('frontendsSecret');
    const bad = configFromEnv({ ...base, FRONTENDS_BUCKET_SECRET: 'short', APP_STORAGE: 'augur-frontends', AUGUR_FRONTENDS_DATABASE_PASSWORD: 'p'.repeat(20) });
    expect('problems' in bad && bad.problems).toEqual([expect.stringContaining('starts with augur-'), expect.stringContaining('FRONTENDS_BUCKET_SECRET must be 64')]);
  });

  it('takes only a preview’s storage away, on its own', () => {
    const key = 'k'.repeat(64);
    const base = { DATABASE_URL: 'postgres://a:b@db/platform', GARAGE_ADMIN_TOKEN: 't', APP_SECRETS_KEY: key };
    expect(configFromEnv({ ...base, APP_STORAGE_DROP: 'notes-pr12' })).toMatchObject({
      apps: [],
      drop: { app: 'notes-pr12', databasePassword: appSecretFor(key, 'notes-pr12', 'database'), bucketSecret: appSecretFor(key, 'notes-pr12', 'bucket') },
      garage: { s3Url: 'http://garage:3900' },
    });
    // A preview's storage is made like an app's.
    expect(configFromEnv({ ...base, APP_STORAGE: 'notes-pr12' })).toMatchObject({ apps: [{ app: 'notes-pr12' }] });
    const bad = configFromEnv({ ...base, APP_STORAGE: 'notes', APP_STORAGE_DROP: 'folio' });
    expect('problems' in bad && bad.problems).toEqual([expect.stringContaining('isn’t a preview’s storage'), expect.stringContaining('leave APP_STORAGE empty')]);
  });

  it('works out each app’s secrets from APP_SECRETS_KEY when .env doesn’t name them', () => {
    const key = 'k'.repeat(64);
    const config = configFromEnv({ DATABASE_URL: 'postgres://a:b@db/platform', GARAGE_ADMIN_TOKEN: 't', APP_SECRETS_KEY: key, APP_STORAGE: 'notes folio', FOLIO_DATABASE_PASSWORD: 'p'.repeat(32), FOLIO_BUCKET_SECRET: secret });
    expect('apps' in config && config.apps).toEqual([
      { app: 'notes', databasePassword: appSecretFor(key, 'notes', 'database'), bucketSecret: appSecretFor(key, 'notes', 'bucket') },
      { app: 'folio', databasePassword: 'p'.repeat(32), bucketSecret: secret },
    ]);
    expect(appSecretFor(key, 'notes', 'bucket')).toMatch(/^[0-9a-f]{64}$/);
    expect(appSecretFor(key, 'notes', 'bucket')).not.toBe(appSecretFor(key, 'notes', 'database'));
    expect(appSecretFor(key, 'notes', 'bucket')).not.toBe(appSecretFor(key, 'other', 'bucket'));
    const short = configFromEnv({ DATABASE_URL: 'postgres://a:b@db/platform', APP_SECRETS_KEY: 'short' });
    expect('problems' in short && short.problems).toEqual([expect.stringContaining('APP_SECRETS_KEY must be')]);
  });
});
