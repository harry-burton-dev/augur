#!/usr/bin/env node
// The repository's own security rules, checked in CI (alpha W4.5, PER-287). What GitHub's settings
// can't hold lives here, so a pull request can't quietly undo it:
//   - every action a workflow uses is pinned to a full commit SHA (PER-208), with its version in a comment;
//   - every workflow says what its token may do (a top-level `permissions:`);
//   - no `run:` script expands text someone else wrote (a branch name, a title, a comment) straight
//     into the shell: pass it through `env:` instead;
//   - CI tests on the Postgres major that servers run (PER-219), so a feature of a newer major can't
//     pass CI and fail on a server.
// The rulesets on main and release/** are GitHub settings, not files: CI/CD in the AUGUR handbook, 03 Architecture/Engineering lists them.
//
// node scripts/check-repo-security.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const WORKFLOWS = '.github/workflows';

/** `uses:` lines that name a remote action or reusable workflow not pinned to a 40-character SHA, as `line: text`. */
export const unpinnedActions = (text) =>
  text
    .split('\n')
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => {
      const m = /^\s*(?:-\s*)?uses:\s*['"]?([^'"\s#]+)/.exec(line);
      if (!m) return false;
      const target = m[1];
      if (target.startsWith('./') || target.startsWith('docker://')) return false;
      return !/@[0-9a-f]{40}$/.test(target);
    })
    .map(([n, line]) => `${n}: ${line.trim()}`);

/** Context values anyone who opens a pull request, an issue or a comment can choose the text of. */
const UNTRUSTED = /\$\{\{\s*github\.(head_ref|event\.(pull_request|issue|comment|review|review_comment|discussion|head_commit|commits|pages|workflow_run)\b[^}]*|event\.inputs\.[^}]*)\s*\}\}/;

/** Steps whose `run:` expands untrusted text into the script, as `job / step`. */
export const injectableRuns = (workflow) => {
  const found = [];
  for (const [id, job] of Object.entries(workflow?.jobs ?? {})) {
    for (const [i, step] of (job?.steps ?? []).entries()) {
      if (typeof step?.run === 'string' && UNTRUSTED.test(step.run)) found.push(`${id} / ${step.name ?? `step ${i + 1}`}`);
    }
  }
  return found;
};

/** The Postgres major an image runs, from tags such as postgres:16-alpine or pgvector/pgvector:0.8.0-pg16. */
export const postgresMajor = (image) => {
  const pg = /-pg(\d+)\b/.exec(image) ?? /(?:^|\/)postgres:(\d+)/.exec(image);
  return pg ? Number(pg[1]) : undefined;
};

/** Every image a compose file or workflow names that is Postgres, with its major. */
const postgresImages = (text) =>
  [...text.matchAll(/image:\s*['"]?([^\s'"]+)/g)].map((m) => m[1]).filter((i) => /postgres|pgvector/.test(i)).map((image) => ({ image, major: postgresMajor(image) }));

export const check = () => {
  const problems = [];
  const files = readdirSync(join(root, WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f));
  for (const file of files) {
    const path = `${WORKFLOWS}/${file}`;
    const text = readFileSync(join(root, path), 'utf8');
    for (const line of unpinnedActions(text)) problems.push(`${path}:${line} is not pinned to a commit SHA. Pin it: uses: owner/action@<sha> # vX.Y.Z`);
    const workflow = parse(text);
    if (!workflow || !('permissions' in workflow)) problems.push(`${path} doesn't say what its token may do. Add a top-level permissions: block (contents: read at least).`);
    for (const step of injectableRuns(workflow)) problems.push(`${path}: ${step} expands text someone else wrote into its script. Pass it through env: and use "$NAME".`);
  }

  const deploy = postgresImages(readFileSync(join(root, 'infra/deploy/compose.yml'), 'utf8'));
  const servers = new Set(deploy.map((d) => d.major));
  if (servers.size !== 1) problems.push(`infra/deploy/compose.yml runs more than one Postgres major (${[...servers].join(', ')}).`);
  const [server] = servers;
  const ci = postgresImages(readFileSync(join(root, WORKFLOWS, 'ci.yml'), 'utf8'));
  for (const { image, major } of ci) {
    if (major !== server) problems.push(`.github/workflows/ci.yml tests on ${image}, but servers run Postgres ${server} (infra/deploy/compose.yml). Test on the major servers run.`);
  }
  return problems;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const problems = check();
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length) process.exit(1);
  console.log('Workflows pinned and scoped, no untrusted text in scripts, CI on the servers’ Postgres major.');
}
