import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeServices, deploymentLiterals, envExampleKeys, keysRead, section, settingsProblems, slug } from './check-settings.mjs';

const compose = `
x-telemetry: &telemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: \${OTEL_EXPORTER_OTLP_ENDPOINT:-}
x-service: &service
  restart: unless-stopped
  environment: &env
    <<: *telemetry
    NODE_ENV: production
services:
  registry:
    <<: *service
    environment:
      <<: *env
      PORT: 8082
      RELEASE_FEED_URL: \${RELEASE_FEED_URL:-}
  storage:
    env_file: [{ path: .env, required: false }]
    environment:
      DATABASE_URL: postgres://platform:\${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}@postgres:5432/platform
`;

const schema = {
  required: ['POSTGRES_PASSWORD'],
  patternProperties: { '^[A-Z][A-Z0-9_]*_BUCKET_SECRET$': { 'x-services': ['storage'], 'x-docs': 'docs/deploy.md#first-start' } },
  properties: {
    POSTGRES_PASSWORD: { writeOnly: true, 'x-services': ['storage'], 'x-docs': 'docs/deploy.md#first-start' },
    RELEASE_FEED_URL: { 'x-services': ['registry'], 'x-docs': 'docs/upgrade.md#the-updates-page' },
    OTEL_EXPORTER_OTLP_ENDPOINT: { 'x-services': ['registry'], 'x-docs': 'docs/deploy.md#first-start' },
    NODE_ENV: { 'x-internal': 'compose', 'x-services': ['registry'] },
    PORT: { 'x-internal': 'compose', 'x-services': ['registry'] },
  },
};

const files = {
  'infra/deploy/compose.yml': compose,
  'infra/deploy/.env.example': 'POSTGRES_PASSWORD=\n# RELEASE_FEED_URL=\n# OTEL_EXPORTER_OTLP_ENDPOINT=\n# NOTES_BUCKET_SECRET=\n',
  'docs/deploy.md': '# Deploy\n\n## First start\n\nSet `POSTGRES_PASSWORD`, and `OTEL_EXPORTER_OTLP_ENDPOINT` for traces.\n\n## Later\n',
  'docs/upgrade.md': "# Upgrading\n\n### The Updates page\n\n`RELEASE_FEED_URL` points at a mirror's feed.\n",
};

const code = { registry: "const feed = process.env.RELEASE_FEED_URL;\nconst port = Number(process.env.PORT ?? 8082);\n", 'service-kit': 'if (env.NODE_ENV === "production") {}' };

const check = (changes = {}) => settingsProblems({ schema, files, code, ...changes });

test('reads a compose service’s environment through its anchors, and whether it has an env_file', () => {
  const services = composeServices(compose);
  assert.deepEqual(Object.keys(services.registry.environment).sort(), ['NODE_ENV', 'OTEL_EXPORTER_OTLP_ENDPOINT', 'PORT', 'RELEASE_FEED_URL']);
  assert.equal(services.registry.envFile, false);
  assert.equal(services.storage.envFile, true);
});

test('passes settings that reach their services, are listed and documented', () => {
  assert.deepEqual(check(), []);
});

test('finds a setting the guides name that compose never hands its service', () => {
  const s = structuredClone(schema);
  s.properties.FEED_SIGNER = { 'x-services': ['registry'], 'x-docs': 'docs/upgrade.md#the-updates-page' };
  const problems = check({ schema: s, code: { registry: `${code.registry}const signer = process.env.FEED_SIGNER || 'x';` } });
  assert.ok(problems.some((p) => p.startsWith('FEED_SIGNER: registry reads it, but compose.yml doesn')));
  assert.ok(problems.includes('FEED_SIGNER: not in .env.example.'));
  assert.ok(problems.includes("FEED_SIGNER: docs/upgrade.md#the-updates-page doesn't mention it."));
});

test('takes a service with an env_file as reaching every deployment setting', () => {
  const s = structuredClone(schema);
  s.properties.APP_SECRETS_KEY = { writeOnly: true, 'x-services': ['storage'], 'x-docs': 'docs/deploy.md#first-start' };
  const problems = check({ schema: s });
  assert.ok(!problems.some((p) => p.includes('storage reads it')));
});

test('finds a key the code reads that isn’t described, or isn’t described for that service', () => {
  const problems = check({ code: { ...code, registry: `${code.registry}const t = Number(process.env.MODEL_TIMEOUT_SECONDS || 60);`, events: 'const { PORT } = process.env;' } });
  assert.ok(problems.includes("MODEL_TIMEOUT_SECONDS: registry reads it, but it isn't in settings.schema.json."));
  assert.ok(problems.includes("PORT: events reads it, but the schema doesn't list events (x-services or x-via)."));
});

test('holds compose’s required settings and the schema’s to each other', () => {
  const s = structuredClone(schema);
  s.required = ['RELEASE_FEED_URL'];
  const problems = check({ schema: s });
  assert.ok(problems.some((p) => p.startsWith('POSTGRES_PASSWORD: compose.yml requires it')));
  assert.ok(problems.some((p) => p.startsWith('RELEASE_FEED_URL: the schema requires it')));
});

test('finds keys in .env.example the schema doesn’t know, and internal ones listed there', () => {
  const problems = check({ files: { ...files, 'infra/deploy/.env.example': `${files['infra/deploy/.env.example']}# STRAY_SETTING=\nPORT=1\n` } });
  assert.ok(problems.includes('STRAY_SETTING: in .env.example, but not in settings.schema.json.'));
  assert.ok(problems.some((p) => p.startsWith('PORT: in .env.example, but the schema says nobody sets it')));
});

test('finds a guide section that doesn’t exist', () => {
  const s = structuredClone(schema);
  s.properties.RELEASE_FEED_URL['x-docs'] = 'docs/upgrade.md#the-feed';
  assert.ok(check({ schema: s }).includes('RELEASE_FEED_URL: docs/upgrade.md has no section #the-feed.'));
});

test('finds defaults that hard-code one deployment, but not ids kept on purpose', () => {
  assert.deepEqual(deploymentLiterals('ghcr.io/harry-burton-dev/im-platform'), []);
  assert.deepEqual(deploymentLiterals('${PLATFORM_IMAGES:-ghcr.io/harry-burton-dev/im-platform}/web:1'), []);
  assert.deepEqual(deploymentLiterals('harry-burton-dev/augur'), ['this GitHub owner']);
  assert.deepEqual(deploymentLiterals('https://platform.tail1234.ts.net'), ['a tailnet host']);
  assert.deepEqual(deploymentLiterals('https://<TS_HOSTNAME>.<your tailnet>.ts.net'), []);
  assert.deepEqual(deploymentLiterals('jo@acme.co.uk'), ['an email address']);
  assert.deepEqual(deploymentLiterals('jo@example.org'), []);
  assert.deepEqual(deploymentLiterals('--import @augur/service-kit/telemetry'), []);

  const s = structuredClone(schema);
  s.properties.RELEASE_FEED_URL.default = 'oci://ghcr.io/harry-burton-dev/augur/feed';
  assert.ok(check({ schema: s }).some((p) => p.startsWith('RELEASE_FEED_URL: its default in the schema hard-codes this GitHub owner')));
  const owned = compose.replace('PORT: 8082', 'PORT: 8082\n      PLATFORM_URL: ${PLATFORM_URL:-https://platform.tail1234.ts.net}');
  assert.ok(check({ files: { ...files, 'infra/deploy/compose.yml': owned } }).some((p) => p.startsWith('compose.yml hard-codes a tailnet host')));
});

test('reads every way the services name a setting', () => {
  const source = [
    "const a = process.env.ALPHA ?? '';",
    "const b = env['BRAVO'];",
    "loadConfigOrExit('x', [{ name: 'CHARLIE', about: 'c' }]);",
    "const d = setting('DELTA', 'x');",
    "if (!envValue(await server.readEnv(), 'ECHO')) return;",
    "const { FOXTROT = 'f', GOLF } = process.env;",
    'const path = process.env.PATH;',
  ].join('\n');
  assert.deepEqual(keysRead(source).sort(), ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF']);
});

test('finds a guide’s section by its anchor, as GitHub makes it', () => {
  assert.equal(slug("Upgrades follow each unit's policy and window"), 'upgrades-follow-each-units-policy-and-window');
  assert.equal(slug('Giving an app its storage (admins)'), 'giving-an-app-its-storage-admins');
  const md = '# A\n\n## One\n\ntext `X`\n\n```sh\n# not a heading\n```\n\n### Inside\n\nmore\n\n## Two\n\nother\n';
  assert.match(section(md, 'one'), /not a heading[\s\S]*more/);
  assert.doesNotMatch(section(md, 'one'), /other/);
  assert.equal(section(md, 'three'), undefined);
  assert.deepEqual(envExampleKeys('A=1\n# B=\n#  not a key\nC_D=x\n'), ['A', 'B', 'C_D']);
});
