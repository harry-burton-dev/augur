// The apps' relay (ADR 0076, design review ISO-2): what an app's network has in place of Postgres and the object
// store. An app that asks for a database reaches Postgres only through it, and only as its own login, never as the
// platform's superuser or a platform service's; one that asks for a bucket reaches only the object store's S3 API,
// never its admin API. The runner joins it to an app's network as `postgres` and `garage`, so an app's parts are
// told the same host names as before.
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

/** The value of `user` in a start message's body (after its length and protocol), or undefined. */
const userOf = (body: Buffer) => {
  const pairs = body.toString('utf8').split('\0');
  for (let i = 0; i + 1 < pairs.length; i += 2) if (pairs[i] === 'user') return pairs[i + 1];
  return undefined;
};

const pipeTo = (client: Socket, to: { host: string; port: number }, first: Buffer) => {
  const server = connect(to.port, to.host);
  server.on('connect', () => {
    server.write(first);
    client.pipe(server).pipe(client);
    client.resume();
  });
  const end = () => (client.destroy(), server.destroy());
  server.on('error', end);
  client.on('error', end);
  client.on('close', () => server.destroy());
  server.on('close', () => client.destroy());
};

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
      if (code === CANCEL_REQUEST) return pipeTo(client, to, held);
      if (code !== PROTOCOL_3) return refuse('The apps’ relay to Postgres only takes a Postgres start message.');
      const user = userOf(held.subarray(8, length));
      if (!user || !APP_LOGIN.test(user)) return refuse('Through the apps’ relay, only an app’s own login reaches Postgres, never the platform’s or a service’s.');
      return pipeTo(client, to, held);
    }
  };
  client.on('data', onData);
  client.on('error', () => client.destroy());
};

/** Where the relay listens and what it passes calls on to. */
export interface RelayOptions {
  /** The address it listens on; every address unless a test says otherwise. */
  host?: string;
  database: { listen: number; to: { host: string; port: number } };
  objects: { listen: number; to: { host: string; port: number } };
}

export interface Relay {
  /** The ports it listens on, by what they reach. */
  ports: { database: number; objects: number };
  close(): Promise<void>;
}

const listen = (server: Server, port: number, host: string) =>
  new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve((server.address() as AddressInfo).port));
  });

export async function startRelay({ host = '0.0.0.0', database, objects }: RelayOptions): Promise<Relay> {
  const db = createServer({ pauseOnConnect: false }, databaseClient(database.to));
  // The object store's S3 API as it is: each key opens only its own bucket. Its admin, RPC and web ports aren't relayed.
  const s3 = createServer((client) => {
    client.pause();
    pipeTo(client, objects.to, Buffer.alloc(0));
  });
  const ports = { database: await listen(db, database.listen, host), objects: await listen(s3, objects.listen, host) };
  return {
    ports,
    close: async () => {
      await Promise.all([db, s3].map((s) => new Promise<void>((r) => s.close(() => r()))));
    },
  };
}
