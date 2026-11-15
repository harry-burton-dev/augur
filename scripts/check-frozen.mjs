#!/usr/bin/env node
// The seams apps depend on, held against a checked-in baseline (release/frozen-seams.json, baselines/).
//
// check-api and check-breaking compare a pull request with the branch it goes into, so each step can be
// allowed and the sum still drifts. This compares with one fixed point: what the seam was when it was
// frozen. A frozen seam may only add. Anything an app could already depend on stays as it was:
//   - an API report (API Extractor) loses no line;
//   - a JSON Schema still accepts every document it accepted;
//   - an OpenAPI contract has no change oasdiff calls breaking (its ERR level);
//   - every published library has an API report, so nothing an app imports goes unwatched.
// A seam marked "open" is reported and never fails. Moving a baseline is `node scripts/check-frozen.mjs
// rebase <seam id>`, and is a decision: it goes with a record, in its own pull request.
//
// node scripts/check-frozen.mjs [check]   Needs the packages built for nothing: it reads committed files only.
//                                         oasdiff runs from its image, so OpenAPI seams need Docker; without
//                                         it they are skipped locally and fail in CI.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OASDIFF } from './check-breaking.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const SEAMS = 'release/frozen-seams.json';
const LIBRARIES = 'platform/packages';

/** The lines of an API report that carry API: no comments, fences or blank lines. */
const apiLines = (report) =>
  report
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('>') && !l.startsWith('##') && l !== '```' && l !== '```ts');

/** What a report took away or changed since its baseline: the baseline's API lines it no longer has. */
export function removedApi(baseline, head) {
  const now = new Set(apiLines(head));
  return apiLines(baseline).filter((l) => !now.has(l));
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The types a schema names, as a set; empty when it names none. */
const typesOf = (s) => new Set([].concat(s.type ?? []));

/**
 * Why a document the baseline schema accepted might be refused by the head schema: one line per narrowing.
 * It walks properties, items, $defs and the allOf/anyOf/oneOf lists by position, and is cautious: a keyword
 * it can't weigh (a changed pattern, a changed if/then) counts as a narrowing.
 */
export function narrowings(base, head, at = '#') {
  if (!isObject(base) || !isObject(head)) return same(base, head) ? [] : [`${at}: changed`];
  const out = [];
  const [was, is] = [typesOf(base), typesOf(head)];
  if (is.size && (!was.size || [...was].some((t) => !is.has(t)))) out.push(`${at}: type no longer allows ${[...was].filter((t) => !is.has(t)).join(', ') || 'what it did'}`);
  for (const r of head.required ?? []) if (!(base.required ?? []).includes(r)) out.push(`${at}: "${r}" is now required`);
  if (base.enum && !head.enum && !('const' in head)) {
    // Widened to anything of the type.
  } else if (head.enum) {
    if (!base.enum) out.push(`${at}: now an enum`);
    else for (const v of base.enum) if (!head.enum.some((h) => same(h, v))) out.push(`${at}: enum lost ${JSON.stringify(v)}`);
  }
  if ('const' in head && !same(base.const, head.const)) out.push(`${at}: const changed`);
  for (const k of ['pattern', 'format']) if (k in head && !same(base[k], head[k])) out.push(`${at}: ${k} changed`);
  for (const k of ['maxLength', 'maxItems', 'maximum', 'exclusiveMaximum', 'maxProperties']) if (k in head && !(k in base && head[k] >= base[k])) out.push(`${at}: ${k} lowered or added`);
  for (const k of ['minLength', 'minItems', 'minimum', 'exclusiveMinimum', 'minProperties']) if (k in head && !(k in base && head[k] <= base[k])) out.push(`${at}: ${k} raised or added`);
  if (head.uniqueItems && !base.uniqueItems) out.push(`${at}: items must now be unique`);
  for (const k of ['if', 'then', 'else', 'not', 'dependentRequired', 'dependentSchemas', 'propertyNames']) if (k in head && !same(base[k], head[k])) out.push(`${at}: ${k} changed`);
  const closed = (s) => s.additionalProperties === false;
  if (closed(head) && !closed(base)) out.push(`${at}: no longer takes other properties`);
  for (const [name, schema] of Object.entries(base.properties ?? {})) {
    if (name in (head.properties ?? {})) out.push(...narrowings(schema, head.properties[name], `${at}/properties/${name}`));
    else if (closed(head)) out.push(`${at}: "${name}" was removed`);
  }
  if ('items' in base || 'items' in head) {
    if ('items' in head && !('items' in base)) out.push(`${at}: items are now constrained`);
    else if ('items' in head) out.push(...narrowings(base.items, head.items, `${at}/items`));
  }
  for (const [name, schema] of Object.entries(base.$defs ?? {})) {
    if (name in (head.$defs ?? {})) out.push(...narrowings(schema, head.$defs[name], `${at}/$defs/${name}`));
    else out.push(`${at}: $defs/${name} was removed`);
  }
  for (const k of ['allOf', 'anyOf', 'oneOf']) {
    if (!(k in base) && !(k in head)) continue;
    const [b, h] = [base[k] ?? [], head[k] ?? []];
    if (k === 'allOf' ? h.length > b.length : h.length < b.length) out.push(`${at}: ${k} ${k === 'allOf' ? 'gained' : 'lost'} a branch`);
    for (let i = 0; i < Math.min(b.length, h.length); i++) out.push(...narrowings(b[i], h[i], `${at}/${k}/${i}`));
  }
  if ('$ref' in head && base.$ref !== head.$ref) out.push(`${at}: $ref changed`);
  return out;
}

/** Published libraries with no API report: a folder under platform/packages with exports and no api-extractor*.json. */
export function unwatchedLibraries(base = root, allowed = []) {
  const dir = join(base, LIBRARIES);
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'package.json')))
    .filter((d) => !readdirSync(join(dir, d.name)).some((f) => /^api-extractor(\.[\w-]+)?\.json$/.test(f)))
    .map((d) => JSON.parse(readFileSync(join(dir, d.name, 'package.json'), 'utf8')).name)
    .filter((name) => !allowed.includes(name));
}

/** What oasdiff calls breaking between two contract files, or undefined when Docker can't run it. */
function oasdiffBreaks(baseFile, headFile) {
  const mount = (f) => ['-v', `${dirname(f)}:/${dirname(f) === dirname(baseFile) && f === baseFile ? 'base' : 'head'}:ro`];
  const args = ['run', '--rm', ...mount(baseFile), ...mount(headFile), OASDIFF, 'breaking', `/base/${baseFile.split(/[\\/]/).pop()}`, `/head/${headFile.split(/[\\/]/).pop()}`, '--fail-on', 'ERR'];
  try {
    execFileSync('docker', args, { stdio: 'pipe', encoding: 'utf8' });
    return [];
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (err.status === 1 && /\d+ changes?: \d+ error/m.test(out)) return out.split('\n').filter((l) => /^error\b/i.test(l.trim()) || /\berror\s+\[/.test(l)).slice(0, 20);
    return undefined;
  }
}

/** A seam's problems: lines saying what broke, or a `skipped` reason. */
export function judge(seam, base = root) {
  const [baseline, head] = [join(base, seam.baseline), join(base, seam.path)];
  if (!existsSync(head)) return { problems: [`${seam.path} is gone`] };
  if (!existsSync(baseline)) return { problems: [`its baseline ${seam.baseline} is missing`] };
  const [was, is] = [readFileSync(baseline, 'utf8').replace(/\r\n/g, '\n'), readFileSync(head, 'utf8').replace(/\r\n/g, '\n')];
  if (was === is) return { problems: [] };
  if (seam.kind === 'api-report') return { problems: removedApi(was, is).map((l) => `removed or changed: ${l}`) };
  if (seam.kind === 'json-schema') return { problems: narrowings(JSON.parse(was), JSON.parse(is)) };
  if (seam.kind === 'openapi') {
    const breaks = oasdiffBreaks(baseline, head);
    if (breaks === undefined) return process.env.CI ? { problems: ['oasdiff did not run (Docker)'] } : { problems: [], skipped: 'oasdiff needs Docker' };
    return { problems: breaks };
  }
  return { problems: [`unknown kind ${seam.kind}`] };
}

function main() {
  const mode = process.argv[2] ?? 'check';
  const config = JSON.parse(readFileSync(join(root, SEAMS), 'utf8'));
  if (mode === 'rebase') {
    const ids = process.argv.slice(3);
    for (const seam of config.seams.filter((s) => !ids.length || ids.includes(s.id))) {
      mkdirSync(dirname(join(root, seam.baseline)), { recursive: true });
      copyFileSync(join(root, seam.path), join(root, seam.baseline));
      console.log(`Baseline moved: ${seam.id}`);
    }
    return;
  }
  const failed = [];
  for (const seam of config.seams) {
    const { problems, skipped } = judge(seam);
    const frozen = seam.status === 'frozen';
    if (skipped) console.log(`- ${seam.id}: skipped, ${skipped}.`);
    else if (!problems.length) console.log(`✓ ${seam.id} (${seam.status})`);
    else if (frozen) failed.push(`${seam.id} is frozen and ${seam.path} no longer holds what it promised:\n${problems.slice(0, 12).map((p) => `      ${p}`).join('\n')}`);
    else console.log(`~ ${seam.id} (${seam.status}): ${problems.length} change${problems.length === 1 ? '' : 's'} an app could feel since its baseline.`);
  }
  const unwatched = unwatchedLibraries(root, (config.unwatchedLibraries ?? []).map((u) => u.name));
  if (unwatched.length) failed.push(`No API report for ${unwatched.join(', ')}: add an api-extractor.json (ADR 0052), or list it under unwatchedLibraries in ${SEAMS} with the reason.`);
  if (failed.length) {
    console.error(`Frozen seams check failed:\n${failed.map((f) => `  ${f}`).join('\n')}\nA frozen seam only adds. Serve the change beside the old shape, or move the baseline with a record: node scripts/check-frozen.mjs rebase <id>.`);
    process.exit(1);
  }
  console.log('Frozen seams hold.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
