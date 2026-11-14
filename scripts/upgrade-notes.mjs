#!/usr/bin/env node
// The upgrade notes (the docs site's Release notes → Upgrade notes page) each name the release they came in, so an
// admin can tell which apply to their server (the design lab's writing run found 3 of 37 did). A note's
// first line is `**From** augur@<version>`, or `**From** unreleased` until the Version packages pull
// request writes its release in (scripts/augur-release.mjs version calls stamp).
//
//   node scripts/upgrade-notes.mjs check         every note names a release no newer than the current one
//   node scripts/upgrade-notes.mjs stamp <ver>   `unreleased` becomes augur@<ver>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const NOTES_FILE = 'docs/src/content/docs/release-notes/upgrade-notes.md';
const FROM = /^\*\*From\*\* (unreleased|augur@(\d+\.\d+\.\d+))(?:\s|$)/;

/** Each note's heading (each `## ` on the page is one), the line it's on, and what its From line says (undefined when it has none). */
export function notesOf(markdown) {
  const lines = markdown.split('\n');
  const notes = [];
  let fence; // the open code block's marker, ``` or ~~~
  for (let i = 0; i < lines.length; i++) {
    const marker = /^\s*(```|~~~)/.exec(lines[i])?.[1];
    if (marker) fence = fence === undefined ? marker : fence === marker ? undefined : fence;
    if (fence || !lines[i].startsWith('## ')) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    const m = FROM.exec(lines[j] ?? '');
    notes.push({ heading: lines[i].slice(3), line: i + 1, from: m ? m[1] : undefined, version: m?.[2] });
  }
  return notes;
}

const parts = (v) => v.split('.').map(Number);
const newer = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

/** What's wrong with the notes, as sentences; empty when every note names a release no newer than `current`. */
export function problems(markdown, current) {
  const notes = notesOf(markdown);
  if (!notes.length) return [`${NOTES_FILE} has no notes: each is a \`## \` heading with a **From** line under it.`];
  return notes.flatMap((n) => {
    if (!n.from) return [`${NOTES_FILE}:${n.line} "${n.heading}" doesn't say which release it came in: its first line should be **From** unreleased (a new note) or **From** augur@<version>.`];
    if (n.version && current && newer(n.version, current)) return [`${NOTES_FILE}:${n.line} "${n.heading}" says it came in augur@${n.version}, after the current release ${current}: a new note says **From** unreleased.`];
    return [];
  });
}

/** The notes with each `**From** unreleased` written as the release that carries them. */
export const stamp = (markdown, version) => markdown.replace(/^\*\*From\*\* unreleased(?=\s|$)/gm, `**From** augur@${version}`);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode = 'check', version] = process.argv.slice(2);
  const path = `${root}${NOTES_FILE}`;
  const text = readFileSync(path, 'utf8');
  if (mode === 'stamp') {
    if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('Usage: node scripts/upgrade-notes.mjs stamp <version>');
    writeFileSync(path, stamp(text, version));
  } else {
    const current = JSON.parse(readFileSync(`${root}release/augur-release.json`, 'utf8')).version;
    const found = problems(text, current);
    for (const p of found) console.error(`✗ ${p}`);
    if (found.length) process.exit(1);
    console.log(`check:upgrade-notes: ${notesOf(text).length} notes, each naming its release.`);
  }
}
