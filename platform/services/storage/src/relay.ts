// The apps' relay (ADR 0076, design review ISO-2): what an app's network has in place of Postgres and the object
// store. An app that asks for a database reaches Postgres only through db-relay, and only as its own login, never as
// the platform's superuser or a platform service's; one that asks for a bucket reaches only the object store's S3 API,
// through bucket-relay, never its admin API. The runner joins them to an app's network as `postgres` and `garage`, so
// an app's parts are told the same host names as before.
import { connect, createServer, type AddressInfo, type Server, type Socket } from 'node:net';

/** An app's own database login, as the storage container makes it: app_<id>, or a preview's app_<id>_pr<n>. */
export const APP_LOGIN = /^app_[a-z0-9][a-z0-9_]*$/;

const SSL_REQUEST = 80877103;
const GSS_REQUEST = 80877104;
const CANCEL_REQUEST = 80877102;
const PROTOCOL_3 = 196608;
/** The longest start message the relay reads; Postgres's own limit is 10000 bytes. */
const MAX_START = 10_000;
/** How long a client has to say who it is. */
const START_TIMEOUT_MS = 10_000;

/** A Postgres error a client shows as it is, then the relay closes the connection. */
const refusal = (message: string) => {
  const fields = Buffer.from(`SFATAL\0VFATAL\0C28000\0M${message}\0\0`);
  const head = Buffer.alloc(5);
  head.write('E', 0);
  head.writeInt32BE(4 + fields.length, 1);
  return Buffer.concat([head, fields]);
};

/**
 * The value of `user` in a start message's body (after its length and protocol), or undefined when it has none or
 * more than one: Postgres takes the last, so a second `user` must never slip past a check of the first.
 */
const userOf = (body: Buffer) => {
  const pairs = body.toString('utf8').split('\0');
  const users: string[] = [];
  // The list ends at an empty name.
  for (let i = 0; i + 1 < pairs.length && pairs[i] !== ''; i += 2) if (pairs[i] === 'user') users.push(pairs[i + 1]!);
  return users.length === 1 ? users[0] : undefined;
};

/** Passes a client on to `to`, `first` being what it already sent; `unreachable` is said to it when `to` doesn't answer. */
const pipeTo = (client: Socket, to: { host: string; port: number }, first: Buffer, unreachable?: Buffer) => {
  const server = connect(to.port, to.host);
  let connected = false;
  server.on('connect', () => {
    connected = true;
    server.write(first);
    client.pipe(server).pipe(client);
    client.resume();
  });
  server.on('error', () => (!connected && unreachable ? client.end(unreachable) : client.destroy(), server.destroy()));
  client.on('error', () => (client.destroy(), server.destroy()));
  client.on('close', () => server.destroy());
  server.on('close', () => connected && client.destroy());
};

/** What a client of the database port is told when Postgres doesn't answer the relay. */
const POSTGRES_DOWN = refusal('The apps’ relay can’t reach Postgres right now. Nothing was changed; try again, or ask an admin to look at the server (pc logs postgres).');

/** Reads a client's start: says no to TLS (the apps' network is Docker's own), then lets only an app's own login on. */
const databaseClient = (to: { host: string; port: number }) => (client: Socket) => {
  let held = Buffer.alloc(0);
  const timer = setTimeout(() => client.destroy(), START_TIMEOUT_MS);
  const refuse = (message: string) => (clearTimeout(timer), client.end(refusal(message)));
  const onData = (chunk: Buffer) => {
    held = Buffer.concat([held, chunk]);
    while (held.length >= 8) {
      const length = held.readInt32BE(0);
      if (length < 8 || length > MAX_START) return refuse('The apps’ relay to Postgres only takes a Postgres start message.');
      if (held.length < length) return;
      const code = held.readInt32BE(4);
      if (code === SSL_REQUEST || code === GSS_REQUEST) {
        held = held.subarray(length);
        client.write('N');
        continue;
      }
      client.off('data', onData);
      client.pause();
      clearTimeout(timer);
      if (code === CANCEL_REQUEST) return pipeTo(client, to, held, POSTGRES_DOWN);
      if (code !== PROTOCOL_3) return refuse('The apps’ relay to Postgres only takes a Postgres start message.');
      const user = userOf(held.subarray(8, length));
      if (!user || !APP_LOGIN.test(user)) return refuse('Through the apps’ relay, only an app’s own login reaches Postgres, never AUGUR’s own logins.');
      return pipeTo(client, to, held, POSTGRES_DOWN);
    }
  };
  client.on('data', onData);
  client.on('error', () => client.destroy());
};

/** What one relay reaches: Postgres for apps' own logins, or the object store's S3 API. */
export type RelayKind = 'database' | 'objects';

/** Where a relay listens and what it passes calls on to. */
export interface RelayOptions {
  kind: RelayKind;
  /** The address it listens on; every address unless a test says otherwise. */
  host?: string;
  listen: number;
  to: { host: string; port: number };
}

export interface Relay {
  port: number;
  close(): Promise<void>;
}

/**
 * Starts one relay. Each kind is its own container (db-relay, bucket-relay), so an app that asks only for a bucket
 * gets no way to Postgres, and one that asks only for a database none to the object store.
 */
export async function startRelay({ kind, host = '0.0.0.0', listen, to }: RelayOptions): Promise<Relay> {
  // The object store's S3 API as it is: each key opens only its own bucket. Its admin, RPC and web ports aren't relayed.
  const server: Server = createServer(
    kind === 'database'
      ? databaseClient(to)
      : (client) => {
          client.pause();
          pipeTo(client, to, Buffer.alloc(0));
        },
  );
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(listen, host, () => resolve((server.address() as AddressInfo).port));
  });
  return { port, close: () => new Promise<void>((r) => server.close(() => r())) };
}
