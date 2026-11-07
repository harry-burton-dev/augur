// Gives the platform's services and Keycloak each a database login of their own, and apps their storage: for each app in APP_STORAGE, a database login that owns one schema,
// and a bucket with a key that opens only it. Runs to the end and stops, on every `up`; running it
// again changes nothing unless a secret in .env changed. See docs/app-storage.md.
// With APP_STORAGE_DROP, it instead takes one pull request's preview's scratch storage away.
import { startupLog } from '@augur/service-kit';
import pg from 'pg';
import { configFromEnv, FRONTENDS_BUCKET, FRONTENDS_KEY } from './config.ts';
import { garageAdmin, keyIdFor } from './garage.ts';
import { dropDatabase, prepareDatabase, provisionDatabase, provisionKeycloakDatabase, provisionServiceDatabase, roleFor, schemaFor, serviceRoleFor } from './postgres.ts';
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
    log.info(had ? `bucket ${app} and its key are gone` : `${app} had no bucket`);
  }
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
    await garage.ensureKey(FRONTENDS_KEY, config.frontendsSecret, bucket, FRONTENDS_KEY);
    log.info(`apps' frontends are kept in bucket ${FRONTENDS_BUCKET}, opened by key ${keyIdFor(config.frontendsSecret)}`);
  } else {
    log.warn('FRONTENDS_BUCKET_SECRET is not set, so apps’ frontends aren’t kept by version.');
  }
  for (const { app, bucketSecret } of config.apps) {
    await forApp(app, async () => {
      const bucket = await garage.ensureBucket(app);
      await garage.ensureKey(app, bucketSecret, bucket);
      log.info(`${app} has bucket ${app}, opened by key ${keyIdFor(bucketSecret)}`);
    });
  }
} else if (config.apps.length) {
  log.warn('GARAGE_ADMIN_TOKEN is not set, so apps get no bucket.');
}

if (appsFailed.length) log.warn(`AUGUR’s own storage is ready; ${appsFailed.join(', ')} ${appsFailed.length > 1 ? 'aren’t' : 'isn’t'}, and won’t start until ${appsFailed.length > 1 ? 'they are' : 'it is'} (see above).`);
