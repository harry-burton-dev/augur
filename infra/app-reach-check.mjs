// What an app's container can reach, as the deploy test checks it (infra/deploy-test.sh, app_reach_check): run in the
// network of one of the app's own containers (`docker run --network container:<id>`), with REACH_TARGETS saying what
// to look at. deploy-test.sh builds them from the running deployment (ADR 0076, PER-412):
//
//   mustReach      [{ name, host, port }]   what an app is given: the gateway. Reaching it shows the check is
//                                           looking from the app's network.
//   mustNotReach   [{ name, host, port }]   every other container of AUGUR's, by its addresses and ports.
//   database       { host, port, logins }   Postgres as the app reaches it (db-relay), when the app has a database:
//                                           it must be there, and turn away each of AUGUR's own logins.
//
// Prints one line per target. Exits 1 when any is wrong, 2 when REACH_TARGETS can't be read.
import { connect } from 'node:net';
import { pathToFileURL } from 'node:url';

const TIMEOUT_MS = 3_000;

/** Whether a TCP connection opens: `open`, or why not (`ENOTFOUND`, `ECONNREFUSED`, `timeout`). */
export const tryConnect = ({ host, port }, timeoutMs = TIMEOUT_MS) =>
  new Promise((resolve) => {
    const socket = connect(port, host);
    const done = (result) => (socket.destroy(), resolve(result));
    socket.setTimeout(timeoutMs, () => done('timeout'));
    socket.once('connect', () => done('open'));
    socket.once('error', (err) => done(err.code ?? err.message));
  });

const startup = (user) => {
  const pairs = Buffer.from(`user\0${user}\0database\0platform\0\0`);
  const head = Buffer.alloc(8);
  head.writeInt32BE(8 + pairs.length, 0);
  head.writeInt32BE(196608, 4);
  return Buffer.concat([head, pairs]);
};

/**
 * What Postgres at `host:port` says to a start as `user`: `unreachable (<why>)`; `refused (<SQLSTATE>): <message>` for
 * an error before sign-in; or `accepted` for anything else (it asks for a password, or lets the login on).
 */
export const tryLogin = ({ host, port }, user, timeoutMs = TIMEOUT_MS) =>
  new Promise((resolve) => {
    const socket = connect(port, host);
    let opened = false;
    let got = Buffer.alloc(0);
    const done = (result) => (socket.destroy(), resolve(result));
    socket.setTimeout(timeoutMs, () => done(opened ? 'accepted (no answer)' : 'unreachable (timeout)'));
    socket.once('connect', () => ((opened = true), socket.write(startup(user))));
    socket.on('data', (chunk) => {
      got = Buffer.concat([got, chunk]);
      if (got[0] !== 'E'.charCodeAt(0)) return done('accepted');
      const text = got.toString('utf8');
      const code = /\0C([0-9A-Z]{5})\0/.exec(text);
      const message = /\0M([^\0]*)\0/.exec(text);
      if (code && message) done(`refused (${code[1]}): ${message[1]}`);
    });
    socket.once('error', (err) => done(opened ? 'accepted (cut off)' : `unreachable (${err.code ?? err.message})`));
    socket.once('end', () => done(opened ? 'refused (closed)' : 'unreachable (closed)'));
  });

const refusedByRelay = (said) => said.startsWith('refused (28000)') && !/can.t reach Postgres/.test(said);

/** Every target looked at, all at once: `{ ok, line }` for each, in the order given. */
export const reachCheck = async ({ mustReach = [], mustNotReach = [], database }, timeoutMs = TIMEOUT_MS) => {
  const reach = mustReach.map(async (t) => {
    const said = await tryConnect(t, timeoutMs);
    return { ok: said === 'open', line: `${t.name} (${t.host}:${t.port}): ${said === 'open' ? 'reached, as it should be' : `not reached (${said}), so this check isn't looking from the app's network`}` };
  });
  const notReach = mustNotReach.map(async (t) => {
    const said = await tryConnect(t, timeoutMs);
    return { ok: said !== 'open', line: `${t.name} (${t.host}:${t.port}): ${said === 'open' ? 'REACHED, and an app must never reach it' : `not reached (${said})`}` };
  });
  const logins = (database?.logins ?? []).map(async (user) => {
    const said = await tryLogin(database, user, timeoutMs);
    const ok = refusedByRelay(said);
    const why = said.startsWith('accepted') ? `${said.toUpperCase()}, and only an app's own login may get that far` : said.startsWith('unreachable') ? `${said}, but the app has a database, so the relay should be there to turn it away` : `${said}, which isn't the relay turning it away`;
    return { ok, line: `Postgres at ${database.host}:${database.port} as ${user}: ${ok ? said : why}` };
  });
  return Promise.all([...reach, ...notReach, ...logins]);
};

/** REACH_TARGETS, checked: what the deploy test passes, or why it can't be used. */
export const readTargets = (text) => {
  const targets = JSON.parse(text ?? '');
  const endpoint = (t) => typeof t?.name === 'string' && typeof t.host === 'string' && Number.isInteger(t.port);
  if (!Array.isArray(targets.mustReach) || !targets.mustReach.length || !targets.mustReach.every(endpoint)) throw new Error('mustReach must name at least the gateway');
  if (!Array.isArray(targets.mustNotReach) || !targets.mustNotReach.length || !targets.mustNotReach.every(endpoint)) throw new Error('mustNotReach must name at least one of AUGUR’s containers');
  if (targets.database && !(typeof targets.database.host === 'string' && Number.isInteger(targets.database.port) && Array.isArray(targets.database.logins) && targets.database.logins.length)) throw new Error('database needs a host, a port and the logins to try');
  return targets;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let targets;
  try {
    targets = readTargets(process.env.REACH_TARGETS);
  } catch (err) {
    console.error(`app-reach-check: REACH_TARGETS can't be used: ${err.message}`);
    process.exit(2);
  }
  const lines = await reachCheck(targets);
  for (const { ok, line } of lines) console.log(`${ok ? '✓' : '✗'} ${line}`);
  process.exit(lines.every((l) => l.ok) ? 0 : 1);
}
