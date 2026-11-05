import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pinFor, problems, sri } from './kit.mjs';

const files = { 'react.js': Buffer.from('react'), 'app-kit.js': Buffer.from('quill'), 'tokens.css': Buffer.from(':root{}') };
const kit = {
  schema: 'augur.kit/v1',
  version: '0.1.0',
  packages: { react: '19.3.1' },
  imports: { react: 'react.js', 'react-dom': 'react.js', '@augur/kit-common': 'app-kit.js', '@augur/app-kit': 'app-kit.js' },
  integrity: Object.fromEntries(Object.entries(files).map(([f, b]) => [f, sri(b)])),
};
const hash = 'sha384-kitjson';
const shared = ['react', 'react-dom', '@augur/kit-common', '@augur/app-kit'];
const read = (f) => {
  if (!files[f]) throw new Error('missing');
  return files[f];
};

test('a pinned, whole bundle has no problems', () => {
  assert.deepEqual(problems({ kit, hash }, pinFor(kit, hash), shared, read), []);
});

test('a bundle other than the pinned one, or a changed file, is a problem', () => {
  assert.match(problems({ kit, hash }, { ...pinFor(kit, hash), version: '0.0.9' }, shared, read)[0], /names kit 0\.0\.9, but 0\.1\.0 is installed/);
  assert.match(problems({ kit, hash: 'sha384-other' }, pinFor(kit, hash), shared, read)[0], /kit\.json differs/);
  const changed = (f) => (f === 'react.js' ? Buffer.from('not react') : read(f));
  assert.deepEqual(problems({ kit, hash }, pinFor(kit, hash), shared, changed), ["react.js doesn't match its hash in kit.json"]);
});

test('the bundle serves what the SDK promises, and nothing it does not', () => {
  const less = { ...kit, imports: { react: 'react.js', extra: 'react.js' } };
  const found = problems({ kit: less, hash }, pinFor(less, hash), shared, read);
  assert.ok(found.includes("the kit doesn't serve @augur/app-kit"));
  assert.ok(found.includes("the kit serves extra, which the SDK's sharedModules doesn't list"));
});
