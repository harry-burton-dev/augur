// Checks app manifests the way the registry will when the app registers: first against the published
// JSON Schema (contracts/manifest.schema.json, with Ajv), then against the registry's own rules, on a
// registry running in memory. Also fails when the published schema is out of step with the registry.
//   pnpm check:manifest                                   every apps/<id>/manifest.json
//   node scripts/check-manifests.mjs path/to/manifest.json ...   just these files (an app in its own repository)
// Run it after pnpm build: it uses the registry's build.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020Module from 'ajv/dist/2020.js';
import { manifestSchemaText, SCHEMA_FILE, SCHEMA_FILES } from './manifest.schema.mjs';

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const root = new URL('..', import.meta.url).pathname;
process.env.NODE_ENV = 'test';
const built = join(root, 'platform/services/registry/dist/app.js');
if (!existsSync(built)) {
  console.error('✗ The registry is not built yet. Run: pnpm build');
  process.exit(1);
}

const problems = [];

// Both published copies must be what the registry's schema generates.
const schemaPath = join(root, SCHEMA_FILE);
const published = existsSync(schemaPath) ? readFileSync(schemaPath, 'utf8') : '';
const expected = await manifestSchemaText();
for (const name of SCHEMA_FILES) {
  const path = join(root, name);
  if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) problems.push(`${name} is out of step with the registry's manifest schema. Run: pnpm build && pnpm manifest-schema`);
}

/** Where in a manifest an Ajv error is, in plain words. */
const where = (instancePath) => {
  if (!instancePath) return 'the manifest';
  const parts = instancePath.split('/').slice(1).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  return parts.reduce((out, p) => (/^\d+$/.test(p) ? `${out}[${p}]` : out ? `${out}.${p}` : p), '');
};

/** One Ajv error as a sentence. */
const describeError = (e) => {
  const at = where(e.instancePath);
  switch (e.keyword) {
    case 'additionalProperties':
      return `${at} has "${e.params.additionalProperty}", which isn't a field it can have (misspelt?)`;
    case 'required':
      return `${at} is missing "${e.params.missingProperty}"`;
    case 'enum':
      return `${at} must be one of: ${e.params.allowedValues.join(', ')}`;
    case 'pattern':
      return `${at} doesn't have the form it needs (${e.params.pattern})`;
    case 'type':
      return `${at} must be ${/^[aeiou]/.test(e.params.type) ? 'an' : 'a'} ${e.params.type}`;
    default:
      return `${at} ${e.message}`;
  }
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = published ? ajv.compile(JSON.parse(published)) : undefined;

// The manifests to check: the files named, or every app's in apps/.
const named = process.argv.slice(2);
const files = named.length
  ? named.map((f) => resolve(f))
  : existsSync(join(root, 'apps'))
    ? readdirSync(join(root, 'apps'), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(root, 'apps', d.name, 'manifest.json'))
        .filter((f) => existsSync(f))
    : [];

const { buildApp } = await import(pathToFileURL(built).href);
const { appEntrySchema, menuWarnings } = await import(pathToFileURL(join(root, 'platform/services/registry/dist/manifest.js')).href);
// Each app registers as itself, as its service would once signed in.
const registry = await buildApp({ verifyService: async (headers) => ({ kind: 'app', app: String(headers['x-check-app']) }) });

let checked = 0;
for (const path of files) {
  const file = path.startsWith(root) ? relative(root, path) : path;
  if (!existsSync(path)) {
    problems.push(`${file}: there's no such file`);
    continue;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    problems.push(`${file}: not JSON (${err.message})`);
    continue;
  }
  checked++;
  // An app in this repository lives in apps/<id>/.
  const folder = basename(dirname(path));
  if (dirname(dirname(path)) === join(root, 'apps') && manifest.id !== folder) {
    problems.push(`${file}: id is "${manifest.id}", but the app's folder is apps/${folder}. They must match.`);
  }
  if (validate && !validate(manifest)) {
    for (const e of validate.errors) problems.push(`${file}: ${describeError(e)}.`);
    continue;
  }
  // One registry for every app, so two apps asking for the same route are caught too.
  const res = await registry.inject({
    method: 'PUT',
    url: `/v1/apps/${encodeURIComponent(manifest.id ?? folder)}`,
    headers: { 'x-check-app': manifest.id ?? folder },
    payload: manifest,
  });
  // Accepted all the same, so released apps keep working; see docs/shell-principles.md.
  for (const w of menuWarnings(manifest)) console.warn(`! ${file}: ${w}`);
  if (res.statusCode >= 300) {
    // The registry refuses unknown fields without naming them; name the top-level ones here.
    const unknown = Object.keys(manifest).filter((k) => !(k in appEntrySchema.properties));
    const hint = unknown.length ? ` (unknown: ${unknown.join(', ')})` : '';
    problems.push(`${file}: the registry would refuse it (${res.statusCode}): ${res.json().message}${hint}`);
  }
}
await registry.close();

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`${checked} app manifest${checked === 1 ? '' : 's'} would be accepted by the registry.`);
