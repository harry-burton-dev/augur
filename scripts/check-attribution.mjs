#!/usr/bin/env node
// Nothing in the repository names the tool that wrote it (AGENTS.md, Pull requests and releases): no
// assistant trailers on a pull request's commits, and no assistant attribution or links to private
// chats in its description. A squash merge carries the commits' messages onto main, and the history is
// public, so this is checked before the merge, when it can still be put right.
//
// node scripts/check-attribution.mjs    in CI on a pull request (BASE_REF, PR_BODY)
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RULES = [
  [/^co-authored-by:.*(claude|anthropic)/im, 'a Co-Authored-By trailer naming the assistant'],
  [/^claude-session:/im, 'a session trailer'],
  [/\bclaude\.ai\/(code|chat|share|artifact)\b/i, 'a link to a private chat or artifact'],
  [/generated (with|by) .*claude/i, 'a line saying the assistant wrote it'],
];

/** What `text` carries that it shouldn't, in words. */
export const attributionProblems = (text) => RULES.filter(([rule]) => rule.test(text ?? '')).map(([, what]) => what);

/** Each commit's short id and message, from `git log` output with the two separators below. */
export const commitsFrom = (log) =>
  log
    .split('\x01')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, ...message] = entry.split('\x00');
      return { sha, message: message.join('') };
    });

/** Every problem in a pull request's description and commits, as a line to print. */
export const check = ({ body, commits }) => [
  ...attributionProblems(body).map((what) => `The pull request's description has ${what}. Edit it out: this check runs again by itself.`),
  ...commits.flatMap(({ sha, message }) => attributionProblems(message).map((what) => `Commit ${sha} has ${what}. Reword the commit and push the branch again.`)),
];

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const log = execFileSync('git', ['log', '--format=%h%x00%B%x01', `origin/${process.env.BASE_REF}..HEAD`], { encoding: 'utf8' });
  const problems = check({ body: process.env.PR_BODY, commits: commitsFrom(log) });
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length) process.exit(1);
  console.log('Nothing in this pull request names the tool that wrote it.');
}
