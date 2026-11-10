// Gives the platform's services and Keycloak each a database login of their own, and apps their storage: for each app in APP_STORAGE, a database login that owns one schema,
// and a bucket with a key that opens only it. Runs to the end and stops, on every `up`; running it
// again changes nothing unless a secret in .env changed. See docs/app-storage.md.
// With APP_STORAGE_DROP, it instead takes one pull request's preview's scratch storage away. The apps in
// RETIRED_APPS lose their data, once on each server (ADR 0075). With APP_STORAGE_RETIRE, one app the app runner
// removed loses its data, once its grace period ended.
import { startupLog } from '@augur/service-kit';
import pg from 'pg';
import { configFromEnv, envPrefix, FRONTENDS_BUCKET, FRONTENDS_KEY, type StorageConfig } from './config.ts';
import { garageAdmin, GarageError, keyIdFor, keyNameFor } from './garage.ts';
import { dropDatabase, markRetired, prepareDatabase, provisionDatabase, provisionKeycloakDatabase, provisionServiceDatabase, retiredApps, roleFor, schemaFor, serviceRoleFor } from './postgres.ts';
import { emptyBucket } from './s3.ts';

const log = startupLog('storage');

const config = configFromEnv();
if ('problems' in config) {
  for (const problem of config.problems) log.error(`${problem}`);
  process.exit(1);
}

if (config.drop) {
  const { app, bucketSecret } = config.drop;
  const sql = new pg.Client({ connectionString: config.databaseUrl });
  await sql.connect();
  try {
    await dropDatabase(sql, app);
  } finally {
    await sql.end();
  }
  log.info(`${app}’s database login and schema are gone`);
  if (config.garage) {
    const { s3Url } = config.garage;
    const had = await garageAdmin(config.garage).removeBucket(app, async () => {
      const deleted = await emptyBucket({ endpoint: s3Url, bucket: app, secret: bucketSecret });
      log.info(`emptied bucket ${app} (${deleted} objects)`);
    });
    log.info(had ? `bucket ${app} is gone (its key stays, and opens nothing)` : `${app} had no bucket`);
  }
  process.exit(0);
}

// An app removed from the server whose grace period ended: its data goes, after the runner's backup, and nothing else is done.
if (config.retireNow) {
  const app = config.retireNow;
  const sql = new pg.Client({ connectionString: config.databaseUrl });
  await sql.connect();
  try {
    await retiredApps(sql);
    await retireApp(sql, app, true);
  } finally {
    await sql.end();
  }
  log.info(`${app} was removed from the server and its time to come back ended: its database login, schemas and bucket are gone.`);
  process.exit(0);
}

// The platform's own logins come first, and an app's trouble never stops them (ADR 0073): an app that
// can't be set up is skipped with its reason in this log, and fails alone. Only the platform's own set-up
// failing stops this job, which everything else in AUGUR waits for.
const appsFailed: string[] = [];
for (const { app, problem } of config.skipped) {
  log.error(`${app} gets no storage this time: ${problem}`);
  appsFailed.push(app);
}
// An app's step: logged and skipped on failure, so the next app and the platform's set-up carry on.
const forApp = async (app: string, work: () => Promise<void>) => {
  try {
    await work();
  } catch (err) {
    log.error(`${app}’s storage couldn’t be set up, so it won’t start until it is: ${(err as Error).message}`);
    if (!appsFailed.includes(app)) appsFailed.push(app);
  }
};

const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  await prepareDatabase(client);
  for (const { service, databasePassword } of config.services) {
    const handed = await provisionServiceDatabase(client, { service, password: databasePassword });
    log.info(`${service} has database login ${serviceRoleFor(service)}, owning schema ${service}${handed ? ` (handed it ${handed} things the admin login made)` : ''}`);
  }
  for (const { app, databasePassword } of config.apps) {
    await forApp(app, async () => {
      await provisionDatabase(client, { app, password: databasePassword, connections: config.appConnections });
      log.info(`${app} has database login ${roleFor(app)}, owning schema ${schemaFor(app)}, at most ${config.appConnections} connections`);
    });
  }
} finally {
  await client.end();
}

if (config.keycloak) {
  const { database, role, password } = config.keycloak;
  const url = new URL(config.databaseUrl);
  url.pathname = `/${database}`;
  const keycloak = new pg.Client({ connectionString: url.toString() });
  await keycloak.connect();
  try {
    const handed = await provisionKeycloakDatabase(keycloak, { role, password });
    log.info(`Keycloak has database login ${role}, owning database ${database}${handed ? ` (handed it ${handed} things the admin login made)` : ''}`);
  } finally {
    await keycloak.end();
  }
}

if (config.garage) {
  const garage = garageAdmin(config.garage);
  await garage.ready();
  if ((await garage.ensureLayout()) === 'applied') log.info('object storage is ready for the first time');
  // Apps' frontends, kept by version: the registry writes them, the front door serves them.
  if (config.frontendsSecret) {
    const bucket = await garage.ensureBucket(FRONTENDS_BUCKET);
    await garage.ensureWebsite(bucket);
    await ensureKeyOf(garage, FRONTENDS_KEY, config.frontendsSecret, bucket, 'FRONTENDS_BUCKET_SECRET', FRONTENDS_KEY);
    log.info(`apps' frontends are kept in bucket ${FRONTENDS_BUCKET}, opened by key ${keyIdFor(config.frontendsSecret)}`);
  } else {
    log.warn('FRONTENDS_BUCKET_SECRET is not set, so apps’ frontends aren’t kept by version.');
  }
  for (const { app, bucketSecret } of config.apps) {
    await forApp(app, async () => {
      const bucket = await garage.ensureBucket(app);
      await ensureKeyOf(garage, app, bucketSecret, bucket, `${envPrefix(app)}_BUCKET_SECRET`);
      log.info(`${app} has bucket ${app}, opened by key ${keyIdFor(bucketSecret)}`);
    });
  }
} else if (config.apps.length) {
  log.warn('GARAGE_ADMIN_TOKEN is not set, so apps get no bucket.');
}

/**
 * The key for this secret, with the words an admin needs when Garage refuses it: a key deleted before (a release
 * that took the app's bucket away with its key, before this one kept them) can't be imported again, only replaced.
 */
async function ensureKeyOf(garage: ReturnType<typeof garageAdmin>, app: string, secret: string, bucketId: string, setting: string, name?: string) {
  try {
    return await garage.ensureKey(app, secret, bucketId, name);
  } catch (err) {
    if (!(err instanceof GarageError) || err.code !== 'KeyAlreadyExists') throw err;
    throw new Error(`${err.message} Set ${setting} in .env to a new value (\`openssl rand -hex 32\`) and run \`pc up -d\` again.`, { cause: err });
  }
}

/**
 * Takes an app's login, schemas and bucket away, with everything in them, and notes it. The bucket is emptied with
 * a key made for the moment and deleted after; the app's own keys stay (see removeBucket).
 */
async function retireApp(sql: pg.Client, app: string, again = false) {
  // Only reached once the settings were read without a problem.
  const { garage: options } = config as StorageConfig;
  await dropDatabase(sql, app);
  if (options) {
    const garage = garageAdmin(options);
    await garage.removeBucket(app, async (bucketId) => {
      // Named so no app's own keys (app-<id>, and an id can't hold a colon) are ever mistaken for it.
      const key = await garage.temporaryKey(bucketId, `${keyNameFor(app)}:retire`);
      try {
        const deleted = await emptyBucket({ endpoint: options.s3Url, bucket: app, secret: key.secret });
        log.info(`emptied bucket ${app} (${deleted} objects)`);
      } finally {
        // A key left behind opens nothing once the bucket is gone, so this never hides why emptying failed.
        await garage.deleteKey(key.id).catch((err: Error) => log.warn(`the key that emptied bucket ${app} couldn't be deleted: ${err.message}`));
      }
    });
  }
  await markRetired(sql, app, 'removed', again);
}

// Apps AUGUR no longer runs (RETIRED_APPS): their login, schemas and bucket go, once, after the upgrade's backup.
// One that fails is tried again next time and never stops AUGUR starting; one APP_STORAGE still names is kept.
if (config.retire.length) {
  const sql = new pg.Client({ connectionString: config.databaseUrl });
  await sql.connect();
  try {
    const done = await retiredApps(sql);
    for (const app of config.retire.filter((a) => !done.has(a))) {
      if (config.apps.some((a) => a.app === app) || config.skipped.some((a) => a.app === app)) {
        await markRetired(sql, app, 'kept');
        log.warn(`${app} no longer ships with AUGUR, but APP_STORAGE names it, so its data is kept.`);
        continue;
      }
      try {
        await retireApp(sql, app);
        log.info(`${app} no longer ships with AUGUR: its database login, schemas and bucket are gone.`);
      } catch (err) {
        log.error(`${app} no longer ships with AUGUR, but its data couldn’t all be taken away; it’s tried again next time: ${(err as Error).message}`);
      }
    }
  } finally {
    await sql.end();
  }
}

if (appsFailed.length) log.warn(`AUGUR’s own storage is ready; ${appsFailed.join(', ')} ${appsFailed.length > 1 ? 'aren’t' : 'isn’t'}, and won’t start until ${appsFailed.length > 1 ? 'they are' : 'it is'} (see above).`);
