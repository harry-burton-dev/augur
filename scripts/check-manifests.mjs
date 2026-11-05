// Checks app manifests the way the registry will when the app registers: first against the published
// JSON Schema (contracts/manifest.schema.json, with Ajv), then against the registry's own rules, called
// directly: no registry, store or database. Also fails when the published schema is out of step.
//   pnpm check:manifest                                   every apps/<id>/manifest.json
//   node scripts/check-manifests.mjs path/to/manifest.json ...   just these files (an app in its own repository)
// Run it after pnpm build: it uses the registry's build.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020Module from 'ajv/dist/2020.js';
import { manifestSchemaText, SCHEMA_FILES } from './manifest.schema.mjs';

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const root = fileURLToPath(new URL('..', import.meta.url));
process.env.NODE_ENV = 'test';
const built = join(root, 'platform/services/registry/dist/manifest.js');
if (!existsSync(built)) {
  console.error('✗ The registry is not built yet. Run: pnpm build');
  process.exit(1);
}

const problems = [];

// Both published copies must be what the registry's schema generates.
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
// The schema the registry generates, so a manifest is checked against today's registry even while the
// published copy is out of step (that is reported above).
const validate = ajv.compile(JSON.parse(expected));

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

// The registry's own rules, as its PUT /apps/:id applies them after the schema. Every app is checked against the ones before it, so two asking for one route are caught.
const { menuWarnings, versionProblem, surfaceProblem, settingsProblem, entryOriginProblem, conflictFor } = await import(pathToFileURL(built).href);
const accepted = [];

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
  if (!validate(manifest)) {
    for (const e of validate.errors) problems.push(`${file}: ${describeError(e)}.`);
    continue;
  }
  for (const w of menuWarnings(manifest)) console.warn(`! ${file}: ${w}`);
  // An entry at a full address needs an origin an admin allowed; a fresh registry has none.
  const refused = versionProblem(manifest) ?? surfaceProblem(manifest) ?? settingsProblem(manifest) ?? entryOriginProblem(manifest, []) ?? conflictFor(manifest, accepted);
  if (refused) problems.push(`${file}: the registry would refuse it: ${refused}`);
  else accepted.push(manifest);
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`${checked} app manifest${checked === 1 ? '' : 's'} would be accepted by the registry.`);
