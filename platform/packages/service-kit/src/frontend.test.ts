import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { frontendDigest, frontendPathProblem, packFrontend, publishFrontend, readFrontend, unpackFrontend } from './frontend.ts';

const built = () => {
  const dir = mkdtempSync(join(tmpdir(), 'frontend-'));
  mkdirSync(join(dir, 'assets', 'a-rather-long-folder-name-that-goes-on'.repeat(2)), { recursive: true });
  writeFileSync(join(dir, 'entry.js'), 'import "./assets/chunk.js";');
  writeFileSync(join(dir, 'assets', 'chunk.js'), 'export {};');
  writeFileSync(join(dir, 'assets', 'a-rather-long-folder-name-that-goes-on'.repeat(2), 'deep-file-with-a-long-name.js'), 'x'.repeat(700));
  return dir;
};

describe('frontend tarballs', () => {
  it('packs a build and unpacks the same files, the same bytes every time', () => {
    const dir = built();
    const files = readFrontend(dir);
    expect(files.map((f) => f.path)).toEqual([`assets/${'a-rather-long-folder-name-that-goes-on'.repeat(2)}/deep-file-with-a-long-name.js`, 'assets/chunk.js', 'entry.js']);
    const tarball = packFrontend(files);
    expect(frontendDigest(packFrontend(readFrontend(dir)))).toBe(frontendDigest(tarball));
    expect(unpackFrontend(tarball)).toEqual(files);
  });

  it('reads what GNU tar packs', () => {
    const dir = built();
    const out = join(mkdtempSync(join(tmpdir(), 'tar-')), 'f.tgz');
    execFileSync('tar', ['czf', out, '-C', dir, '.']);
    const files = unpackFrontend(execFileSync('cat', [out]));
    expect(files.map((f) => f.path).sort()).toEqual(readFrontend(dir).map((f) => f.path).sort());
  });

  it('refuses links, odd paths and too much', () => {
    const dir = built();
    symlinkSync('/etc/passwd', join(dir, 'passwd'));
    const out = join(mkdtempSync(join(tmpdir(), 'tar-')), 'f.tgz');
    execFileSync('tar', ['czf', out, '-C', dir, '.']);
    expect(() => unpackFrontend(execFileSync('cat', [out]))).toThrow(/isn’t a plain file/);
    expect(frontendPathProblem('../x.js')).toMatch(/"\.\."/);
    expect(frontendPathProblem('/x.js')).toMatch(/relative/);
    expect(frontendPathProblem('a b.js')).toMatch(/characters/);
    expect(() => packFrontend([{ path: 'a/../b.js', data: Buffer.from('') }])).toThrow();
    const many = packFrontend([1, 2, 3].map((n) => ({ path: `${n}.js`, data: Buffer.alloc(10) })));
    expect(() => unpackFrontend(many, { files: 2, bytes: 1000 })).toThrow(/at most 2 files/);
    expect(() => unpackFrontend(many, { files: 10, bytes: 20 })).toThrow(/at most/);
    expect(() => unpackFrontend(Buffer.from('not gzip'))).toThrow(/gzipped tarball/);
    expect(() => unpackFrontend(gzipSync(Buffer.alloc(1024)))).toThrow(/no files/);
  });
});

describe('publishFrontend', () => {
  const credentials = { name: 'expenses', getToken: async () => 't' };

  it('puts the tarball to the registry as the app', async () => {
    const seen: { url: string; type: string | null; bytes: number }[] = [];
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      seen.push({ url: String(input), type: new Headers(init?.headers).get('content-type'), bytes: (init?.body as Uint8Array).length });
      return new Response(JSON.stringify({ version: '1.2.0' }), { status: 201 });
    }) as typeof fetch;
    expect(await publishFrontend({ registryUrl: 'http://registry:8082/', credentials, app: 'expenses', version: '1.2.0', dir: built(), fetchImpl })).toBe(true);
    expect(seen).toEqual([{ url: 'http://registry:8082/v1/apps/expenses/versions/1.2.0/frontend', type: 'application/gzip', bytes: expect.any(Number) }]);
  });

  it('answers false where frontends aren’t kept, and says why it was refused', async () => {
    const answer = (status: number) =>
      (async (_input: string) =>
        new Response(JSON.stringify({ message: 'Different files.' }), { status })) as typeof fetch;
    const base = { registryUrl: 'http://registry:8082', credentials, app: 'expenses', version: '1.2.0', dir: built() };
    expect(await publishFrontend({ ...base, fetchImpl: answer(501) })).toBe(false);
    await expect(publishFrontend({ ...base, fetchImpl: answer(409) })).rejects.toThrow('answered 409: Different files.');
  });
});
