// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aliasDependencies, cssEntrypoints, distTag, libraries, publishedManifest, publishedName } from './publish-packages.mjs';

test('an @augur package publishes under the owner scope, lower-cased', () => {
  assert.equal(publishedName('@augur/mfe-sdk', 'Harry-Burton-Dev'), '@harry-burton-dev/augur-mfe-sdk');
  assert.throws(() => publishedName('lit', 'x'));
});

test('@augur dependencies become aliases; others are left alone', () => {
  assert.deepEqual(aliasDependencies({ '@augur/records': '^0.1.0', lit: '^3.3.0' }, 'acme'), {
    '@augur/records': 'npm:@acme/augur-records@^0.1.0',
    lit: '^3.3.0',
  });
  assert.deepEqual(aliasDependencies({ '@augur/records': 'npm:@acme/augur-records@^0.1.0' }, 'acme'), {
    '@augur/records': 'npm:@acme/augur-records@^0.1.0',
  });
});

test('the published manifest drops private, scripts and dev dependencies, and names the repository', () => {
  const out = publishedManifest(
    { name: '@augur/ui-kit', version: '1.8.0', private: true, scripts: { build: 'x' }, devDependencies: { vite: '1' }, dependencies: { lit: '^3' }, files: ['dist'], __directory: 'platform/packages/ui-kit' },
    { scope: 'acme', repository: 'acme/augur' },
  );
  assert.equal(out.name, '@acme/augur-ui-kit');
  assert.equal(out.private, undefined);
  assert.equal(out.scripts, undefined);
  assert.equal(out.devDependencies, undefined);
  assert.equal(out.__directory, undefined);
  assert.deepEqual(out.dependencies, { lit: '^3' });
  assert.deepEqual(out.repository, { type: 'git', url: 'git+https://github.com/acme/augur.git', directory: 'platform/packages/ui-kit' });
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
  for (const name of ['@augur/mfe-sdk', '@augur/records', '@augur/service-kit', '@augur/ui-kit']) assert.ok(names.includes(name), name);
});

test('stylesheet exports are left out of the type check', () => {
  assert.deepEqual(cssEntrypoints({ exports: { '.': './dist/index.js', './tokens.css': './dist/tokens.css' } }), ['./tokens.css']);
  assert.deepEqual(cssEntrypoints({ main: 'x.js' }), []);
});
