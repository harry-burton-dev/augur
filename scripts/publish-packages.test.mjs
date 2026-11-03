// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aliasDependencies, distTag, libraries, publishedManifest, publishedName } from './publish-packages.mjs';

test('an @augur package publishes under the owner scope, lower-cased', () => {
  assert.equal(publishedName('@augur/mfe-sdk', 'Harry-Burton-Dev'), '@harry-burton-dev/augur-mfe-sdk');
  assert.throws(() => publishedName('semver', 'x'));
});

test('@augur dependencies become aliases; others are left alone', () => {
  assert.deepEqual(aliasDependencies({ '@augur/records': '^0.1.0', semver: '^7.8.5' }, 'acme'), {
    '@augur/records': 'npm:@acme/augur-records@^0.1.0',
    semver: '^7.8.5',
  });
  assert.deepEqual(aliasDependencies({ '@augur/records': 'npm:@acme/augur-records@^0.1.0' }, 'acme'), {
    '@augur/records': 'npm:@acme/augur-records@^0.1.0',
  });
});

test('the published manifest drops private, scripts and dev dependencies, and names the repository', () => {
  const out = publishedManifest(
    { name: '@augur/service-kit', version: '0.11.0', private: true, scripts: { build: 'x' }, devDependencies: { vite: '1' }, dependencies: { fastify: '^5' }, files: ['dist'], __directory: 'platform/packages/service-kit' },
    { scope: 'acme', repository: 'acme/augur' },
  );
  assert.equal(out.name, '@acme/augur-service-kit');
  assert.equal(out.private, undefined);
  assert.equal(out.scripts, undefined);
  assert.equal(out.devDependencies, undefined);
  assert.equal(out.__directory, undefined);
  assert.deepEqual(out.dependencies, { fastify: '^5' });
  assert.deepEqual(out.repository, { type: 'git', url: 'git+https://github.com/acme/augur.git', directory: 'platform/packages/service-kit' });
  assert.deepEqual(out.publishConfig, { registry: 'https://npm.pkg.github.com' });
});

test('main publishes as latest; a hotfix line gets its own dist-tag', () => {
  assert.equal(distTag('main'), 'latest');
  assert.equal(distTag(undefined), 'latest');
  assert.equal(distTag('release/augur-0.13'), 'release-augur-0.13');
  assert.equal(distTag('release/mfe-sdk-1.9'), 'release-mfe-sdk-1.9');
});

test('every library in platform/packages is found', () => {
  const names = libraries().map(({ pkg }) => pkg.name);
  for (const name of ['@augur/mfe-sdk', '@augur/records', '@augur/service-kit', '@augur/app-tools']) assert.ok(names.includes(name), name);
});
