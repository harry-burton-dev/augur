import { connect, createServer, type AddressInfo, type Server, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_LOGIN, startRelay, type Relay } from './relay.ts';

/** A stand-in upstream: records what reaches it, and answers each connection with "ok". */
const upstream = async () => {
  const got: Buffer[] = [];
  let connections = 0;
  const server: Server = createServer((s) => {
    connections += 1;
    s.on('data', (d) => (got.push(d), s.write('ok')));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: (server.address() as AddressInfo).port, got: () => Buffer.concat(got), connections: () => connections };
};

const startup = (user: string) => {
  const pairs = Buffer.from(`user\0${user}\0database\0platform\0\0`);
  const head = Buffer.alloc(8);
  head.writeInt32BE(8 + pairs.length, 0);
  head.writeInt32BE(196608, 4);
  return Buffer.concat([head, pairs]);
};
const sslRequest = () => {
  const b = Buffer.alloc(8);
  b.writeInt32BE(8, 0);
  b.writeInt32BE(80877103, 4);
  return b;
};

/** Sends `parts` in turn, each after the relay's answer to the one before when `waitBetween`, and gathers what comes back until it closes. */
const talk = (port: number, parts: Buffer[]) =>
  new Promise<Buffer>((resolve) => {
    const s: Socket = connect(port, '127.0.0.1');
    const back: Buffer[] = [];
    let next = 0;
    const send = () => next < parts.length && s.write(parts[next++]!);
    s.on('connect', send);
    s.on('data', (d) => {
      back.push(d);
      if (next < parts.length) send();
      else if (Buffer.concat(back).toString().endsWith('ok')) s.end();
    });
    s.on('close', () => resolve(Buffer.concat(back)));
    s.on('error', () => undefined);
  });

describe('the apps’ relay to Postgres and the object store', () => {
  const open: Array<{ close(): unknown }> = [];
  afterEach(async () => {
    for (const o of open.splice(0)) await o.close();
  });
  const relayTo = async () => {
    const db = await upstream();
    const s3 = await upstream();
    open.push({ close: () => db.server.close() }, { close: () => s3.server.close() });
    const relay: Relay = await startRelay({ host: '127.0.0.1', database: { listen: 0, to: { host: '127.0.0.1', port: db.port } }, objects: { listen: 0, to: { host: '127.0.0.1', port: s3.port } } });
    open.push(relay);
    return { db, s3, relay };
  };

  it('lets an app’s own login through to Postgres, after saying no to TLS', async () => {
    const { db, relay } = await relayTo();
    const back = await talk(relay.ports.database, [sslRequest(), startup('app_team_notes')]);
    expect(back.toString()).toBe('Nok');
    expect(db.got().equals(startup('app_team_notes'))).toBe(true);
  });

  it('turns away any other login, the platform’s superuser among them, before it reaches Postgres', async () => {
    const { db, relay } = await relayTo();
    for (const user of ['platform', 'identity', 'kg_app', 'postgres', 'app_', 'App_notes']) {
      const back = await talk(relay.ports.database, [startup(user)]);
      expect(back[0]).toBe('E'.charCodeAt(0));
      expect(back.toString()).toMatch(/28000.*only an app.s own login/s);
    }
    expect(db.connections()).toBe(0);
    expect(APP_LOGIN.test('app_team_notes_pr12')).toBe(true);
  });

  it('turns away what isn’t a Postgres start, and passes a cancel request on', async () => {
    const { db, relay } = await relayTo();
    const back = await talk(relay.ports.database, [Buffer.from('GET / HTTP/1.1\r\n\r\n')]);
    expect(back[0]).toBe('E'.charCodeAt(0));
    expect(db.connections()).toBe(0);
    const cancel = Buffer.alloc(16);
    cancel.writeInt32BE(16, 0);
    cancel.writeInt32BE(80877102, 4);
    expect((await talk(relay.ports.database, [cancel])).toString()).toBe('ok');
    expect(db.connections()).toBe(1);
  });

  it('passes the object store’s S3 calls on, and nothing else of it is on the app’s network', async () => {
    const { s3, relay } = await relayTo();
    expect((await talk(relay.ports.objects, [Buffer.from('GET /notes HTTP/1.1\r\n\r\n')])).toString()).toBe('ok');
    expect(s3.got().toString()).toContain('GET /notes');
    expect(Object.keys(relay.ports).sort()).toEqual(['database', 'objects']);
  });
});
