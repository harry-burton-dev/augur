import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowed, refused, renderNotices, uncreditedImages } from './licences.mjs';

test('which licence expressions may ship', () => {
  for (const [expression, ok] of [
    ['MIT', true],
    ['(MIT OR CC0-1.0)', true],
    ['MIT OR GPL-3.0', true],
    ['MIT AND GPL-3.0-only', false],
    ['GPL-3.0-only', false],
    ['AGPL-3.0-or-later', false],
    ['GPL-2.0 WITH Classpath-exception-2.0', false],
    ['LGPL-3.0', true],
    ['Unknown', false],
    ['UNLICENSED', false],
    ['', false],
  ]) assert.equal(allowed(expression), ok, expression);
});

test('a refused package passes only with its reviewed allow entry, and AUGUR\'s own packages are skipped', () => {
  const list = {
    'GPL-3.0': [{ name: 'copyleft', versions: ['1.0.0'] }],
    Unknown: [{ name: '@harry-burton-dev/augur-kit-common', versions: ['1.0.0'] }],
  };
  assert.deepEqual(refused(list), ['copyleft@1.0.0 is under GPL-3.0']);
  assert.deepEqual(refused(list, [{ package: 'copyleft', licence: 'GPL-3.0' }]), []);
});

test('the Compose file may run only AUGUR\'s own images and credited ones', () => {
  const compose = [
    '  web:',
    '    image: ${PLATFORM_IMAGES:-ghcr.io/harry-burton-dev/im-platform}/web:${PLATFORM_VERSION}',
    '    image: postgres:16-alpine',
    '    image: quay.io/keycloak/keycloak:26.0.8',
  ].join('\n');
  assert.deepEqual(uncreditedImages(compose, { images: [{ image: 'postgres' }] }), ['quay.io/keycloak/keycloak']);
});

test('the notices are the same bytes for the same input, and a shared licence text is printed once', () => {
  const list = {
    MIT: [{ name: 'b', versions: ['2.0.0'], license: 'MIT' }, { name: 'a', versions: ['1.0.0'], license: 'MIT', homepage: 'https://a.example' }],
    ISC: [{ name: 'c', versions: ['3.0.0'], license: 'ISC' }],
  };
  const read = (p) => (p.name === 'c' ? 'ISC text' : 'MIT text');
  const extra = { images: [{ image: 'postgres', licence: 'PostgreSQL' }], data: [] };
  const once = renderNotices(list, extra, read);
  assert.equal(renderNotices(list, extra, read), once);
  assert.equal(once.match(/MIT text/g).length, 1);
  assert.match(once, /### a@1\.0\.0, b@2\.0\.0/);
  assert.ok(once.indexOf('### ISC') < once.indexOf('### MIT'));
});
