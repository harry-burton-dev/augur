// Fills a deployment with a synthetic cast: people, floors (departments and teams), Artifacts documents
// and Data Atlas entities, through the public APIs only, as the admin who runs it (ADR 0056, docs/seed.md).
//   pnpm seed                                  your local stack (gateway :8080, Keycloak :8180)
//   pnpm seed --url https://augur.example.ts.net
//   pnpm seed --data path/to/cast.json --ledger path/to/ledger.json
//   pnpm seed --check                          checks the data file and prints what it would make; calls nothing
// It runs only where the deployment allows it (SEED_ALLOWED=true; Admin's Status says so). Every name and
// text comes from the data file, never from here. Running it again adds only what is missing.
// AUGUR_TOKEN skips the sign-in with an admin's access token, for scripts that already hold one.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
export const DEFAULT_DATA = join(root, 'scripts/seed/cast.json');
const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** The floor every cast can name without making it: the organisation's own. */
export const ORG = 'org';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Every floor in the cast, top down, each with its parent's key. */
export const floorsOf = (cast) => {
  const out = [];
  const walk = (list, parent, depth) => {
    for (const f of list ?? []) {
      out.push({ key: f.key, name: f.name, parent, depth });
      walk(f.teams, f.key, depth + 1);
    }
  };
  walk(cast.floors, undefined, 1);
  return out;
};

/** What is wrong with a cast, as sentences; empty when it can be seeded. */
export const castProblems = (cast) => {
  if (!isObj(cast)) return ['The data file must hold one JSON object.'];
  const problems = [];
  const s = cast.synthetic;
  if (!isObj(s)) problems.push('"synthetic" is missing: it says how everything seeded is marked.');
  else {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s.emailDomain ?? '')) problems.push('"synthetic.emailDomain" must be a domain, such as sample.augur.invalid.');
    else if (!s.emailDomain.endsWith('.invalid') && !s.emailDomainDelivers) problems.push(`"synthetic.emailDomain" ${s.emailDomain} isn't under .invalid, so mail to sample people could reach someone; set "emailDomainDelivers": true if that domain is yours.`);
    if (!/^[a-z0-9][a-z0-9._-]{0,19}$/.test(s.usernamePrefix ?? '')) problems.push('"synthetic.usernamePrefix" must be a short lower-case prefix, such as sample-.');
    if (!text(s.note, 200)) problems.push('"synthetic.note" must say, in a few words, that this is sample data.');
  }
  const floors = floorsOf(cast);
  const floorKeys = new Set([ORG]);
  for (const f of floors) {
    if (!KEY.test(f.key ?? '')) problems.push(`Floor "${f.key}": its key must be lower-case letters, digits and dashes.`);
    else if (floorKeys.has(f.key)) problems.push(`Floor "${f.key}" is named twice (or is "${ORG}", the organisation's own).`);
    floorKeys.add(f.key);
    if (!text(f.name, 60) || f.name.includes('/')) problems.push(`Floor "${f.key}": its name must be 1 to 60 characters, with no /.`);
    if (f.depth > 5) problems.push(`Floor "${f.key}" is ${f.depth} levels down; AUGUR allows 5.`);
  }
  const peopleKeys = new Set();
  for (const p of cast.people ?? []) {
    const who = `Person "${p.key}"`;
    if (!KEY.test(p.key ?? '')) problems.push(`${who}: the key must be lower-case letters, digits and dashes.`);
    else if (peopleKeys.has(p.key)) problems.push(`${who} is named twice.`);
    peopleKeys.add(p.key);
    if (!text(p.firstName, 80) || !text(p.lastName, 80)) problems.push(`${who}: needs a first and last name of up to 80 characters.`);
    for (const f of p.floors ?? []) if (!floorKeys.has(f) || f === ORG) problems.push(`${who} is on "${f}", which isn't a floor in the cast (everyone is on the organisation's already).`);
    if ((p.roles ?? []).includes('deployment-admin')) problems.push(`${who}: sample people never get deployment-admin.`);
    if (p.roles !== undefined && !(Array.isArray(p.roles) && p.roles.every((r) => typeof r === 'string'))) problems.push(`${who}: "roles" is a list of role names.`);
  }
  for (const lib of cast.documents ?? []) {
    const where = `Documents for "${lib.floor}"`;
    if (!floorKeys.has(lib.floor)) problems.push(`${where}: that isn't a floor in the cast.`);
    if (lib.library !== undefined && !text(lib.library, 120)) problems.push(`${where}: "library" names one library, up to 120 characters.`);
    for (const d of lib.items ?? []) {
      if (!text(d.title, 200)) problems.push(`${where}: every document needs a title of up to 200 characters.`);
      if (!/^[\w .()-]{1,120}\.(md|txt)$/.test(d.filename ?? '')) problems.push(`${where}: "${d.title}" needs a filename ending .md or .txt.`);
      if (!text(d.text, 200_000)) problems.push(`${where}: "${d.title}" needs its text.`);
    }
  }
  for (const e of cast.entities ?? []) {
    const what = `Entity "${e.label}"`;
    if (!text(e.label, 200)) problems.push('Every entity needs a label of up to 200 characters.');
    if (!KEY.test(e.type ?? '')) problems.push(`${what}: "type" is a kind from Data Atlas's ontology, such as port.`);
    if (e.floor !== undefined && !floorKeys.has(e.floor)) problems.push(`${what}: "${e.floor}" isn't a floor in the cast.`);
  }
  return problems;
};

export const loadCast = (path = DEFAULT_DATA) => {
  const cast = JSON.parse(readFileSync(path, 'utf8'));
  const problems = castProblems(cast);
  if (problems.length) throw new Error(`${path} can't be seeded:\n  - ${problems.join('\n  - ')}`);
  return cast;
};

export const usernameOf = (cast, person) => `${cast.synthetic.usernamePrefix}${person.key}`;
export const emailOf = (cast, person) => `${usernameOf(cast, person)}@${cast.synthetic.emailDomain}`;
const marked = (cast, words) => (words ? `${words.trim()}\n\n${cast.synthetic.note}` : cast.synthetic.note);

/** What the seed would make, in words, for --check. */
export const describe = (cast) => [
  `${floorsOf(cast).length} floors: ${floorsOf(cast).map((f) => f.name).join(', ')}`,
  `${(cast.people ?? []).length} people at @${cast.synthetic.emailDomain}`,
  `${(cast.documents ?? []).reduce((n, l) => n + (l.items ?? []).length, 0)} documents on ${(cast.documents ?? []).length} floors`,
  `${(cast.entities ?? []).length} entities`,
];

export class SeedRefused extends Error {}

/** Thrown for an answer that isn't 2xx: its status and AUGUR's own message. */
export class ApiError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} answered ${status}${body?.message ? `: ${body.message}` : ''}`);
    this.status = status;
    this.body = body;
  }
}

/** Calls the gateway as the signed-in admin; `token()` gives a fresh access token each time. */
export const gatewayClient = ({ gateway, token, fetchImpl = fetch }) => {
  const base = gateway.replace(/\/$/, '');
  const call = async (method, path, { body, floor, raw, type } = {}) => {
    const headers = { authorization: `Bearer ${await token()}` };
    if (floor) headers['x-workspace-id'] = floor;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (raw !== undefined) headers['content-type'] = type;
    const res = await fetchImpl(`${base}${path}`, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const answer = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    if (!res.ok) throw new ApiError(method, path, res.status, answer);
    return answer;
  };
  return {
    get: (path, opts) => call('GET', path, opts),
    post: (path, body, opts) => call('POST', path, { ...opts, body }),
    put: (path, body, opts) => call('PUT', path, { ...opts, body }),
    upload: (path, raw, type, opts) => call('POST', path, { ...opts, raw, type }),
  };
};

const ID = '/api/identity/v1';
const FOLIO = '/api/folio/v1';
const ATLAS = '/api/atlas/v1';

/** Stops unless the deployment says seeding is allowed, with its reason and who can change it. */
export const checkAllowed = async (api) => {
  let status;
  try {
    status = await api.get('/api/gateway/v1/status');
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) throw new SeedRefused('Only an admin can seed. Sign in as one.');
    throw err;
  }
  const seeding = status?.seeding;
  if (!seeding) throw new SeedRefused('This AUGUR is older than the seed and doesn’t say whether it allows sample data. Upgrade it first.');
  if (!seeding.allowed) throw new SeedRefused(`${seeding.why ?? 'This deployment doesn’t allow sample data.'} ${seeding.whoCanChange ?? ''}`.trim());
};

/**
 * Adds what the cast describes and the deployment doesn't have yet. Returns the ledger: every id it made or
 * found, and each new person's one-time password, so the run suite can sign them in.
 */
export const seed = async ({ cast, api, ledger = {}, log = () => {}, checkpoint = async () => {} }) => {
  const out = { ...ledger, floors: { ...ledger.floors }, people: { ...ledger.people }, documents: { ...ledger.documents }, entities: { ...ledger.entities }, skipped: [] };
  const skip = (what, why) => {
    out.skipped.push({ what, why });
    log(`– ${what}: ${why}`);
  };

  // Floors: departments and the teams inside them, matched by name under the same parent.
  const departments = await api.get(`${ID}/admin/departments`);
  const deptId = {};
  for (const f of floorsOf(cast)) {
    const parentId = f.parent ? deptId[f.parent] : undefined;
    const found = departments.find((d) => d.name.toLowerCase() === f.name.toLowerCase() && (d.parentId ?? undefined) === parentId);
    const made = found ?? (await api.post(`${ID}/admin/departments`, { name: f.name, ...(parentId ? { parentId } : {}) }));
    deptId[f.key] = made.id;
    out.floors[f.key] = { id: made.id, name: f.name };
    if (!found) log(`+ floor ${f.name}`);
  }

  // People, matched by username. Existing people keep their floors and roles; only the new ones get the cast's.
  const people = await api.get(`${ID}/admin/people`);
  const roles = new Set((await api.get(`${ID}/admin/roles`)).map((r) => r.name));
  for (const p of cast.people ?? []) {
    const username = usernameOf(cast, p);
    const found = people.find((x) => x.username === username);
    if (found) {
      out.people[p.key] = { ...out.people[p.key], id: found.id, username, email: found.email };
      continue;
    }
    const unknown = (p.roles ?? []).filter((r) => !roles.has(r));
    if (unknown.length) {
      skip(`person ${p.firstName} ${p.lastName}`, `this deployment has no role called ${unknown.join(', ')}.`);
      continue;
    }
    const { person, temporaryPassword } = await api.post(`${ID}/admin/people`, {
      username,
      firstName: p.firstName,
      lastName: p.lastName,
      email: emailOf(cast, p),
      roles: p.roles ?? [],
      departments: (p.floors ?? []).map((k) => deptId[k]),
    });
    out.people[p.key] = { id: person.id, username, email: person.email, temporaryPassword };
    // Kept at once: a one-time password is shown only now.
    await checkpoint(out);
    log(`+ person ${p.firstName} ${p.lastName} (${username})`);
  }

  // Floors the admin can stand on, for documents and entities: the organisation's, and teams they're on.
  const { workspaces } = await api.get(`${ID}/me/workspaces`);
  const standOn = (key) => (key === ORG ? workspaces.find((w) => w.kind === 'org') : workspaces.find((w) => w.id === deptId[key]));
  const floorName = (key) => (key === ORG ? 'the organisation' : floorsOf(cast).find((f) => f.key === key)?.name ?? key);

  // Documents go into a library already on their floor: making one is for that floor's leads.
  for (const group of cast.documents ?? []) {
    const floor = standOn(group.floor);
    const items = group.items ?? [];
    if (!floor) {
      skip(`${items.length} documents on ${floorName(group.floor)}`, 'you aren’t on that floor, so the seed can’t add to it as you. Its people add them once they can sign in (the run suite).');
      continue;
    }
    let libraries;
    try {
      ({ libraries } = await api.get(`${FOLIO}/libraries`, { floor: floor.id }));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      skip(`${items.length} documents on ${floor.name}`, `Artifacts couldn't be reached there (${err.message}).`);
      continue;
    }
    const library = group.library ? libraries.find((l) => l.name === group.library) : libraries[0];
    if (!library) {
      skip(
        `${items.length} documents on ${floor.name}`,
        group.library ? `Artifacts has no library called “${group.library}” there; one of the floor’s leads makes it.` : 'Artifacts has no library there yet; one of the floor’s leads makes it.',
      );
      continue;
    }
    const titles = new Set();
    for (let offset = 0, total = Infinity; offset < total; ) {
      const page = await api.get(`${FOLIO}/libraries/${encodeURIComponent(library.id)}/documents?limit=100&offset=${offset}`, { floor: floor.id });
      for (const d of page.documents) titles.add(d.title);
      total = page.total ?? 0;
      offset += Math.max(page.documents.length, 1);
      if (!page.documents.length) break;
    }
    for (const d of items) {
      const key = `${group.floor}/${d.title}`;
      if (titles.has(d.title)) continue;
      const type = d.filename.endsWith('.md') ? 'text/markdown' : 'text/plain';
      const q = new URLSearchParams({ filename: d.filename, title: d.title });
      const made = await api.upload(`${FOLIO}/libraries/${encodeURIComponent(library.id)}/documents?${q}`, marked(cast, d.text), type, { floor: floor.id });
      out.documents[key] = { id: made.id, library: library.id };
      log(`+ document ${d.title} (${floor.name}, ${library.name})`);
    }
  }

  // Entities, matched by kind and label on their floor.
  for (const e of cast.entities ?? []) {
    const floor = standOn(e.floor ?? ORG);
    const key = `${e.floor ?? ORG}/${e.type}/${e.label}`;
    if (!floor) {
      skip(`entity ${e.label}`, `you aren’t on ${floorName(e.floor)}, so the seed can’t add to it as you.`);
      continue;
    }
    try {
      const q = new URLSearchParams({ q: e.label, type: e.type, limit: '50' });
      const { entities } = await api.get(`${ATLAS}/entities?${q}`, { floor: floor.id });
      const found = entities.find((x) => x.label === e.label && x.type === e.type);
      const made =
        found ??
        (await api.post(
          `${ATLAS}/entities`,
          { type: e.type, label: e.label, ...(e.aliases?.length ? { aliases: e.aliases } : {}), description: marked(cast, e.description), ...(e.details ? { details: e.details } : {}) },
          { floor: floor.id },
        ));
      out.entities[key] = { id: made.id };
      if (!found) log(`+ entity ${e.label} (${e.type})`);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status >= 500) throw err;
      skip(`entity ${e.label}`, `Data Atlas refused it (${err.message}).`);
    }
  }
  return out;
};

/** Signs an admin in from the terminal with a one-time code (OAuth 2.0 device grant, RFC 8628). */
export const deviceSignIn = async ({ issuer, clientId = 'platform-cli', fetchImpl = fetch, say = console.log, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) => {
  const base = `${issuer.replace(/\/$/, '')}/protocol/openid-connect`;
  const form = (fields) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) });
  const start = await fetchImpl(`${base}/auth/device`, form({ client_id: clientId, scope: 'openid' }));
  if (!start.ok) {
    throw new SeedRefused(
      `The sign-in service won't sign you in from the terminal (${start.status}). Its realm needs the ${clientId} client (docs/upgrade.md, "Sample data, where you allow it").`,
    );
  }
  const code = await start.json();
  say(`Sign in as an admin: open ${code.verification_uri_complete ?? code.verification_uri} and confirm the code ${code.user_code}.`);
  let interval = (code.interval ?? 5) * 1000;
  const until = Date.now() + (code.expires_in ?? 300) * 1000;
  while (Date.now() < until) {
    await wait(interval);
    const res = await fetchImpl(`${base}/token`, form({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: code.device_code, client_id: clientId }));
    const body = await res.json().catch(() => ({}));
    if (res.ok) return body;
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') {
      interval += 5000;
      continue;
    }
    throw new SeedRefused(body.error === 'access_denied' ? 'The sign-in was turned down.' : `The sign-in failed (${body.error ?? res.status}).`);
  }
  throw new SeedRefused('The code ran out before it was confirmed. Run the seed again.');
};

/** A fresh access token on each call, refreshed a little before it runs out. */
export const tokenKeeper = ({ issuer, clientId = 'platform-cli', tokens, fetchImpl = fetch, now = Date.now }) => {
  let current = tokens;
  let expires = now() + (tokens.expires_in ?? 60) * 1000;
  return async () => {
    if (current.refresh_token && now() > expires - 30_000) {
      const res = await fetchImpl(`${issuer.replace(/\/$/, '')}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refresh_token, client_id: clientId }),
      });
      if (!res.ok) throw new SeedRefused('Your sign-in ran out and couldn’t be renewed. Run the seed again; it carries on where it stopped.');
      current = await res.json();
      expires = now() + (current.expires_in ?? 60) * 1000;
    }
    return current.access_token;
  };
};

export const parseArgs = (argv) => {
  const args = { check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (['--url', '--data', '--ledger', '--issuer'].includes(a) && argv[i + 1]) args[a.slice(2)] = argv[++i];
    else throw new SeedRefused(`Unknown option ${a}. Options: --url <AUGUR's address>, --issuer <its sign-in realm>, --data <cast.json>, --ledger <file>, --check.`);
  }
  return args;
};

/** Where the gateway and the sign-in realm are: the local stack, or a deployment's address (deploy.md). */
export const addressesOf = ({ url, issuer }) =>
  url
    ? { gateway: url.replace(/\/$/, ''), issuer: issuer ?? `${url.replace(/\/$/, '')}/sso/realms/platform` }
    : { gateway: 'http://localhost:8080', issuer: issuer ?? 'http://localhost:8180/realms/platform' };

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const cast = loadCast(args.data ? resolve(args.data) : DEFAULT_DATA);
  if (args.check) {
    console.log(`The cast can be seeded. It makes:\n  ${describe(cast).join('\n  ')}`);
    return;
  }
  const { gateway, issuer } = addressesOf(args);
  const token = process.env.AUGUR_TOKEN ? async () => process.env.AUGUR_TOKEN : tokenKeeper({ issuer, tokens: await deviceSignIn({ issuer }) });
  const api = gatewayClient({ gateway, token });
  await checkAllowed(api);
  // The ledger holds one-time passwords: it lives outside the repository's tracked files, readable by you only.
  const ledgerPath = args.ledger ? resolve(args.ledger) : join(root, '.seed', `${new URL(gateway).host.replace(/[^a-z0-9.-]/gi, '_')}.json`);
  const before = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
  const save = (ledger) => {
    mkdirSync(dirname(ledgerPath), { recursive: true });
    writeFileSync(ledgerPath, `${JSON.stringify({ schema: 'augur.seed-ledger/v1', gateway, at: new Date().toISOString(), ...ledger }, null, 2)}\n`, { mode: 0o600 });
    chmodSync(ledgerPath, 0o600);
  };
  const ledger = await seed({ cast, api, ledger: before, log: (line) => console.log(line), checkpoint: async (l) => save(l) });
  save(ledger);
  console.log(`Seeded ${gateway}. What it made, and new people's one-time passwords, are in ${ledgerPath}.`);
  if (ledger.skipped.length) console.log(`${ledger.skipped.length} things were left out; each says why above.`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`✗ ${err instanceof SeedRefused || err instanceof ApiError ? err.message : err.stack}`);
    process.exit(1);
  });
}
