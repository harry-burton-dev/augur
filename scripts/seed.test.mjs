// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressesOf, castProblems, checkAllowed, deviceSignIn, emailOf, gatewayClient, loadCast, parseArgs, seed, SeedRefused } from './seed.mjs';

const cast = loadCast();

/** A gateway that answers the calls the seed makes, holding what it was given. */
const fakeAugur = ({ allowed = true, adminOnOrg = true, orgLibrary = true } = {}) => {
  const state = { departments: [], people: [], docs: [], entities: [], calls: [] };
  let n = 0;
  const org = { id: 'w-org', kind: 'org', name: 'Organisation' };
  const fetchImpl = async (url, init = {}) => {
    const { pathname, searchParams } = new URL(url);
    const method = init.method ?? 'GET';
    state.calls.push(`${method} ${pathname}`);
    const body = typeof init.body === 'string' && init.headers['content-type'] === 'application/json' ? JSON.parse(init.body) : init.body;
    const reply = (status, json) => new Response(json === undefined ? null : JSON.stringify(json), { status });
    if (init.headers.authorization !== 'Bearer t') return reply(401, { message: 'Sign in to continue.' });
    if (pathname === '/api/gateway/v1/status') return reply(200, { components: [], seeding: allowed ? { allowed: true } : { allowed: false, why: 'Not here.', whoCanChange: 'A deployment admin.' } });
    if (pathname === '/api/identity/v1/admin/departments' && method === 'GET') return reply(200, state.departments);
    if (pathname === '/api/identity/v1/admin/departments') {
      const d = { id: `d${++n}`, name: body.name, ...(body.parentId ? { parentId: body.parentId } : {}), members: [] };
      state.departments.push(d);
      return reply(201, d);
    }
    if (pathname === '/api/identity/v1/admin/roles') return reply(200, [{ name: 'admin' }, { name: 'editor' }, { name: 'publisher' }]);
    if (pathname === '/api/identity/v1/admin/people' && method === 'GET') return reply(200, state.people);
    if (pathname === '/api/identity/v1/admin/people') {
      const p = { id: `p${++n}`, ...body };
      state.people.push(p);
      return reply(201, { person: p, temporaryPassword: 'abcd-efgh-jkmn' });
    }
    if (pathname === '/api/identity/v1/me/workspaces') return reply(200, { workspaces: [{ id: 'w-me', kind: 'personal', name: 'You' }, ...(adminOnOrg ? [org] : [])] });
    if (pathname === '/api/folio/v1/library') return reply(200, { collections: orgLibrary && init.headers['x-workspace-id'] === org.id ? [{ id: 'lib-1', name: 'Library' }] : [] });
    if (pathname === '/api/folio/v1/folders/lib-1/documents' && method === 'GET') return reply(200, { documents: state.docs, total: state.docs.length });
    if (pathname === '/api/folio/v1/folders/lib-1/documents') {
      const d = { id: `doc${++n}`, title: searchParams.get('title'), text: body, type: init.headers['content-type'] };
      state.docs.push(d);
      return reply(201, d);
    }
    if (pathname === '/api/atlas/v1/entities' && method === 'GET') return reply(200, { entities: state.entities.filter((e) => e.label === searchParams.get('q')), total: 0 });
    if (pathname === '/api/atlas/v1/entities') {
      if (body.type === 'unicorn') return reply(400, { message: 'The ontology has no kind of thing called “unicorn”.' });
      const e = { id: `e${++n}`, ...body };
      state.entities.push(e);
      return reply(201, e);
    }
    return reply(404, { message: `no ${method} ${pathname}` });
  };
  return { state, api: gatewayClient({ gateway: 'http://augur.test', token: async () => 't', fetchImpl }) };
};

test('the sample cast can be seeded, and every sample person is at a domain that never delivers', () => {
  assert.deepEqual(castProblems(cast), []);
  for (const p of cast.people) assert.match(emailOf(cast, p), /@[^@]+\.invalid$/);
});

test('a cast with mistakes is refused, each mistake said', () => {
  const bad = structuredClone(cast);
  bad.synthetic.emailDomain = 'example.com';
  bad.people.push({ key: 'x', firstName: 'X', lastName: 'Y', floors: ['nowhere'], roles: ['deployment-admin'] });
  bad.floors.push({ key: 'finance', name: 'A/B' });
  const problems = castProblems(bad).join('\n');
  assert.match(problems, /isn't under \.invalid/);
  assert.match(problems, /"nowhere", which isn't a floor/);
  assert.match(problems, /never get deployment-admin/);
  assert.match(problems, /"finance" is named twice/);
  assert.match(problems, /with no \//);
});

test('stops before changing anything where the deployment doesn’t allow it, saying who can change that', async () => {
  const { api, state } = fakeAugur({ allowed: false });
  await assert.rejects(checkAllowed(api), (err) => err instanceof SeedRefused && /Not here\. A deployment admin\./.test(err.message));
  assert.deepEqual(state.calls, ['GET /api/gateway/v1/status']);
});

test('makes the floors, people, documents and entities, marked as sample data', async () => {
  const { api, state } = fakeAugur();
  const kept = [];
  const ledger = await seed({ cast, api, checkpoint: async (l) => kept.push(structuredClone(l)) });
  assert.equal(state.departments.length, 6);
  const payroll = state.departments.find((d) => d.name === 'Payroll');
  assert.equal(state.departments.find((d) => d.id === payroll.parentId).name, 'Finance');
  assert.equal(state.people.length, cast.people.length);
  assert.ok(state.people.every((p) => p.username.startsWith('sample-') && !p.roles.includes('deployment-admin')));
  assert.deepEqual(state.people.find((p) => p.username === 'sample-owen-pryce').departments.length, 2);
  // Every one-time password is kept as soon as it is given.
  assert.equal(kept.length, cast.people.length);
  assert.equal(ledger.people['grace-whitfield'].temporaryPassword, 'abcd-efgh-jkmn');
  // Only the organisation's documents: the admin isn't on the other floors.
  assert.deepEqual(state.docs.map((d) => d.title).sort(), cast.documents[0].items.map((d) => d.title).sort());
  assert.ok(state.docs.every((d) => d.text.endsWith(cast.synthetic.note) && d.type === 'text/markdown'));
  assert.equal(ledger.skipped.filter((s) => /aren’t on that floor/.test(s.why)).length, 2);
  assert.equal(state.entities.length, cast.entities.length);
  assert.ok(state.entities.every((e) => e.description.endsWith(cast.synthetic.note)));
});

test('running it again adds nothing that is already there', async () => {
  const { api, state } = fakeAugur();
  const first = await seed({ cast, api });
  const before = JSON.stringify(state.departments) + state.people.length + state.docs.length + state.entities.length;
  const second = await seed({ cast, api, ledger: first });
  assert.equal(JSON.stringify(state.departments) + state.people.length + state.docs.length + state.entities.length, before);
  // The one-time passwords from the first run stay in the ledger.
  assert.equal(second.people['amara-okafor'].temporaryPassword, 'abcd-efgh-jkmn');
});

test('says why when a floor’s library has no collection, or Data Atlas refuses an entity, and carries on', async () => {
  const { api, state } = fakeAugur({ orgLibrary: false });
  const withUnknown = { ...cast, entities: [{ type: 'unicorn', label: 'Sparkle' }, ...cast.entities] };
  const ledger = await seed({ cast: withUnknown, api });
  assert.equal(state.docs.length, 0);
  assert.ok(ledger.skipped.some((s) => /library has no collection yet; one of the floor’s leads makes it/.test(s.why)));
  assert.ok(ledger.skipped.some((s) => s.what === 'entity Sparkle' && /no kind of thing called/.test(s.why)));
  assert.equal(state.entities.length, cast.entities.length);
});

test('signs in with a one-time code, waiting while it is pending', async () => {
  const answers = [{ error: 'authorization_pending' }, { error: 'slow_down' }, { access_token: 't', refresh_token: 'r', expires_in: 300 }];
  const said = [];
  const waits = [];
  const fetchImpl = async (url) =>
    url.endsWith('/auth/device')
      ? new Response(JSON.stringify({ device_code: 'dc', user_code: 'ABCD-EFGH', verification_uri: 'https://sso/device', interval: 5, expires_in: 300 }))
      : (() => {
          const a = answers.shift();
          return new Response(JSON.stringify(a), { status: a.access_token ? 200 : 400 });
        })();
  const tokens = await deviceSignIn({ issuer: 'https://augur.test/sso/realms/platform', fetchImpl, say: (s) => said.push(s), wait: async (ms) => waits.push(ms) });
  assert.equal(tokens.access_token, 't');
  assert.match(said[0], /https:\/\/sso\/device.*ABCD-EFGH/);
  assert.deepEqual(waits, [5000, 5000, 10000]);
});

test('reaches the local stack by default, or a deployment by its address', () => {
  assert.deepEqual(addressesOf({}), { gateway: 'http://localhost:8080', issuer: 'http://localhost:8180/realms/platform' });
  assert.deepEqual(addressesOf({ url: 'https://augur.example/' }), { gateway: 'https://augur.example', issuer: 'https://augur.example/sso/realms/platform' });
  assert.deepEqual(parseArgs(['--url', 'https://a', '--check']), { url: 'https://a', check: true });
  assert.throws(() => parseArgs(['--force']), SeedRefused);
});
