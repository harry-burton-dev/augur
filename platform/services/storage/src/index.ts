// Gives apps their storage: for each app in APP_STORAGE, a database login that owns one schema,
// and a bucket with a key that opens only it. Runs to the end and stops, on every `up`; running it
// again changes nothing unless a secret in .env changed. See docs/app-storage.md.
import pg from 'pg';
import { configFromEnv, FRONTENDS_BUCKET, FRONTENDS_KEY } from './config.ts';
import { garageAdmin, keyIdFor } from './garage.ts';
import { prepareDatabase, provisionDatabase, roleFor, schemaFor } from './postgres.ts';

const config = configFromEnv();
if ('problems' in config) {
  for (const problem of config.problems) console.error(`storage: ${problem}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  await prepareDatabase(client);
  for (const { app, databasePassword } of config.apps) {
    await provisionDatabase(client, { app, password: databasePassword });
    console.log(`storage: ${app} has database login ${roleFor(app)}, owning schema ${schemaFor(app)}`);
  }
} finally {
  await client.end();
}

if (config.garage) {
  const garage = garageAdmin(config.garage);
  await garage.ready();
  if ((await garage.ensureLayout()) === 'applied') console.log('storage: object storage is ready for the first time');
  for (const { app, bucketSecret } of config.apps) {
    const bucket = await garage.ensureBucket(app);
    await garage.ensureKey(app, bucketSecret, bucket);
    console.log(`storage: ${app} has bucket ${app}, opened by key ${keyIdFor(bucketSecret)}`);
  }
  // Apps' frontends, kept by version: the registry writes them, the front door serves them.
  if (config.frontendsSecret) {
    const bucket = await garage.ensureBucket(FRONTENDS_BUCKET);
    await garage.ensureWebsite(bucket);
    await garage.ensureKey(FRONTENDS_KEY, config.frontendsSecret, bucket, FRONTENDS_KEY);
    console.log(`storage: apps' frontends are kept in bucket ${FRONTENDS_BUCKET}, opened by key ${keyIdFor(config.frontendsSecret)}`);
  } else {
    console.warn('storage: FRONTENDS_BUCKET_SECRET is not set, so apps’ frontends aren’t kept by version.');
  }
} else if (config.apps.length) {
  console.warn('storage: GARAGE_ADMIN_TOKEN is not set, so apps get no bucket.');
}
