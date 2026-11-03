import assert from 'node:assert/strict';
import { test } from 'node:test';
import { problemsOf, releaseIdentity, releaseProblems, shippedParts } from './shipped-apps.mjs';

const pin = { repo: 'acme/augur-folio', version: '0.7.1', parts: { '@apps/folio': '0.3.3', '@apps/folio-frontend': '0.7.1' }, build: { 'folio-worker': 'worker/Dockerfile' } };
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
