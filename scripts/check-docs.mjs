#!/usr/bin/env node
// The repository holds code and the guides that ship with a release, nothing else (AGENTS.md, "Where to look
// first"). Decisions, principles, architecture, plans, reviews and research live in the AUGUR handbook on
// Google Drive. This fails on any Markdown file git tracks outside the list below, so a document can't
// quietly land here. A new shipped guide is added to GUIDES in the same pull request that writes it.
//
// node scripts/check-docs.mjs
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** The guides in docs/ that ship with a release. */
export const GUIDES = [
  'account', 'agents', 'api-contracts', 'app-previews', 'app-storage', 'build-an-app',
  'catalog', 'deploy', 'domain-events', 'inbox', 'jobs', 'licensing', 'mirror', 'notifications',
  'observability', 'people', 'release-channels', 'seed', 'ship-an-app', 'signed-caller', 'upgrade-went-back',
  'upgrade', 'versioning',
].map((name) => `docs/${name}.md`);

/** Markdown that belongs to code, wherever it sits. */
const ALLOWED = [
  /(^|\/)README\.md$/,
  /(^|\/)CHANGELOG\.md$/,
  /^(AGENTS|CLAUDE|THIRD_PARTY_NOTICES)\.md$/,
  /^\.changeset\/[^/]+\.md$/,
  /(^|\/)etc\/[^/]+\.api\.md$/,
];

/** The Markdown files in `paths` that may not be in the repository. */
export const strayDocs = (paths) =>
  paths.filter((p) => p.toLowerCase().endsWith('.md') && !GUIDES.includes(p) && !ALLOWED.some((re) => re.test(p)));

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const stray = strayDocs(tracked);
  if (stray.length) {
    for (const p of stray) console.error(`✗ ${p}: documents live in the AUGUR handbook on Google Drive, not in the repository.`);
    console.error('A guide that ships with a release goes in docs/ and in GUIDES (scripts/check-docs.mjs); anything else goes to the handbook.');
    process.exit(1);
  }
  console.log(`✓ Only shipped guides and code's own Markdown are in the repository (${GUIDES.length} guides).`);
}
