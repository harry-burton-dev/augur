import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from './app.ts';
import { loadAppManifests, platformApps } from './seed.ts';

describe('registry', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('hides apps that need a role the caller lacks', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/manifest' });
    expect(res.json().map((a: { id: string }) => a.id)).toEqual(['home']);
  });

  it('shows role-gated apps to callers with the role', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/manifest', headers: { 'x-user-id': 'u-1', 'x-user-roles': 'editor,admin' } });
    expect(res.json().map((a: { id: string }) => a.id)).toContain('admin');
  });

  it('adds apps from their own manifests', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'registry-'));
    const file = join(dir, 'manifest.json');
    writeFileSync(file, JSON.stringify({ id: 'sample', name: 'Sample', route: '/sample', entry: '/sample.js', version: '0.1.0' }));
    const app = await buildApp([...platformApps, ...loadAppManifests(file)]);
    const res = await app.inject({ method: 'GET', url: '/manifest' });
    expect(res.json().map((a: { id: string }) => a.id)).toEqual(['home', 'sample']);
  });
});
