import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { lineView, PipelineReader, pipelineUrlFor, type Pipeline } from './pipeline.ts';
import { DATABASE_URL, registryDb } from './db.testing.ts';

const db = registryDb();

const pipeline: Pipeline = {
  schema: 'augur.pipeline/v1',
  generatedAt: '2026-10-30T22:00:00Z',
  repository: 'o/r',
  branches: [{ name: 'dev' }, { name: 'preview' }, { name: 'production' }],
  units: [
    { id: 'augur', name: 'AUGUR', versions: { dev: '0.13.0', preview: '0.12.0', production: '0.11.0' }, devBuild: { version: '0.13.1-dev.4' }, waiting: ['dev-ring'], previews: [] },
    { id: 'mandate', name: 'Mandate', versions: { dev: '0.1.5', preview: '0.1.4', production: null }, waiting: [], previews: [{ pr: 20, version: '0.1.5-pr.20.4' }] },
  ],
  changesets: [{ id: 'dev-ring', summary: 'A third ring.', units: ['augur'] }],
  steps: [
    { from: 'dev', to: 'preview', merged: 12, pulls: Array.from({ length: 12 }, (_, i) => ({ number: 100 + i, title: `PR ${i}` })) },
    { from: 'preview', to: 'production', merged: 0, pulls: [] },
  ],
  pulls: { versionPackages: { number: 9, title: 'Version packages', url: 'https://github.com/o/r/pull/9' }, promoteToProduction: [] },
};

const serving = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe.runIf(DATABASE_URL)('the pipeline feed', () => {
  it('sits beside the release feed on the container registry, and nowhere for a mirror', () => {
    expect(pipelineUrlFor('oci://ghcr.io/o/r/feed:latest')).toBe('oci://ghcr.io/o/r/feed:pipeline');
    expect(pipelineUrlFor('https://mirror.example/feed.json')).toBe('off');
    expect(pipelineUrlFor('file:///srv/feed.json')).toBe('off');
  });

  it('is read at most once a minute, and the last one is kept when a read fails', async () => {
    let now = 0;
    let calls = 0;
    let body: unknown = pipeline;
    const reader = new PipelineReader('https://x.example/pipeline.json', { fetchImpl: async (..._a) => (calls++, serving(body)()), now: () => now });
    expect((await reader.current())?.pipeline?.generatedAt).toBe(pipeline.generatedAt);
    await reader.current();
    expect(calls).toBe(1);
    now = 120_000;
    body = { schema: 'something/else' };
    const read = await reader.current();
    expect(calls).toBe(2);
    expect(read?.pipeline?.generatedAt).toBe(pipeline.generatedAt);
    expect(read?.problem).toContain('isn’t one this registry understands');
  });

  it('puts this server on the line: what it runs of each unit, and a few merges per step', async () => {
    const reader = new PipelineReader('https://x.example/pipeline.json', { fetchImpl: serving(pipeline) });
    const view = lineView(await reader.current(), { augur: '0.13.1-dev.4', mandate: '0.1.4' });
    expect(view.units.map((u) => [u.id, u.running])).toEqual([
      ['augur', '0.13.1-dev.4'],
      ['mandate', '0.1.4'],
    ]);
    expect(view.steps[0]).toMatchObject({ merged: 12 });
    expect(view.steps[0]!.pulls).toHaveLength(10);
    expect(lineView(undefined, {})).toEqual({ feed: 'off', units: [], steps: [] });
  });

  it('goes on the Upgrade Centre’s page, with the company’s portal', async () => {
    const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
    const server = await db.app({ pipeline: new PipelineReader('https://x.example/pipeline.json', { fetchImpl: serving(pipeline) }), portalUrl: 'https://portal.example' });
    const page = (await server.inject({ method: 'GET', url: '/v1/platform/updates', headers: admin })).json();
    expect(page.portalUrl).toBe('https://portal.example');
    expect(page.line).toMatchObject({ feed: 'on', repository: 'o/r', units: [{ id: 'augur' }, { id: 'mandate' }], pulls: { versionPackages: { number: 9 } } });
    expect(page.line.units[0].running).toBeDefined();
  });
});
