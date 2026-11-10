// An app's entry in the Backstage catalog, made from what its repository already says: manifest.json and
// each part's package.json (docs/catalog.md in augur). `augur-app catalog` writes it to catalog-info.yaml
// at the repository's root, and AUGUR's catalog/all.yaml points Backstage at it. Written as JSON
// documents, which are YAML, so the tools need no YAML library.

export const CATALOG_FILE = 'catalog-info.yaml';
const OWNER = 'group:default/augur-core';
const HEADER = "# Written by `augur-app catalog` from manifest.json and the package.json files. Don't edit it by hand.\n";

/** Backstage names: letters, digits and dashes, at most 63 characters. */
export const entityName = (s) => s.replace(/^@/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);
/** 0.x is still settling; 1.0 and later has made its promises. */
export const lifecycle = (version) => (version && !version.startsWith('0.') ? 'production' : 'experimental');

/** What an app calls on AUGUR: it registers itself, and calls events and models for what its scopes allow. */
const EVENTS_SCOPES = ['audit:write', 'notifications:send', 'events:publish', 'events:subscribe', 'inbox:write'];
export const appApis = (manifest) =>
  [
    'api:default/registry-api',
    ...((manifest.scopes ?? []).some((s) => EVENTS_SCOPES.includes(s)) ? ['api:default/events-api'] : []),
    ...((manifest.scopes ?? []).includes('models:use') ? ['api:default/models-api'] : []),
    ...((manifest.scopes ?? []).some((s) => s.startsWith('knowledge:')) ? ['api:default/knowledge-api'] : []),
  ].sort();

/** The repository the app lives in, as owner/name, from GITHUB_REPOSITORY or a GitHub remote's address. */
export const repoSlug = ({ env = process.env, remote = '' } = {}) => {
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  const m = remote.trim().match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/);
  return m ? m[1] : undefined;
};

/**
 * The entities for one app: its System, a Component for each part, the intents it handles as an API, and
 * the database and bucket it keeps. `parts` maps a part's directory (frontend, service) to its package.json.
 */
export function appCatalog({ manifest: m, parts, repo }) {
  if (!repo) throw new Error('Say which repository the app is in (owner/name): set GITHUB_REPOSITORY, or give the checkout a GitHub remote.');
  const source = (dir) => ({ 'backstage.io/source-location': `url:https://github.com/${repo}/tree/main/${dir ? `${dir}/` : ''}` });
  const github = { 'github.com/project-slug': repo };
  const unit = `app/${m.id}`;
  // A contract 3 manifest (ADR 0075) has no route or SDK range: the app is at /<id>, on the contract it names,
  // and what it handles is under contributes.intents.
  const facts = {
    'augur.dev/app-id': m.id,
    'augur.dev/route': m.contract !== undefined ? `/${m.id}` : m.route,
    ...(m.contract !== undefined ? { 'augur.dev/contract': String(m.contract) } : { 'augur.dev/sdk-range': m.sdk }),
    ...(m.category ? { 'augur.dev/category': m.category } : {}),
    'augur.dev/floors': (m.floors ?? []).join(','),
    'augur.dev/scopes': (m.scopes ?? []).join(','),
  };
  const handles = m.handles ?? m.contributes?.intents?.handles;
  const resources = [];
  if (m.storage?.database) resources.push({ name: `${m.id}-db`, type: 'database', description: `${m.name}'s schema in Postgres` });
  if (m.storage?.bucket) resources.push({ name: `${m.id}-bucket`, type: 's3-bucket', description: `${m.name}'s bucket in Garage` });
  const intents = handles?.length ? `${m.id}-intents` : null;

  const entities = [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name: m.id,
        title: m.name,
        ...(m.description ? { description: m.description } : {}),
        annotations: { ...github, ...source(''), 'augur.dev/release-unit': unit, 'augur.dev/version': m.version, ...facts },
      },
      spec: { owner: OWNER, domain: 'augur' },
    },
  ];
  for (const [dir, pkg] of Object.entries(parts).sort(([a], [b]) => a.localeCompare(b))) {
    const isService = dir === 'service';
    entities.push({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: entityName(pkg.name),
        title: pkg.name,
        ...(pkg.description ? { description: pkg.description } : {}),
        annotations: { ...github, ...source(dir), 'augur.dev/package': pkg.name, 'augur.dev/version': pkg.version, 'augur.dev/release-unit': unit, 'augur.dev/app-id': m.id },
      },
      spec: {
        type: isService ? 'service' : 'website',
        lifecycle: lifecycle(pkg.version),
        owner: OWNER,
        system: m.id,
        ...(isService
          ? { consumesApis: appApis(m), dependsOn: resources.map((r) => `resource:default/${r.name}`).sort() }
          : intents
            ? { providesApis: [`api:default/${intents}`] }
            : {}),
      },
    });
  }
  if (intents) {
    entities.push({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: intents, title: `${m.name} intents`, description: `What other apps can ask ${m.name} for, through ctx.raise or ctx.request` },
      spec: { type: 'augur-intent', lifecycle: lifecycle(m.version), owner: OWNER, system: m.id, definition: JSON.stringify({ intents: handles }, null, 2) },
    });
  }
  for (const r of resources) {
    entities.push({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: { name: r.name, description: r.description },
      spec: { type: r.type, owner: OWNER, system: m.id, dependsOn: [`resource:default/${r.type === 'database' ? 'postgres' : 'garage'}`] },
    });
  }
  return entities;
}

/** The file's text: one JSON document per entity, which Backstage reads as YAML. */
export const catalogText = (entities) => HEADER + entities.map((e) => JSON.stringify(e, null, 2)).join('\n---\n') + '\n';
