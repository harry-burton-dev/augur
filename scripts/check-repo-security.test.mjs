import assert from 'node:assert/strict';
import { test } from 'node:test';
import { injectableRuns, postgresMajor, unpinnedActions } from './check-repo-security.mjs';

test('only actions pinned to a full SHA pass', () => {
  const text = [
    '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
    '      - uses: actions/upload-artifact@v4',
    '        uses: ./.github/workflows/deploy-test.yml',
    "    uses: 'owner/repo/.github/workflows/x.yml@main'",
  ].join('\n');
  assert.deepEqual(unpinnedActions(text), ['2: - uses: actions/upload-artifact@v4', "4: uses: 'owner/repo/.github/workflows/x.yml@main'"]);
});

test('untrusted text in a script is caught; through env it is fine', () => {
  const workflow = {
    jobs: {
      a: {
        steps: [
          { name: 'bad', run: 'echo "${{ github.event.pull_request.title }}"' },
          { name: 'also bad', run: 'git checkout ${{ github.head_ref }}' },
          { name: 'fine', run: 'echo "$TITLE"', env: { TITLE: '${{ github.event.pull_request.title }}' } },
          { name: 'fine too', run: 'echo ${{ github.sha }}' },
        ],
      },
    },
  };
  assert.deepEqual(injectableRuns(workflow), ['a / bad', 'a / also bad']);
});

test('reads the Postgres major from the images AUGUR uses', () => {
  assert.equal(postgresMajor('postgres:16-alpine'), 16);
  assert.equal(postgresMajor('pgvector/pgvector:0.8.0-pg16'), 16);
  assert.equal(postgresMajor('pgvector/pgvector:0.8.0-pg17'), 17);
});
