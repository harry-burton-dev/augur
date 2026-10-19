// Registers apps that have no service of their own (frontend-only apps) by putting their manifest.json to the registry as a service would.
//   REGISTRY_URL=http://localhost:8082 SERVICE_TOKEN=... node scripts/register-app.mjs apps/<app>/manifest.json [...]
import { readFileSync } from 'node:fs';

const { REGISTRY_URL = 'http://localhost:8082', SERVICE_TOKEN } = process.env;
const files = process.argv.slice(2);
if (!SERVICE_TOKEN || !files.length) {
  console.error('Usage: SERVICE_TOKEN=... [REGISTRY_URL=...] node scripts/register-app.mjs <manifest.json> [...]');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const res = await fetch(`${REGISTRY_URL.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(manifest.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-service-token': SERVICE_TOKEN, 'x-service-name': 'register-app' },
    body: JSON.stringify(manifest),
  }).catch((err) => ({ ok: false, status: 0, json: async () => ({ message: err.message }) }));
  const body = await res.json().catch(() => ({}));
  if (res.ok) console.log(`${manifest.id} ${res.status === 201 ? 'registered' : 'updated'} (${manifest.version})`);
  else {
    failed = true;
    console.error(`${manifest.id} not registered: ${res.status || 'unreachable'} ${body.message ?? ''}`);
  }
}
process.exit(failed ? 1 : 0);
