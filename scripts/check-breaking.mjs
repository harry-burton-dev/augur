#!/usr/bin/env node
// Whether a pull request breaks an API contract's callers (ADR 0055, ADR 0080): each contracts/*.openapi.yaml it
// changes, against the same file where it left its base branch, as oasdiff judges a break (its ERR level).
//
// Within a major a contract only adds, so a break fails the check, unless:
//   - info.version's major went up (the break is served under the new major, beside the old one), or
//   - a pending changeset has a line starting "Not breaking:" that names the file and says why (a response
//     documented as what the service always sent, say).
//
// BASE_REF=main node scripts/check-breaking.mjs   Needs Docker: oasdiff runs from its image, pinned by digest.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
/** oasdiff 1.34.1 (ADR 0080). */
export const OASDIFF = 'tufin/oasdiff:v1.34.1@sha256:67a23cfea7d251e2ae34ee703ac8733c5d96bc2e7b90fd0f4d475ec99367b85f';

/** The major of a contract's info.version, or undefined. */
export const majorOf = (yaml) => {
  const m = /^(\d+)\./.exec(String(parse(yaml)?.info?.version ?? ''));
  return m ? Number(m[1]) : undefined;
};

/** Whether a pending changeset says, for this contract file, that what oasdiff calls breaking isn't. */
export const saysNotBreaking = (changesets, file) =>
  changesets.some((text) => text.split('\n').some((line) => line.startsWith('Not breaking:') && line.includes(file)));

/** What to do with a changed contract: skip it, or check it and how a break may be allowed. */
export const verdict = ({ base, head, file, changesets }) => {
  if (base == null) return { check: false, why: 'new' };
  if (base === head) return { check: false, why: 'unchanged' };
  const [was, is] = [majorOf(base), majorOf(head)];
  if (was !== undefined && is !== undefined && is > was) return { check: false, why: `a new major (${was} to ${is})` };
  return { check: true, allowed: saysNotBreaking(changesets, file) };
};

const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });

function main() {
  const baseRef = process.env.BASE_REF;
  if (!baseRef) {
    console.log('No BASE_REF: nothing to compare with.');
    return;
  }
  const changed = git('diff', '--name-only', `origin/${baseRef}...HEAD`, '--', 'contracts/*.openapi.yaml').split('\n').filter(Boolean);
  if (!changed.length) {
    console.log('No contract changed.');
    return;
  }
  const dir = join(root, '.changeset');
  const changesets = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => readFileSync(join(dir, f), 'utf8'));
  const tmp = mkdtempSync(join(tmpdir(), 'oasdiff-'));
  const mergeBase = git('merge-base', `origin/${baseRef}`, 'HEAD').trim();
  const failed = [];
  for (const path of changed) {
    const file = path.split('/').pop();
    let base = null;
    try {
      base = git('show', `${mergeBase}:${path}`);
    } catch {
      // New in this pull request: nothing to break.
    }
    if (!existsSync(join(root, path))) {
      failed.push(`${path} was removed: a contract stays until its service does, and then a major says so.`);
      continue;
    }
    const head = readFileSync(join(root, path), 'utf8');
    const v = verdict({ base, head, file, changesets });
    if (!v.check) {
      console.log(`${path}: ${v.why}, not compared.`);
      continue;
    }
    writeFileSync(join(tmp, 'base.yaml'), base);
    writeFileSync(join(tmp, 'head.yaml'), head);
    const format = process.env.GITHUB_ACTIONS ? ['-f', 'githubactions'] : [];
    try {
      const out = execFileSync('docker', ['run', '--rm', '-v', `${tmp}:/specs:ro`, OASDIFF, 'breaking', '/specs/base.yaml', '/specs/head.yaml', '--fail-on', 'ERR', ...format], { stdio: 'pipe', encoding: 'utf8' });
      console.log(`${path}: nothing breaks.\n${out}`);
    } catch (err) {
      const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      if (err.status !== 1) throw new Error(`oasdiff didn't run on ${path}:\n${out || err.message}`, { cause: err });
      console.log(out);
      if (v.allowed) console.log(`${path}: oasdiff calls this breaking; a changeset says why it isn't.`);
      else failed.push(`${path} breaks its callers within major ${majorOf(head)}. Serve the change under a new major, or, if no caller can break, add a line "Not breaking: ${file} <why>" to the changeset.`);
    }
  }
  if (failed.length) {
    console.error(`Contract check failed:\n${failed.map((f) => `  ${f}`).join('\n')}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
