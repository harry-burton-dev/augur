import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attributionProblems, check, commitsFrom } from './check-attribution.mjs';

describe('attribution', () => {
  it('finds trailers, session links and generated-with lines', () => {
    assert.equal(attributionProblems('Fix it\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>').length, 1);
    assert.equal(attributionProblems('Fix it\n\nco-authored-by: Someone <noreply@anthropic.com>').length, 1);
    assert.equal(attributionProblems('Claude-Session: https://claude.ai/code/session_abc').length, 2);
    assert.equal(attributionProblems('See https://claude.ai/code/session_abc').length, 1);
    assert.equal(attributionProblems('Generated with Claude Code').length, 1);
  });

  it('leaves everything else alone', () => {
    assert.deepEqual(attributionProblems('Fix the claude/ branch name in the docs'), []);
    assert.deepEqual(attributionProblems('Co-authored-by: Harry Burton <harry@example.org>'), []);
    assert.deepEqual(attributionProblems('Co-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>'), []);
    assert.deepEqual(attributionProblems(''), []);
    assert.deepEqual(attributionProblems(undefined), []);
  });

  it('reads commits from git log output', () => {
    assert.deepEqual(commitsFrom('abc123\x00First\n\nBody\n\x01\ndef456\x00Second\n\x01\n'), [
      { sha: 'abc123', message: 'First\n\nBody' },
      { sha: 'def456', message: 'Second' },
    ]);
    assert.deepEqual(commitsFrom(''), []);
  });

  it('says where each problem is and how to put it right', () => {
    const problems = check({ body: 'https://claude.ai/code/session_abc', commits: [{ sha: 'abc123', message: 'Fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }, { sha: 'def456', message: 'Clean' }] });
    assert.equal(problems.length, 2);
    assert.match(problems[0], /^The pull request's description has a link.*Edit it out/);
    assert.match(problems[1], /^Commit abc123 has a Co-Authored-By trailer.*Reword/);
    assert.deepEqual(check({ body: 'Clean', commits: [] }), []);
  });
});
