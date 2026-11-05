// Writes AUGUR's Backstage catalog from what the repository already says about itself: each
// package.json, each app's manifest.json, the API contracts and the deploy stack. Nobody edits
// catalog/ by hand; CI fails when it's out of date (docs/catalog.md).
//   pnpm catalog           write catalog/ and mkdocs.yml
//   pnpm check:catalog     fail if either is out of date
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse, stringify } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
const REPO = 'harry-burton-dev/augur';
const SOURCE = `https://github.com/${REPO}/tree/main`;
const OWNER = 'group:default/augur-core';
const HEADER = '# Written by `pnpm catalog` from the repository (docs/catalog.md). Don\'t edit it by hand.\n';

const read = (path) => readFileSync(join(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const dirs = (path) =>
  readdirSync(join(root, path), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

/** Backstage names: letters, digits and dashes, at most 63 characters. */
const entityName = (s) => s.replace(/^@/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);
/** 0.x is still settling; 1.0 and later has made its promises. */
const lifecycle = (version) => (version && !version.startsWith('0.') ? 'production' : 'experimental');

// The deploy stack: which parts ship in AUGUR's own release, what each one calls, and what it stands on.
const compose = parse(read('infra/deploy/compose.yml'), { merge: true, maxAliasCount: -1 });
const stack = compose.services ?? {};
const ownImage = (svc) => String(svc.image ?? '').includes('/im-platform}/') || String(svc.image ?? '').includes('PLATFORM_IMAGES');
const shipsWithAugur = new Set(Object.entries(stack).filter(([, s]) => ownImage(s)).map(([name]) => name));

/** The platform APIs a service calls, from the URLs in its environment. */
const API_BY_ENV = { IDENTITY_URL: 'identity-api', REGISTRY_URL: 'registry-api', EVENTS_URL: 'events-api', MODELS_URL: 'models-api', GATEWAY_URL: 'gateway-api' };
const envOf = (svc) => (Array.isArray(svc?.environment) ? Object.fromEntries(svc.environment.map((e) => e.split('='))) : (svc?.environment ?? {}));
const consumedApis = (name) =>
  Object.keys(envOf(stack[name]))
    .filter((k) => API_BY_ENV[k] && API_BY_ENV[k] !== `${name}-api`)
    .map((k) => `api:default/${API_BY_ENV[k]}`)
    .sort();

/** Third-party parts of the stack: what AUGUR runs but doesn't build. */
const RESOURCES = {
  postgres: { type: 'database', description: 'Postgres with pgvector: the platform schema, each app\'s schema and Keycloak\'s' },
  garage: { type: 's3-storage', description: 'Garage, S3-compatible object storage: app buckets, versioned frontends, uploads' },
  keycloak: { type: 'identity-provider', description: 'Keycloak: sign-in for people and services (realm "platform")' },
  tailscale: { type: 'network', description: 'Tailscale sidecar: the way in, on the tailnet, with Funnel for public access' },
  backup: { type: 'job', description: 'Postgres backups the updater takes before every upgrade' },
  'docker-proxy': { type: 'docker-socket', description: 'A narrow Docker socket for the updater and the app runner' },
};
const resourceDeps = (name) => {
  const deps = stack[name]?.depends_on;
  const list = Array.isArray(deps) ? deps : Object.keys(deps ?? {});
  return list.filter((d) => RESOURCES[d]).map((d) => `resource:default/${d}`).sort();
};

/** An app the runner installs has no entry in compose.yml: it registers itself, and calls events for what its scopes allow. */
const EVENTS_SCOPES = ['audit:write', 'notifications:send', 'events:publish', 'events:subscribe'];
const appRunnerApis = (m) => ['api:default/registry-api', ...((m.scopes ?? []).some((s) => EVENTS_SCOPES.includes(s)) ? ['api:default/events-api'] : []), ...((m.scopes ?? []).includes('models:use') ? ['api:default/models-api'] : [])].sort();

const sourceOf = (dir) => ({ 'backstage.io/source-location': `url:${SOURCE}/${dir}/` });
const github = { 'github.com/project-slug': REPO };

function component({ dir, type, system, unit, extra = {}, spec = {} }) {
  const pkg = json(`${dir}/package.json`);
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: entityName(pkg.name),
      title: pkg.name,
      ...(pkg.description ? { description: pkg.description } : {}),
      annotations: { ...github, ...sourceOf(dir), 'augur.dev/package': pkg.name, 'augur.dev/version': pkg.version, 'augur.dev/release-unit': unit, ...extra },
    },
    spec: { type, lifecycle: lifecycle(pkg.version), owner: OWNER, system, ...spec },
  };
}

// ---- AUGUR itself: the platform system, its parts, its APIs and what it stands on.
const platform = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Domain',
    metadata: { name: 'augur', title: 'AUGUR', description: 'The AUGUR product: the platform and the apps that run on it' },
    spec: { owner: OWNER },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Group',
    metadata: { name: 'augur-core', title: 'AUGUR core', description: 'Builds and runs the AUGUR platform and its pillar apps' },
    spec: { type: 'team', children: [] },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'augur-platform',
      title: 'AUGUR platform',
      description: 'The shell, SDK, UI kit, gateway, identity, registry, events, models, storage and updater',
      annotations: { ...github, 'backstage.io/techdocs-ref': 'dir:..', 'augur.dev/release-unit': 'augur', 'augur.dev/version': json('release/augur-release.json').version },
    },
    spec: { owner: OWNER, domain: 'augur' },
  },
];

const FRONTEND_TYPE = 'website';
for (const name of dirs('platform/frontends')) {
  if (!existsSync(join(root, `platform/frontends/${name}/package.json`))) continue;
  platform.push(component({ dir: `platform/frontends/${name}`, type: FRONTEND_TYPE, system: 'augur-platform', unit: 'augur' }));
}
for (const name of dirs('platform/packages')) {
  platform.push(component({ dir: `platform/packages/${name}`, type: 'library', system: 'augur-platform', unit: 'augur' }));
}
for (const name of dirs('platform/services')) {
  const contract = `contracts/${name}.openapi.yaml`;
  platform.push(
    component({
      dir: `platform/services/${name}`,
      type: 'service',
      system: 'augur-platform',
      unit: 'augur',
      spec: {
        ...(existsSync(join(root, contract)) ? { providesApis: [`api:default/${name}-api`] } : {}),
        consumesApis: consumedApis(name),
        dependsOn: resourceDeps(name),
      },
    }),
  );
}
platform.push(component({ dir: 'platform/contract', type: 'tool', system: 'augur-platform', unit: 'augur' }));

for (const file of readdirSync(join(root, 'contracts')).filter((f) => f.endsWith('.openapi.yaml')).sort()) {
  const name = file.replace('.openapi.yaml', '');
  const info = parse(read(`contracts/${file}`)).info ?? {};
  platform.push({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: `${name}-api`,
      title: `${info.title ?? name} API`,
      ...(info.description ? { description: String(info.description).trim() } : {}),
      annotations: { ...github, 'augur.dev/contract-version': String(info.version ?? '') },
    },
    spec: { type: 'openapi', lifecycle: lifecycle(String(info.version ?? '')), owner: OWNER, system: 'augur-platform', definition: { $text: `../contracts/${file}` } },
  });
}

for (const [name, r] of Object.entries(RESOURCES)) {
  if (!stack[name]) continue;
  platform.push({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: { name, description: r.description, annotations: { 'augur.dev/image': String(stack[name].image ?? '') } },
    spec: { type: r.type, owner: OWNER, system: 'augur-platform' },
  });
}

// ---- Each app: its own system, with its frontend, its service, the intents it handles and what it keeps.
const appFiles = {};
for (const id of dirs('apps')) {
  if (!existsSync(join(root, `apps/${id}/manifest.json`))) continue;
  const m = json(`apps/${id}/manifest.json`);
  const unit = shipsWithAugur.has(id) ? 'augur' : `app/${id}`;
  const facts = {
    'augur.dev/app-id': m.id,
    'augur.dev/route': m.route,
    'augur.dev/sdk-range': m.sdk,
    'augur.dev/floors': (m.floors ?? []).join(','),
    'augur.dev/scopes': (m.scopes ?? []).join(','),
  };
  const entities = [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name: id,
        title: m.name,
        description: m.description,
        annotations: { ...github, ...sourceOf(`apps/${id}`), 'augur.dev/release-unit': unit, 'augur.dev/version': m.version, ...facts },
        ...(existsSync(join(root, `docs/${id}.md`)) ? { links: [{ url: `${SOURCE}/docs/${id}.md`, title: `${m.name} guide` }] } : {}),
      },
      spec: { owner: OWNER, domain: 'augur' },
    },
  ];
  const resources = [];
  if (m.storage?.database) resources.push({ name: `${id}-db`, type: 'database', description: `${m.name}'s schema in Postgres` });
  if (m.storage?.bucket) resources.push({ name: `${id}-bucket`, type: 's3-bucket', description: `${m.name}'s bucket in Garage` });
  const intents = m.handles?.length ? `${id}-intents` : null;
  for (const part of dirs(`apps/${id}`)) {
    if (!existsSync(join(root, `apps/${id}/${part}/package.json`))) continue;
    const isService = part === 'service';
    entities.push(
      component({
        dir: `apps/${id}/${part}`,
        type: isService ? 'service' : FRONTEND_TYPE,
        system: id,
        unit,
        extra: { 'augur.dev/app-id': id },
        spec: isService
          ? {
              consumesApis: shipsWithAugur.has(id) ? consumedApis(id) : appRunnerApis(m),
              dependsOn: [...resources.map((r) => `resource:default/${r.name}`), ...(shipsWithAugur.has(id) ? resourceDeps(id) : [])].sort(),
            }
          : intents
            ? { providesApis: [`api:default/${intents}`] }
            : {},
      }),
    );
  }
  if (intents) {
    entities.push({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: intents, title: `${m.name} intents`, description: `What other apps can ask ${m.name} for, through ctx.raise or ctx.request` },
      spec: { type: 'augur-intent', lifecycle: lifecycle(m.version), owner: OWNER, system: id, definition: stringify({ intents: m.handles }) },
    });
  }
  for (const r of resources) {
    entities.push({ apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: r.name, description: r.description }, spec: { type: r.type, owner: OWNER, system: id, dependsOn: [`resource:default/${r.type === 'database' ? 'postgres' : 'garage'}`] } });
  }
  appFiles[`catalog/apps/${id}.yaml`] = entities;
}

// ---- The files.
const doc = (entities) => HEADER + entities.map((e) => stringify(e, { lineWidth: 0 })).join('---\n');
const files = {
  'catalog/augur.yaml': doc(platform),
  ...Object.fromEntries(Object.entries(appFiles).map(([path, entities]) => [path, doc(entities)])),
};
files['catalog/all.yaml'] = doc([
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Location',
    metadata: { name: 'augur', description: 'Everything in the augur repository: register this one file in Backstage' },
    spec: { targets: Object.keys(files).map((p) => `./${relative('catalog', p)}`) },
  },
]);

// TechDocs: every guide in docs/, in one site on the platform system.
const guides = readdirSync(join(root, 'docs')).filter((f) => f.endsWith('.md')).sort();
const titleOf = (f) => (read(`docs/${f}`).match(/^#\s+(.+)$/m)?.[1] ?? f.replace('.md', '')).trim();
// Decision records (docs/decisions/, ADR 0001): the index first, then each record in number order.
const decisions = existsSync(join(root, 'docs/decisions'))
  ? readdirSync(join(root, 'docs/decisions')).filter((f) => /^\d{4}-.+\.md$/.test(f)).sort()
  : [];
const decisionsNav = decisions.length
  ? [{ Decisions: [{ Index: 'decisions/README.md' }, ...decisions.map((f) => ({ [titleOf(`decisions/${f}`)]: `decisions/${f}` }))] }]
  : [];
files['mkdocs.yml'] =
  HEADER +
  stringify(
    {
      site_name: 'AUGUR',
      docs_dir: 'docs',
      repo_url: `https://github.com/${REPO}`,
      edit_uri: 'edit/main/docs/',
      plugins: ['techdocs-core'],
      nav: [...guides.map((f) => ({ [titleOf(f)]: f })), ...decisionsNav],
    },
    { lineWidth: 0 },
  );

const mode = process.argv[2] ?? 'write';
if (mode === 'check') {
  const stale = Object.entries(files).filter(([path, text]) => !existsSync(join(root, path)) || read(path) !== text).map(([path]) => path);
  const known = new Set(Object.keys(files));
  const extra = existsSync(join(root, 'catalog/apps')) ? readdirSync(join(root, 'catalog/apps')).map((f) => `catalog/apps/${f}`).filter((p) => !known.has(p)) : [];
  if (stale.length || extra.length) {
    for (const p of stale) console.error(`✗ ${p} is out of date.`);
    for (const p of extra) console.error(`✗ ${p} is for an app that no longer exists.`);
    console.error('Run: pnpm catalog, and commit what it writes.');
    process.exit(1);
  }
  console.log(`✓ The catalog is up to date (${Object.keys(files).length} files).`);
} else if (mode === 'write') {
  rmSync(join(root, 'catalog'), { recursive: true, force: true });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  console.log(`✓ Wrote ${Object.keys(files).length} files: catalog/ and mkdocs.yml.`);
} else {
  console.error('Usage: node scripts/catalog.mjs [write|check]');
  process.exit(2);
}
