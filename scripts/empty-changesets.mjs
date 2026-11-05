#!/usr/bin/env node
// An empty changeset (`pnpm changeset --empty`) bumps nothing, so it must not hold back a release
// (PER-277). changesets/action counts it as waiting, though, and then neither opens a Version
// packages PR (there is nothing to version) nor lets the release steps run. Run before that action
// in the Release workflow: when every waiting changeset is empty, it sets them aside for this run,
// so the release goes ahead. They stay on the branch and the next Version packages PR consumes them.
//
// node scripts/empty-changesets.mjs [dir]   (default .changeset)
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Whether a changeset's text names no package: its front matter holds nothing between the two `---` lines. */
export function isEmptyChangeset(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return false;
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end < 0) return false;
  return lines.slice(1, end).every((line) => line.trim() === '' || line.trim().startsWith('#'));
}

/** The waiting changesets in `dir`, as file names, and which of them are empty. */
export function waiting(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort();
  return files.map((file) => ({ file, empty: isEmptyChangeset(readFileSync(join(dir, file), 'utf8')) }));
}

/** Sets the changesets aside when all of them are empty; returns the ones it set aside. */
export function setAsideIfAllEmpty(dir) {
  const all = waiting(dir);
  if (all.length === 0 || all.some((c) => !c.empty)) return [];
  for (const { file } of all) rmSync(join(dir, file));
  return all.map((c) => c.file);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2] ?? '.changeset';
  const gone = setAsideIfAllEmpty(dir);
  console.log(gone.length ? `Only empty changesets wait, so they don't hold back this release: ${gone.join(', ')}` : 'No changesets to set aside');
}
