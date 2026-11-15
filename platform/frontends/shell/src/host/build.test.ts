import { describe, expect, it, vi } from 'vitest';
import { BUILD_FILE, buildChange, buildNotice, servedBuild } from './build.js';

const running = { version: '0.40.2', build: 'a1' };
const served = (build: Partial<{ version: string; build: string }>) => ({ version: '0.40.2', build: 'b2', ...build });

describe('the build this tab runs, against the one the server serves', () => {
  it('says nothing while the server serves the same build, or can’t say', () => {
    expect(buildChange(running, { version: '0.40.2', build: 'a1' })).toBeUndefined();
    expect(buildChange(running, undefined)).toBeUndefined();
  });

  it('says AUGUR was upgraded, rolled back, or only changed, by the shell’s release', () => {
    expect(buildChange(running, served({ version: '0.41.0' }))).toBe('upgraded');
    expect(buildChange(running, served({ version: '0.40.10' }))).toBe('upgraded');
    expect(buildChange(running, served({ version: '0.39.9' }))).toBe('rolled back');
    expect(buildChange(running, served({}))).toBe('changed');
  });

  it('orders a prerelease before its release', () => {
    expect(buildChange({ version: '0.41.0-rc.1', build: 'a1' }, served({ version: '0.41.0' }))).toBe('upgraded');
    expect(buildChange({ version: '0.41.0', build: 'a1' }, served({ version: '0.41.0-rc.2' }))).toBe('rolled back');
    expect(buildChange({ version: '0.41.0-rc.2', build: 'a1' }, served({ version: '0.41.0-rc.10' }))).toBe('upgraded');
  });

  it('counts a server whose shell writes no build file, as a release from before this one does, as changed', async () => {
    const page = (async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    const old = await servedBuild(page);
    expect(buildChange(running, old)).toBe('changed');
  });

  it('reads the served build without the browser’s cache, and is quiet when it can’t', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ version: '0.41.0', build: 'b2' }));
    expect(await servedBuild(fetchImpl as unknown as typeof fetch)).toEqual({ version: '0.41.0', build: 'b2' });
    expect(fetchImpl).toHaveBeenCalledWith(BUILD_FILE, { cache: 'no-store' });
    expect(await servedBuild((async () => new Response(null, { status: 404 })) as unknown as typeof fetch)).toBeUndefined();
    expect(await servedBuild((async () => new Response(null, { status: 502 })) as unknown as typeof fetch)).toBeUndefined();
    expect(await servedBuild((async () => Response.json({ nope: 1 })) as unknown as typeof fetch)).toBeUndefined();
    expect(await servedBuild((async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toBeUndefined();
  });

  it('words the notice with the deployment’s own name, and offers a reload', () => {
    expect(buildNotice('upgraded', 'Skein')).toEqual({
      title: 'Skein was upgraded while this tab was open',
      body: 'Reload to use it. Anything not yet saved in an app may be lost.',
      action: 'Reload',
    });
    expect(buildNotice('rolled back', 'Skein').title).toBe('Skein went back to an earlier version while this tab was open');
    expect(buildNotice('changed', 'Skein').title).toBe('Skein changed while this tab was open');
  });
});
