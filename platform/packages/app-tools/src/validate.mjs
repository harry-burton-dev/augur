// Checks an app's files against contract 3 (ADR 0075): the manifest, each part's Score workload and the
// release file, with the JSON Schemas this package ships. The registry checks the same schemas on a
// release it is given, so an app that passes `augur-app validate` installs.
//
// The schemas are JSON Schema 2020-12 as the contract publishes them; TypeBox compiles them as they are
// (the same validator the registry already uses), so the published file and the check are one thing.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Compile } from 'typebox/compile';
import YAML from 'yaml';

const require = createRequire(import.meta.url);

/** The manifest schema for contract 3, as the manifest's `$schema` names it. */
export const MANIFEST_3_SCHEMA_ID = 'urn:augur:app-manifest:3';
/** AUGUR's rules for a part's Score workload (resource types v1). */
export const SCORE_PART_SCHEMA_ID = 'urn:augur:score-part:1';
/** The release file, v2. */
export const APP_RELEASE_2_SCHEMA_ID = 'urn:augur:app-release:2';
/** The contract major these schemas describe (spec 11.1). */
export const CONTRACT_MAJOR = 3;

/** The schemas as published, by id. */
export const schemas = {
  [MANIFEST_3_SCHEMA_ID]: require('../manifest-3.schema.json'),
  [SCORE_PART_SCHEMA_ID]: require('../score-part-1.schema.json'),
  [APP_RELEASE_2_SCHEMA_ID]: require('../app-release-2.schema.json'),
};
/**
 * Score's own workload schema (score.dev/v1b1), copied from github.com/score-spec/schema on 8 Nov 2026.
 * Score's schema is the floor and AUGUR's part schema the ceiling: a part must pass both (spec 4.1).
 */
export const scoreSchema = require('../score-v1b1.json');

/** One reason a document was refused: where, and what the schema wanted. */
const problem = (e) => `${e.instancePath || '/'} ${e.message}`;

const compiled = (schema) => {
  const check = Compile(schemas, schema);
  return (doc) => {
    if (check.Check(doc)) return [];
    const seen = new Set();
    return [...check.Errors(doc)].map(problem).filter((p) => !seen.has(p) && seen.add(p));
  };
};

let validators;
/**
 * The three checks, each returning the problems found (none for a valid document):
 * `manifest(doc)`, `part(doc)` (AUGUR's rules; `scorePart(doc)` is Score's own schema) and `release(doc)`.
 */
export const contractValidators = () =>
  (validators ??= {
    manifest: compiled(schemas[MANIFEST_3_SCHEMA_ID]),
    part: compiled(schemas[SCORE_PART_SCHEMA_ID]),
    scorePart: compiled(scoreSchema),
    release: compiled(schemas[APP_RELEASE_2_SCHEMA_ID]),
  });

/** A Score workload, from its YAML text. */
export const parseWorkload = (text) => YAML.parse(text);

/** The problems with a part, Score's first (prefixed `Score:`), then AUGUR's (prefixed `AUGUR:`). */
export const partProblems = (workload) => {
  const v = contractValidators();
  return [...v.scorePart(workload).map((p) => `Score: ${p}`), ...v.part(workload).map((p) => `AUGUR: ${p}`)];
};

/**
 * Checks an app's checkout: `manifest.json` and `score/*.score.yaml`. Returns `{ ok, problems }`, where each
 * problem names the file. The rules a schema can't say (a part's image by digest, the parts a release
 * names) are the release writer's (release2.mjs) and the registry's.
 */
export const validateApp = ({ manifest, parts }) => {
  const v = contractValidators();
  const problems = [];
  for (const p of v.manifest(manifest)) problems.push(`manifest.json: ${p}`);
  for (const [file, workload] of Object.entries(parts)) for (const p of partProblems(workload)) problems.push(`${file}: ${p}`);
  if (manifest?.contract !== undefined && manifest.contract !== CONTRACT_MAJOR) problems.push(`manifest.json: contract ${manifest.contract} is not the contract this AUGUR builds for (${CONTRACT_MAJOR}).`);
  return { ok: problems.length === 0, problems };
};

/** Reads an app's checkout from disk for `validateApp`: the manifest and every `score/*.score.yaml`. */
export const readApp = (root, { readdirSync, existsSync, join }) => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const dir = join(root, 'score');
  const parts = {};
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).sort()) if (f.endsWith('.score.yaml') || f.endsWith('.score.yml')) parts[`score/${f}`] = parseWorkload(readFileSync(join(dir, f), 'utf8'));
  }
  return { manifest, parts };
};
