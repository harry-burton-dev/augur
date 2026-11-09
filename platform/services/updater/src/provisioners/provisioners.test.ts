import { describe, expect, it } from 'vitest';
import { appSecretFor } from '@augur/service-kit';
import { examplePart, ENV, KEY } from '../runner.testing.ts';
import { appSecrets } from '../runner.ts';
import { ceilingProblems, PROVISIONERS, provisionParts, type AppUnit } from './index.ts';
import type { ProvisionContext } from './types.ts';
import type { AppManifest3 } from '@augur/app-tools/validate';

const manifest = {
  id: 'notes',
  name: 'Notes',
  version: '1.0.0',
  contract: 3,
  contributes: {
    settings: [
      {
        id: 'retentionDays',
        label: 'Keep archived notes for',
        type: 'number',
        default: 365,
      },
      {
        id: 'allowSharing',
        label: 'Notes can be shared',
        type: 'boolean',
        default: false,
      },
      {
        id: 'exportKey',
        label: 'Export service key',
        type: 'secret',
        required: false,
      },
      {
        id: 'apiKey',
        label: 'Map service key',
        type: 'secret',
        required: true,
      },
    ],
  },
} as AppManifest3;

const ctx = (type: string, params: Record<string, unknown>, more: Partial<ProvisionContext> = {}): ProvisionContext => ({
  app: 'notes',
  storageId: 'notes',
  part: 'web',
  resource: 'r',
  params,
  env: ENV,
  manifest,
  secrets: appSecrets(ENV, 'notes')!,
  ...more,
});

/** Params each type takes that are valid, so it provisions. */
const VALID: Record<string, Record<string, unknown>> = {
  'augur-gateway': { inbound: true },
  'augur-database': { connections: 10 },
  'augur-bucket': {},
  'augur-scratch': { size: '256Mi' },
  'augur-files': { label: 'Map tiles', detail: 'Offline tiles' },
  'augur-telemetry': {},
  'augur-floor-graphs': {},
  'augur-outbound': { hosts: ['tiles.example.org'], why: 'Fetches map tiles' },
  'augur-settings': { ids: ['retentionDays', 'exportKey'] },
};

const unit = (parts: AppUnit['parts'], env = ENV): AppUnit => ({
  app: 'notes',
  storageId: 'notes',
  manifest,
  parts,
  env,
  secrets: appSecrets(env, 'notes')!,
});
const partWith = (resources: Record<string, { type: string; params?: Record<string, unknown> }>) => {
  const part = examplePart('worker');
  part.resources = resources;
  part.containers.worker!.variables = {};
  part.containers.worker!.files = {};
  part.containers.worker!.volumes = {};
  return part;
};

describe('provisioners (spec 4.6, 10.2)', () => {
  it('offers the nine resource types of contract 3', () => {
    expect(Object.keys(PROVISIONERS).sort()).toEqual(Object.keys(VALID).sort());
  });

  for (const [type, params] of Object.entries(VALID)) {
    describe(type, () => {
      it('is idempotent: provisioning twice gives the same outputs, project and platform work', () => {
        const once = provisionParts(unit([partWith({ r: { type, params } })]));
        const twice = provisionParts(unit([partWith({ r: { type, params } })]));
        expect(twice).toEqual(once);
        const p = PROVISIONERS[type]!;
        expect(p.outputs(ctx(type, params))).toEqual(p.outputs(ctx(type, params)));
        expect(p.compose(ctx(type, params))).toEqual(p.compose(ctx(type, params)));
        expect(p.uri).toMatch(/^template:\/\/augur\//);
      });

      it('refuses a param it doesn’t take', () => {
        expect(() => provisionParts(unit([partWith({ r: { type, params: { ...params, colour: 'red' } } })]))).toThrow(new RegExp(`worker’s r \\(${type}\\) doesn’t take colour`));
      });
    });
  }

  it('refuses a value it doesn’t allow, with a plain reason', () => {
    const refused = (type: string, params: Record<string, unknown>) => () => provisionParts(unit([partWith({ r: { type, params } })]));
    expect(refused('augur-database', { connections: 101 })).toThrow('worker’s r (augur-database): connections is a whole number from 1 to 100.');
    expect(refused('augur-scratch', {})).toThrow('size is required, as <n>Mi or <n>Gi.');
    expect(refused('augur-scratch', { size: '1T' })).toThrow('size is required');
    expect(refused('augur-files', {})).toThrow('label is required');
    expect(refused('augur-outbound', { hosts: ['x.org'] })).toThrow('why is required');
    expect(refused('augur-gateway', { inbound: 'yes' })).toThrow('inbound is true or false.');
    expect(refused('augur-settings', { ids: ['nope'] })).toThrow('nope isn’t a setting the manifest declares.');
  });

  it('gives the gateway’s outputs: the app’s client and secret, and the gateway’s token and caller-keys routes', () => {
    expect(PROVISIONERS['augur-gateway']!.outputs(ctx('augur-gateway', { inbound: true }))).toEqual({
      url: { value: 'http://gateway:8080' },
      public_url: { value: 'https://augur.example' },
      client_id: { value: 'app-notes' },
      client_secret: {
        value: appSecretFor(KEY, 'notes', 'sign-in'),
        secret: true,
      },
      token_url: { value: 'http://gateway:8080/api/identity/v1/token' },
      caller_keys_url: {
        value: 'http://gateway:8080/api/gateway/v1/caller-keys',
      },
      inbound: { value: 'true' },
    });
    expect(provisionParts(unit([partWith({ g: { type: 'augur-gateway' } })])).needs).toEqual(['sign-in']);
  });

  it('gives a preview the storage of its own id, and the app’s sign-in', () => {
    const preview = {
      storageId: 'notes-pr12',
      secrets: {
        ...appSecrets(ENV, 'notes-pr12')!,
        signIn: appSecretFor(KEY, 'notes', 'sign-in'),
      },
    };
    const db = PROVISIONERS['augur-database']!.outputs(ctx('augur-database', {}, preview));
    expect(db).toMatchObject({
      user: { value: 'app_notes_pr12' },
      schema: { value: 'notes_pr12' },
      password: {
        value: appSecretFor(KEY, 'notes-pr12', 'database'),
        secret: true,
      },
      connections: { value: '30' },
    });
    const bucket = PROVISIONERS['augur-bucket']!.outputs(ctx('augur-bucket', {}, preview));
    expect(bucket.bucket).toEqual({ value: 'notes-pr12' });
    expect(bucket.access_key_id!.value).toMatch(/^GK[0-9a-f]{24}$/);
    expect(PROVISIONERS['augur-scratch']!.compose(ctx('augur-scratch', { size: '1Gi' }, preview)).volume).toEqual({
      name: 'app-notes-pr12-web-r',
      readOnly: false,
      size: 2 ** 30,
      labels: { 'augur.app': 'notes', 'augur.resource': 'augur-scratch' },
    });
  });

  it('gives each setting its value or default, an optional one empty, and stops on a required one with none', () => {
    const settings = PROVISIONERS['augur-settings']!;
    expect(settings.outputs(ctx('augur-settings', { ids: ['retentionDays', 'exportKey'] }))).toEqual({
      retentionDays: { value: '365' },
      exportKey: { value: '', secret: true },
    });
    expect(settings.outputs(ctx('augur-settings', { ids: ['retentionDays'] }, { settings: { retentionDays: '30' } }))).toEqual({ retentionDays: { value: '30' } });
    expect(() => provisionParts(unit([partWith({ s: { type: 'augur-settings' } })]))).toThrow('Notes needs its Map service key before it can start. An admin fills it in under Admin → Apps.');
  });

  it('sends telemetry where AUGUR’s own services send it, and leaves the endpoint empty without a collector', () => {
    expect(PROVISIONERS['augur-telemetry']!.outputs(ctx('augur-telemetry', {})).otlp_endpoint).toEqual({ value: 'http://otel-lgtm:4318' });
    expect(PROVISIONERS['augur-telemetry']!.outputs(ctx('augur-telemetry', {}, { env: `${ENV}OTEL_SDK_DISABLED=true\n` })).otlp_endpoint).toEqual({ value: '' });
    expect(PROVISIONERS['augur-telemetry']!.outputs(ctx('augur-telemetry', {}, { env: `${ENV}OTEL_LGTM_REPLICAS=0\n` })).otlp_endpoint).toEqual({ value: '' });
    expect(PROVISIONERS['augur-telemetry']!.outputs(ctx('augur-telemetry', {}, { env: `${ENV}OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318\n` })).otlp_endpoint).toEqual({
      value: 'http://collector:4318',
    });
  });
});

describe('ceilings (spec 7.2)', () => {
  const parts = ['web', 'worker', 'migrate'].map(examplePart);
  it('takes the example within the defaults', () => {
    expect(ceilingProblems(parts, ENV)).toEqual([]);
  });
  it('names the ceiling and the ask, for a part and for the app', () => {
    expect(ceilingProblems(parts, `${ENV}APP_PART_CPU_CEILING=750m\n`)).toEqual(['web asks for 1 CPU, above this deployment’s ceiling of 0.75 CPU a part (APP_PART_CPU_CEILING in .env).']);
    expect(ceilingProblems(parts, `${ENV}APP_MEMORY_CEILING=768Mi\n`)).toEqual([
      'Its parts ask for 1Gi of memory together, above this deployment’s ceiling of 768Mi an app (APP_MEMORY_CEILING in .env).',
    ]);
    const volumes = provisionParts(unit(parts.filter((p) => p.metadata.name === 'web'))).volumes;
    expect(ceilingProblems(parts, `${ENV}APP_SCRATCH_CEILING=128Mi\n`, volumes)).toEqual([
      'Its parts ask for 256Mi of scratch space together, above this deployment’s ceiling of 128Mi an app (APP_SCRATCH_CEILING in .env).',
    ]);
  });
});
