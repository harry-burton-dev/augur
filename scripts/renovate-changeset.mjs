#!/usr/bin/env node
// Writes the changeset a Renovate PR needs (ADR 0033): a patch for every workspace package whose
// files the PR changes, or an empty one when it only touches tooling outside them (workflows, the
// root lockfile). Run by .github/workflows/renovate-changeset.yml on renovate/* branches.
//
// node scripts/renovate-changeset.mjs <base-ref> <branch> [title]
// Does nothing when the branch already carries a changeset of its own.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The packages a list of changed files belongs to: each file goes to the deepest package that holds it. */
export function packagesTouched(files, packages) {
  const dirs = packages.filter((p) => p.dir !== '').sort((a, b) => b.dir.length - a.dir.length);
  const names = new Set();
  for (const file of files) {
    const owner = dirs.find((p) => file.startsWith(`${p.dir}/`));
    if (owner) names.add(owner.name);
  }
  return [...names].sort();
}

/** The changeset file's text: a patch for each package, or an empty changeset. */
export function changesetText(names, summary) {
  const front = names.map((n) => `'${n}': patch`).join('\n');
  return `---\n${front}${front ? '\n' : ''}---\n\n${summary}\n`;
}

/** A file name from the branch: renovate/npm-minor-patch → renovate-npm-minor-patch. */
export const changesetFile = (branch) => `.changeset/${branch.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '')}.md`;

function main() {
  const [base, branch, title] = process.argv.slice(2);
  if (!base || !branch) throw new Error('usage: renovate-changeset.mjs <base-ref> <branch> [title]');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  const files = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  if (files.some((f) => /^\.changeset\/(?!README\.md$|config\.json$)[^/]+\.md$/.test(f))) {
    console.log('The branch already has a changeset');
    return;
  }
  const root = git('rev-parse', '--show-toplevel').trim();
  const packages = JSON.parse(execFileSync('pnpm', ['ls', '-r', '--depth', '-1', '--json'], { encoding: 'utf8' })).map((p) => ({
    name: p.name,
    dir: p.path === root ? '' : p.path.slice(root.length + 1),
  }));
  const names = packagesTouched(files, packages);
  const file = changesetFile(branch);
  writeFileSync(file, changesetText(names, title ? `Dependency updates: ${title}` : 'Dependency updates.'));
  console.log(`Wrote ${file}: ${names.length ? names.join(', ') : 'empty (no package changed)'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
