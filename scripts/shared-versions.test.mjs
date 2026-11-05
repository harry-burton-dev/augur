import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogProblems, catalogUsers, changedCatalogEntries } from './shared-versions.mjs';

test('a dependency two packages name must come from the catalog', () => {
  const problems = catalogProblems(
    {
      'a/package.json': { dependencies: { pg: '^8.0.0', '@augur/sdk': 'workspace:*', '@augur/kit': 'npm:@o/kit@^1.0.0' } },
      'b/package.json': { devDependencies: { pg: '^8.1.0', '@augur/kit': 'npm:@o/kit@^1.0.0' } },
      'c/package.json': { dependencies: { react: '^19.0.0', vite: 'catalog:', jose: 'catalog:' } },
    },
    { react: '^19.0.0', vite: '^7.0.0' },
  );
  assert.deepEqual(problems, [
    "c/package.json: jose asks for catalog:, but pnpm-workspace.yaml's catalog has no jose",
    'a/package.json, b/package.json: pg is named by 2 packages, so put its range in pnpm-workspace.yaml\'s catalog and ask for "catalog:"',
    'c/package.json: react is in the catalog, so ask for "catalog:" instead of a range',
  ]);
});

test('finds the catalog entries a diff of pnpm-workspace.yaml changes, and the packages that use them', () => {
  const diff = [
    '--- a/pnpm-workspace.yaml',
    '+++ b/pnpm-workspace.yaml',
    '@@ -10,6 +10,6 @@ catalog:',
    ' catalog:',
    '-  "@types/node": "^22.0.0"',
    '+  "@types/node": "^22.1.0"',
    '   pg: "^8.23.1"',
    '-  vite: "^7.3.7"',
    '+  vite: "^7.4.0"',
    ' overrides:',
    '-  "a>b": 1.0.0',
    '+  "a>b": 1.0.1',
  ].join('\n');
  assert.deepEqual(changedCatalogEntries(diff), ['@types/node', 'vite']);
  const packages = {
    x: { name: '@augur/x', devDependencies: { vite: 'catalog:' } },
    y: { name: '@augur/y', dependencies: { pg: 'catalog:' } },
    z: { name: '@augur/z', dependencies: { vite: '^7.0.0' } },
  };
  assert.deepEqual(catalogUsers(['vite', '@types/node'], packages), ['@augur/x']);
});
