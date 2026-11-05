import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strayDocs } from './check-docs.mjs';

test('lets through shipped guides and the Markdown that belongs to code', () => {
  const ok = [
    'docs/deploy.md', 'README.md', 'apps/README.md', 'platform/services/events/CHANGELOG.md', 'AGENTS.md', 'CLAUDE.md',
    'THIRD_PARTY_NOTICES.md', '.changeset/quiet-owls-sing.md', 'platform/packages/mfe-sdk/etc/mfe-sdk.api.md',
  ];
  assert.deepEqual(strayDocs(ok), []);
});

test('catches documents: decisions, plans and guides nobody listed', () => {
  const bad = ['docs/decisions/0072-something.md', 'docs/plan.md', 'platform/services/events/NOTES.md', 'design/review.MD'];
  assert.deepEqual(strayDocs(bad), bad);
});

test('ignores files that are not Markdown', () => {
  assert.deepEqual(strayDocs(['docs/images/folio/home.webp', 'mkdocs.yml']), []);
});
