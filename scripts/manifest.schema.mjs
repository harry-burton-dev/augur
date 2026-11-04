// The app manifest's JSON Schema, published for app repositories and editors (ADR 0055). It is the
// registry's own appEntrySchema (TypeBox, platform/services/registry/src/manifest.ts), so a manifest
// that passes it has the fields and limits the registry accepts. The registry's other rules (a semver
// version, a free route, surfaces on the app's floors) are checked by pnpm check:manifest.
//   pnpm manifest-schema     write contracts/manifest.schema.json (after pnpm build: it uses the registry's build)
// scripts/check-manifests.mjs fails when the file is out of step.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
export const SCHEMA_FILE = 'contracts/manifest.schema.json';
/** Not an address: the repository is private, so a manifest points at a copy by path (docs/build-an-app.md). */
export const SCHEMA_ID = 'urn:augur:app-manifest';

/** The schema as published, from the registry's built manifest.js, as text. */
export const manifestSchemaText = async () => {
  const built = join(root, 'platform/services/registry/dist/manifest.js');
  if (!existsSync(built)) throw new Error('The registry is not built yet. Run: pnpm build');
  const { appEntrySchema } = await import(pathToFileURL(built).href);
  // Drop the registry's component name; the published file names itself.
  const { $id: _component, ...shape } = JSON.parse(JSON.stringify(appEntrySchema));
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: SCHEMA_ID,
    title: 'AUGUR app manifest',
    description:
      "An app's manifest.json: what the registry accepts when the app registers (PUT /v1/apps/{id}). Generated from the registry's schema by pnpm manifest-schema; check a manifest with node scripts/check-manifests.mjs <manifest.json>.",
    ...shape,
  };
  return `${JSON.stringify(schema, null, 2)}\n`;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const file = join(root, SCHEMA_FILE);
  let text;
  try {
    text = await manifestSchemaText();
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
  if (existsSync(file) && readFileSync(file, 'utf8') === text) console.log(`${SCHEMA_FILE} is up to date.`);
  else {
    writeFileSync(file, text);
    console.log(`Wrote ${SCHEMA_FILE}`);
  }
}
