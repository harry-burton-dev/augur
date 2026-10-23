// Registers an app that has no service of its own (a frontend-only app) by putting its manifest.json to
// the registry signed in as that app, with the secret an admin issued for it (see docs/build-an-app.md).
//   SERVICE_CLIENT_SECRET=... [REGISTRY_URL=http://localhost:8082] node scripts/register-app.mjs apps/<app>/manifest.json
import { readFileSync } from 'node:fs';

const { REGISTRY_URL = 'http://localhost:8082', SERVICE_CLIENT_SECRET, OIDC_TOKEN_URL = 'http://localhost:8180/realms/platform/protocol/openid-connect/token' } = process.env;
const [file] = process.argv.slice(2);
if (!SERVICE_CLIENT_SECRET || !file) {
  console.error('Usage: SERVICE_CLIENT_SECRET=... [REGISTRY_URL=...] [OIDC_TOKEN_URL=...] node scripts/register-app.mjs <manifest.json>');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(file, 'utf8'));
const signIn = await fetch(OIDC_TOKEN_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: `app-${manifest.id}`, client_secret: SERVICE_CLIENT_SECRET }),
}).catch((err) => ({ ok: false, status: 0, statusText: err.message }));
if (!signIn.ok) {
  console.error(`${manifest.id} not registered: it could not sign in as app-${manifest.id} (${signIn.status || signIn.statusText}).`);
  process.exit(1);
}
const { access_token: token } = await signIn.json();
const res = await fetch(`${REGISTRY_URL.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(manifest.id)}`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(manifest),
}).catch((err) => ({ ok: false, status: 0, json: async () => ({ message: err.message }) }));
const body = await res.json().catch(() => ({}));
if (res.ok) console.log(`${manifest.id} ${res.status === 201 ? 'registered' : 'updated'} (${manifest.version})`);
else {
  console.error(`${manifest.id} not registered: ${res.status || 'unreachable'} ${body.message ?? ''}`);
  process.exit(1);
}
