// Runs one of the apps' relays (relay.ts) as compose.yml's db-relay or bucket-relay service, until it is stopped:
// `node dist/relay-run.js database` or `objects`. APP_RELAY_TO names what it passes calls on to, by a name that is
// never one of the relays' own aliases on an app's network (compose.yml), so a relay can't reach itself.
import { startupLog } from '@augur/service-kit';
import { startRelay, type RelayKind } from './relay.ts';

const kind = process.argv[2] as RelayKind;
const log = startupLog(kind === 'database' ? 'db-relay' : 'bucket-relay');
const [host, port] = (process.env.APP_RELAY_TO ?? '').split(':');
if ((kind !== 'database' && kind !== 'objects') || !host || !Number(port)) {
  log.error('Run it as `relay-run.js database` or `relay-run.js objects`, with APP_RELAY_TO set to host:port (compose.yml sets both).');
  process.exit(1);
}

await startRelay({ kind, listen: Number(port), to: { host, port: Number(port) } });
log.info(kind === 'database' ? `relaying apps’ own logins to Postgres at ${host}:${port}` : `relaying apps’ S3 calls to the object store at ${host}:${port}`);
// Nothing it holds needs closing: a connection cut as it stops is one the app's client opens again.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => process.exit(0));
