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

const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  await prepareDatabase(client);
  for (const { app, databasePassword } of config.apps) {
    await provisionDatabase(client, { app, password: databasePassword });
    log.info(`${app} has database login ${roleFor(app)}, owning schema ${schemaFor(app)}`);
  }
  for (const { service, databasePassword } of config.services) {
    const handed = await provisionServiceDatabase(client, { service, password: databasePassword });
    log.info(`${service} has database login ${serviceRoleFor(service)}, owning schema ${service}${handed ? ` (handed it ${handed} things the admin login made)` : ''}`);
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
  for (const { app, bucketSecret } of config.apps) {
    const bucket = await garage.ensureBucket(app);
    await garage.ensureKey(app, bucketSecret, bucket);
    log.info(`${app} has bucket ${app}, opened by key ${keyIdFor(bucketSecret)}`);
  }
  // Apps' frontends, kept by version: the registry writes them, the front door serves them.
  if (config.frontendsSecret) {
    const bucket = await garage.ensureBucket(FRONTENDS_BUCKET);
    await garage.ensureWebsite(bucket);
    await garage.ensureKey(FRONTENDS_KEY, config.frontendsSecret, bucket, FRONTENDS_KEY);
    log.info(`apps' frontends are kept in bucket ${FRONTENDS_BUCKET}, opened by key ${keyIdFor(config.frontendsSecret)}`);
  } else {
    log.warn('FRONTENDS_BUCKET_SECRET is not set, so apps’ frontends aren’t kept by version.');
  }
} else if (config.apps.length) {
  log.warn('GARAGE_ADMIN_TOKEN is not set, so apps get no bucket.');
}
