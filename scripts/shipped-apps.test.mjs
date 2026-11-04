import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeProblems, layoutProblems, problemsOf, releaseIdentity, releaseProblems, shippedImages, shippedParts } from './shipped-apps.mjs';

const pin = { repo: 'acme/augur-folio', version: '0.7.1', parts: { '@apps/folio': '0.3.3', '@apps/folio-frontend': '0.7.1' }, build: { 'folio-worker': 'worker/Dockerfile' }, port: 8083, workers: ['folio-worker'] };
const digest = `@sha256:${'a'.repeat(64)}`;
const release = { schema: 'augur.app-release/v1', id: 'folio', version: '0.7.1', service: { image: `ghcr.io/acme/augur-folio/folio${digest}` }, signer: { repository: 'acme/augur-folio', workflow: '.github/workflows/release.yml' } };

test('a pin names a repository, a release (never a dev build or preview), its packages, and Dockerfiles inside the app', () => {
  assert.deepEqual(problemsOf({ apps: { folio: pin } }), []);
  assert.match(problemsOf({ apps: { folio: { ...pin, version: '0.7.2-dev.4' } } }).join(), /releases only/);
  assert.match(problemsOf({ apps: { folio: { ...pin, version: '0.7.2-pr.9.1' } } }).join(), /releases only/);
  assert.match(problemsOf({ apps: { folio: { ...pin, parts: {} } } }).join(), /shipped-apps.mjs pin folio/);
  assert.match(problemsOf({ apps: { folio: { ...pin, repo: 'folio' } } }).join(), /owner\/repo/);
  assert.match(problemsOf({ apps: { folio: { ...pin, build: { w: '../infra/Dockerfile' } } } }).join(), /inside the app/);
  assert.match(problemsOf({}).join(), /no "apps"/);
});

test('a pin says where its service answers and which of its images are workers', () => {
  assert.match(problemsOf({ apps: { folio: { ...pin, port: undefined } } }).join(), /"port" must be/);
  assert.match(problemsOf({ apps: { folio: pin, notes: { ...pin, repo: 'acme/notes', build: {}, workers: [] } } }).join(), /port 8083 is folio's too/);
  assert.match(problemsOf({ apps: { folio: { ...pin, workers: [] } } }).join(), /folio-worker is built but isn't in "workers"/);
  assert.match(problemsOf({ apps: { folio: { ...pin, workers: ['folio-worker', 'indexer'] } } }).join(), /"indexer" isn't one of the images/);
  assert.match(problemsOf({ apps: { folio: pin, 'folio-worker': { ...pin, build: {}, workers: [], port: 8099 } } }).join(), /"folio-worker" is named by two apps/);
  assert.deepEqual(shippedImages({ apps: { folio: pin } }), [
    { image: 'folio', app: 'folio', role: 'service', port: 8083 },
    { image: 'folio-worker', app: 'folio', role: 'worker' },
  ]);
});

const shipped = { apps: { notes: { ...pin, repo: 'acme/notes', port: 8095, build: { 'notes-indexer': 'x/Dockerfile' }, workers: ['notes-indexer'] } } };
const image = (name) => `\${PLATFORM_IMAGES:-ghcr.io/acme/augur}/${name}:\${PLATFORM_VERSION}`;
const compose = (more = {}) => {
  const services = {
    gateway: { build: {}, environment: { APP_UPSTREAMS: 'notes=http://notes:8095' } },
    identity: { image: image('identity'), environment: { SERVICE_CLIENT_SECRETS: 'platform-identity=a,app-notes=b' } },
    registry: { image: image('registry'), environment: ['PILLAR_APPS=notes'] },
    storage: { image: image('storage'), environment: { APP_STORAGE: 'notes ${APP_STORAGE:-}' } },
    notes: { image: image('notes'), environment: { PORT: 8095 }, healthcheck: { test: ['CMD', 'wget', 'http://127.0.0.1:8095/healthz'] } },
    'notes-indexer': { image: image('notes-indexer') },
    postgres: { image: 'postgres:16' },
    ...more,
  };
  return JSON.stringify({ services: Object.fromEntries(Object.entries(services).filter(([, v]) => v)) });
};
const platform = ['gateway', 'identity', 'registry', 'storage', 'web'];

test('a compose file runs each shipped app and its workers as release/shipped-apps.json says, and no other app of AUGUR\'s', () => {
  assert.deepEqual(composeProblems(shipped, 'c.yml', compose(), 'deployment', platform), []);
  const problems = (more, kind = 'deployment') => composeProblems(shipped, 'c.yml', compose(more), kind, platform).join('\n');
  assert.match(problems({ 'notes-indexer': undefined }), /no notes-indexer service/);
  assert.match(problems({ notes: { image: image('notes'), environment: { PORT: 8096 } } }), /PORT 8096, and .* says 8095/);
  assert.match(problems({ notes: { image: image('notes'), environment: { PORT: 8095 }, healthcheck: { test: 'wget http://127.0.0.1:8083/healthz' } } }), /healthcheck doesn't ask port 8095/);
  assert.match(problems({ notes: { image: 'ghcr.io/elsewhere/notes:1', environment: { PORT: 8095 } } }), /doesn't run AUGUR's notes image/);
  assert.match(problems({ maps: { image: image('maps') } }), /maps runs AUGUR's maps image, which is neither/);
  assert.match(problems({ registry: { environment: { PILLAR_APPS: 'notes maps' } } }), /PILLAR_APPS is "notes maps"/);
  assert.match(problems({ gateway: { environment: { APP_UPSTREAMS: 'notes=http://notes:8090,maps=http://maps:1' } } }), /notes=http:\/\/notes:8090, not notes=http:\/\/notes:8095[\s\S]*names maps/);
  assert.match(problems({ identity: { environment: { SERVICE_CLIENT_SECRETS: 'platform-identity=a' } } }), /no app-notes/);
  assert.match(problems({ storage: { environment: { APP_STORAGE: 'notes maps' } } }), /APP_STORAGE names maps/);
});

test('a build overlay runs the shipped apps from their releases, never builds them', () => {
  const overlay = (more = {}) => JSON.stringify({ services: { gateway: { build: {} }, notes: { image: image('notes') }, 'notes-indexer': { image: image('notes-indexer') }, ...more } });
  assert.deepEqual(composeProblems(shipped, 'b.yml', overlay(), 'overlay', platform), []);
  assert.match(composeProblems(shipped, 'b.yml', overlay({ notes: { image: image('notes'), build: { context: '.' } } }), 'overlay', platform).join(), /notes is built here/);
  assert.match(composeProblems(shipped, 'b.yml', overlay({ maps: { build: {} } }), 'overlay', platform).join(), /maps runs AUGUR's maps image/);
});

test('the compose files here agree with release/shipped-apps.json', () => {
  assert.deepEqual(layoutProblems(), []);
});

test('its packages become AUGUR parts that live elsewhere', () => {
  assert.deepEqual(shippedParts({ apps: { folio: pin } }), {
    '@apps/folio': { version: '0.3.3', path: '', app: 'folio' },
    '@apps/folio-frontend': { version: '0.7.1', path: '', app: 'folio' },
  });
});

test('a release is taken only when it is that app at that version, signed in its own repository, with its service by digest', () => {
  assert.deepEqual(releaseProblems('folio', pin, release), []);
  assert.match(releaseProblems('folio', pin, { ...release, id: 'atlas' }).join(), /of "atlas"/);
  assert.match(releaseProblems('folio', pin, { ...release, version: '0.7.0' }).join(), /not 0.7.1/);
  assert.match(releaseProblems('folio', pin, { ...release, signer: { repository: 'mallory/fork', workflow: '.github/workflows/release.yml' } }).join(), /signed by mallory\/fork/);
  assert.match(releaseProblems('folio', pin, { ...release, signer: { ...release.signer, workflow: '.github/workflows/app-dev.yml' } }).join(), /signed by/);
  assert.match(releaseProblems('folio', pin, { ...release, service: { image: 'ghcr.io/acme/augur-folio/folio:latest' } }).join(), /by digest/);
  assert.match(releaseProblems('folio', pin, { ...release, schema: 'other' }).join(), /not augur.app-release\/v1/);
  assert.equal(releaseIdentity('acme/augur-folio'), 'https://github.com/acme/augur-folio/.github/workflows/release.yml@refs/heads/main');
});
