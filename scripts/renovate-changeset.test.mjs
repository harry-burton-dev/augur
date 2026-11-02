import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changesetFile, changesetText, packagesTouched } from './renovate-changeset.mjs';

const packages = [
  { name: 'augur', dir: '' },
  { name: '@augur/service-kit', dir: 'platform/packages/service-kit' },
  { name: '@augur/registry', dir: 'platform/services/registry' },
  { name: '@apps/folio', dir: 'apps/folio' },
  { name: '@apps/folio-service', dir: 'apps/folio/service' },
];

test('each changed file goes to the deepest package that holds it; root files to none', () => {
  const files = ['platform/services/registry/package.json', 'apps/folio/service/Dockerfile', 'pnpm-lock.yaml', '.github/workflows/ci.yml'];
  assert.deepEqual(packagesTouched(files, packages), ['@apps/folio-service', '@augur/registry']);
  assert.deepEqual(packagesTouched(['pnpm-lock.yaml'], packages), []);
});

test('writes patches, or an empty changeset, named after the branch', () => {
  assert.equal(changesetText(['@augur/registry'], 'Dependency updates.'), "---\n'@augur/registry': patch\n---\n\nDependency updates.\n");
  assert.equal(changesetText([], 'Dependency updates.'), '---\n---\n\nDependency updates.\n');
  assert.equal(changesetFile('renovate/npm-minor-and-patch-updates'), '.changeset/renovate-npm-minor-and-patch-updates.md');
});
