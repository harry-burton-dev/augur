import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notesOf, problems, stamp } from './upgrade-notes.mjs';

const doc = (...notes) => `---\ntitle: Upgrade notes\n---\n\nIntro.\n\n${notes.join('\n\n')}\n\n\`\`\`sh\n## not a note, in a code block\n~~~\n## nor this\n\`\`\`\n\n~~~\n## nor this, in a tilde block\n~~~\n`;

test('every note names the release it came in, or unreleased', () => {
  const text = doc('## New\n\n**From** unreleased\n\nDo this.', '## Old\n\n**From** augur@0.15.0 · Check\n\nThat.');
  assert.deepEqual(notesOf(text).map((n) => [n.heading, n.from]), [['New', 'unreleased'], ['Old', 'augur@0.15.0']]);
  assert.deepEqual(problems(text, '0.18.0'), []);
});

test('a note without one, or naming a release still to come, fails', () => {
  const text = doc('## Bare\n\nDo this.', '## Ahead\n\n**From** augur@0.19.0\n\nThat.', '## Loose\n\nFrom augur@0.1.0');
  const found = problems(text, '0.18.0');
  assert.equal(found.length, 3);
  assert.match(found[0], /"Bare" doesn't say which release/);
  assert.match(found[1], /after the current release 0\.18\.0/);
});

test('the release writes itself into each new note', () => {
  const text = doc('## New\n\n**From** unreleased\n\nDo this.', '## Old\n\n**From** augur@0.15.0');
  assert.deepEqual(notesOf(stamp(text, '0.19.0')).map((n) => n.from), ['augur@0.19.0', 'augur@0.15.0']);
});

test('AUGUR’s own notes all name their release', () => {
  const current = JSON.parse(readFileSync(new URL('../release/augur-release.json', import.meta.url), 'utf8')).version;
  assert.deepEqual(problems(readFileSync(new URL('../docs/src/content/docs/release-notes/upgrade-notes.md', import.meta.url), 'utf8'), current), []);
});

test('a page with no notes fails', () => {
  assert.equal(problems('---\ntitle: Upgrade notes\n---\n\nNothing yet.\n', '0.18.0').length, 1);
});
