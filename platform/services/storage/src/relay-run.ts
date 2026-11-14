// Runs the apps' relay (relay.ts) as compose.yml's app-relay service: Postgres's port to Postgres for apps' own
// logins, and the object store's S3 port to its S3 API, until it is stopped. Postgres and Garage are compose.yml's own.
import { startupLog } from '@augur/service-kit';
import { startRelay } from './relay.ts';

const log = startupLog('app-relay');
const relay = await startRelay({
  database: { listen: 5432, to: { host: 'postgres', port: 5432 } },
  objects: { listen: 3900, to: { host: 'garage', port: 3900 } },
});
log.info('relaying apps’ own logins to Postgres and their S3 calls to the object store');
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.once(signal, () => {
    void relay.close();
    process.exit(0);
  });
