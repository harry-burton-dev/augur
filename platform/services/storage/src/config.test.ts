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
      skipped: [],
      appConnections: 30,
      services: [],
      retire: [],
    });
  });

  it('says everything that is wrong with the platform’s own settings at once', () => {
    const config = configFromEnv({ GARAGE_ADMIN_TOKEN: 't', APP_STORAGE_DROP: 'Folio', APP_DATABASE_CONNECTIONS: '1' });
    expect('problems' in config && config.problems).toEqual([
      expect.stringContaining('DATABASE_URL is not set'),
      expect.stringContaining('APP_DATABASE_CONNECTIONS must be a whole number'),
      expect.stringContaining('"Folio" in APP_STORAGE_DROP isn’t a preview’s storage'),
    ]);
  });

  it('skips an app it can’t set up, saying why, and sets up the rest (ADR 0073)', () => {
    const config = configFromEnv({
      DATABASE_URL: 'postgres://a:b@db/platform',
      GARAGE_ADMIN_TOKEN: 't',
      APP_STORAGE: 'Folio folio atlas mandate',
      FOLIO_DATABASE_PASSWORD: 'short',
      ATLAS_DATABASE_PASSWORD: 'p'.repeat(20),
      ATLAS_BUCKET_SECRET: 'nothex',
      MANDATE_DATABASE_PASSWORD: 'm'.repeat(20),
      MANDATE_BUCKET_SECRET: secret,
      APP_DATABASE_CONNECTIONS: '12',
    });
    expect(config).toMatchObject({ apps: [{ app: 'mandate' }], appConnections: 12 });
    expect('skipped' in config && config.skipped).toEqual([
      { app: 'Folio', problem: expect.stringContaining('"Folio" in APP_STORAGE is not an app id') },
      { app: 'folio', problem: expect.stringContaining('FOLIO_DATABASE_PASSWORD must be at least 16') },
      { app: 'atlas', problem: expect.stringContaining('ATLAS_BUCKET_SECRET must be 64') },
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
    expect(configFromEnv({ ...base, FRONTENDS_BUCKET_SECRET: 'short' })).toEqual({ problems: [expect.stringContaining('FRONTENDS_BUCKET_SECRET must be 64')] });
    const augur = configFromEnv({ ...base, APP_STORAGE: 'augur-frontends', AUGUR_FRONTENDS_DATABASE_PASSWORD: 'p'.repeat(20) });
    expect('skipped' in augur && augur.skipped).toEqual([{ app: 'augur-frontends', problem: expect.stringContaining('starts with augur-') }]);
  });

  it('gives no app storage under an id a part of AUGUR answers to', () => {
    const bad = configFromEnv({ DATABASE_URL: 'postgres://a:b@db/platform', APP_STORAGE: 'identity public', IDENTITY_DATABASE_PASSWORD: 'p'.repeat(20), PUBLIC_DATABASE_PASSWORD: 'p'.repeat(20) });
    expect('skipped' in bad && bad.skipped.map(({ problem }) => problem)).toEqual([
      'APP_STORAGE: "identity" is kept for the identity service, a part of AUGUR. Choose another id for the app.',
      expect.stringContaining('"public" is kept for the database’s shared schema'),
    ]);
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

  it('takes one removed app’s data away on its own (APP_STORAGE_RETIRE), never AUGUR’s own', () => {
    const base = { DATABASE_URL: 'postgres://a:b@db/platform', APP_SECRETS_KEY: 'k'.repeat(64) };
    expect(configFromEnv({ ...base, APP_STORAGE_RETIRE: 'notes' })).toMatchObject({ retireNow: 'notes' });
    const bad = configFromEnv({ ...base, APP_STORAGE_RETIRE: 'registry' });
    expect('problems' in bad && bad.problems).toEqual([expect.stringContaining('APP_STORAGE_RETIRE:')]);
    const beside = configFromEnv({ ...base, APP_STORAGE: 'maps', MAPS_DATABASE_PASSWORD: 'p'.repeat(16), MAPS_BUCKET_SECRET: 'b'.repeat(64), APP_STORAGE_RETIRE: 'notes' });
    expect('problems' in beside && beside.problems).toEqual([expect.stringContaining('on its own')]);
  });

  it('reads the apps whose data goes once (RETIRED_APPS), and refuses an id that isn’t an app’s', () => {
    const base = { DATABASE_URL: 'postgres://a:b@db/platform' };
    expect(configFromEnv({ ...base, RETIRED_APPS: 'notes  maps,board' })).toMatchObject({ retire: ['notes', 'maps', 'board'] });
    expect(configFromEnv(base)).toMatchObject({ retire: [] });
    const bad = configFromEnv({ ...base, RETIRED_APPS: 'Notes registry' });
    expect('problems' in bad && bad.problems).toEqual([expect.stringContaining('"Notes" in RETIRED_APPS'), expect.stringContaining('RETIRED_APPS:')]);
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

  it('reads each platform service’s login and Keycloak’s', () => {
    const base = { DATABASE_URL: 'postgres://platform:pw@postgres:5432/platform', PLATFORM_DATABASE_LOGINS: 'identity events' };
    const config = configFromEnv({ ...base, IDENTITY_DATABASE_PASSWORD: 'i'.repeat(32), EVENTS_DATABASE_PASSWORD: 'e'.repeat(32), KEYCLOAK_DATABASE_PASSWORD: 'k'.repeat(32) });
    expect(config).toMatchObject({
      services: [
        { service: 'identity', databasePassword: 'i'.repeat(32) },
        { service: 'events', databasePassword: 'e'.repeat(32) },
      ],
      keycloak: { database: 'keycloak', role: 'keycloak', password: 'k'.repeat(32) },
    });
    expect(configFromEnv({ ...base, IDENTITY_DATABASE_PASSWORD: 'short' })).toEqual({
      problems: [
        'IDENTITY_DATABASE_PASSWORD must be at least 16 characters; `openssl rand -hex 32` makes one.',
        'EVENTS_DATABASE_PASSWORD must be at least 16 characters; `openssl rand -hex 32` makes one.',
      ],
    });
  });
});
