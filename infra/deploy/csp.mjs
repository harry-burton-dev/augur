// Fills in the shell's Content Security Policy with the hashes of the inline
// scripts in its built page (the import map), so the browser runs those and
// nothing else inline. Run at image build:
//   node infra/deploy/csp.mjs <site>/index.html infra/deploy/nginx.conf > default.conf.template
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [page, conf] = process.argv.slice(2);
if (!page || !conf) {
  console.error('usage: node csp.mjs <index.html> <nginx.conf>');
  process.exit(2);
}

/** The CSP source for each inline <script> (no src) in the page, by its exact text. */
export const inlineScriptHashes = (html) =>
  [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);

const hashes = inlineScriptHashes(readFileSync(page, 'utf8'));
if (!hashes.length) {
  console.error(`${page} has no inline scripts; expected the import map.`);
  process.exit(1);
}
const template = readFileSync(conf, 'utf8');
if (!template.includes('@SCRIPT_HASHES@')) {
  console.error(`${conf} has no @SCRIPT_HASHES@ to fill in.`);
  process.exit(1);
}
process.stdout.write(template.replaceAll('@SCRIPT_HASHES@', hashes.join(' ')));
