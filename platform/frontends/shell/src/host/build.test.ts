import { describe, expect, it, vi } from 'vitest';
import { BUILD_FILE, buildChange, buildNotice, servedBuild } from './build.js';

const running = { version: '0.40.2', build: 'a1' };

describe('the build this tab runs, against the one the server serves', () => {
  it('says nothing while the server serves the same build', () => {
    expect(buildChange(running, { version: '0.40.2', build: 'a1' })).toBeUndefined();
    expect(buildChange(running, undefined)).toBeUndefined();
  });

  it('says AUGUR was upgraded, rolled back, or only changed', () => {
    expect(buildChange(running, { version: '0.41.0', build: 'b2' })).toEqual({ kind: 'upgraded', version: '0.41.0' });
    expect(buildChange(running, { version: '0.40.10', build: 'b2' })).toEqual({ kind: 'upgraded', version: '0.40.10' });
    expect(buildChange(running, { version: '0.39.9', build: 'b2' })).toEqual({ kind: 'rolled back', version: '0.39.9' });
    expect(buildChange(running, { version: '0.40.2', build: 'b2' })).toEqual({ kind: 'changed', version: '0.40.2' });
  });

  it('reads the served build without the browser’s cache, and is quiet when it can’t', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ version: '0.41.0', build: 'b2' }));
    expect(await servedBuild(fetchImpl as unknown as typeof fetch)).toEqual({ version: '0.41.0', build: 'b2' });
    expect(fetchImpl).toHaveBeenCalledWith(BUILD_FILE, { cache: 'no-store' });
    expect(await servedBuild((async () => new Response(null, { status: 404 })) as unknown as typeof fetch)).toBeUndefined();
    expect(await servedBuild((async () => Response.json({ nope: 1 })) as unknown as typeof fetch)).toBeUndefined();
    expect(await servedBuild((async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toBeUndefined();
  });

  it('words the notice with the deployment’s own name, and offers a reload', () => {
    expect(buildNotice({ kind: 'upgraded', version: '0.41.0' }, 'Skein')).toEqual({
      title: 'Skein was upgraded while this tab was open',
      body: 'Reload to use it. Anything not yet saved in an app may be lost.',
      action: 'Reload',
    });
    expect(buildNotice({ kind: 'rolled back', version: '0.39.9' }, 'Skein').title).toBe('Skein went back to an earlier version while this tab was open');
    expect(buildNotice({ kind: 'changed', version: '0.40.2' }, 'Skein').title).toBe('Skein changed while this tab was open');
  });
});
