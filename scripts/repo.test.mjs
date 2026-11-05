import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUGUR_HOME, repoFrom } from './repo.mjs';

test('the scripts work on AUGUR_REPO, else the workflow’s repository, else AUGUR’s home', () => {
  assert.equal(repoFrom({ AUGUR_REPO: 'org/fork', GITHUB_REPOSITORY: 'org/other' }), 'org/fork');
  assert.equal(repoFrom({ GITHUB_REPOSITORY: 'org/other' }), 'org/other');
  assert.equal(repoFrom({}), AUGUR_HOME);
});
