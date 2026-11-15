import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FrontendProblem } from '@augur/service-kit';
import { contentTypeOf, MemoryFrontendFiles, s3FrontendFiles } from './frontends.ts';

/**
 * What the frontends bucket is given, which is what Garage's web endpoint serves at /apps/: only the file
 * types an app frontend needs, each with its own Content-Type, never a page or an SVG that could run as the
 * shell's origin. The front door adds nosniff and its policy (infra/deploy/not-a-page.conf).
 */
describe('frontend files', () => {
  const seen: { key: string; type: string | undefined }[] = [];
  const garage = createServer((req, res) => {
    seen.push({ key: decodeURIComponent(req.url ?? '').replace(/\?.*$/, ''), type: req.headers['content-type'] });
    req.resume().on('end', () => res.writeHead(200, { etag: '"e"' }).end());
  });
  let endpoint = '';
  beforeAll(() => new Promise<void>((done) => garage.listen(0, '127.0.0.1', () => ((endpoint = `http://127.0.0.1:${(garage.address() as AddressInfo).port}`), done()))));
  afterAll(() => new Promise<void>((done) => garage.close(() => done())));

  it('serves scripts and styles as what they are, so nosniff lets them run', async () => {
    expect(contentTypeOf('entry.js')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeOf('a/chunk.mjs')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeOf('style.css')).toBe('text/css; charset=utf-8');
    const files = s3FrontendFiles({ endpoint, bucket: 'augur-frontends', accessKeyId: 'k', secretAccessKey: 's' });
    await files.put('library', '0.1.0_abc', [
      { path: 'entry.js', data: Buffer.from('export {};') },
      { path: 'style.css', data: Buffer.from('a{}') },
    ]);
    expect(seen.sort((a, b) => (a.key < b.key ? -1 : 1))).toEqual([
      { key: '/augur-frontends/apps/library/0.1.0_abc/entry.js', type: 'text/javascript; charset=utf-8' },
      { key: '/augur-frontends/apps/library/0.1.0_abc/style.css', type: 'text/css; charset=utf-8' },
    ]);
  });

  it('never writes a page or an SVG, even when handed one past the tarball’s check', async () => {
    seen.length = 0;
    const svg = { path: 'icon.svg', data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(sessionStorage.length)</script></svg>') };
    const page = { path: 'index.html', data: Buffer.from('<script>alert(1)</script>') };
    const files = s3FrontendFiles({ endpoint, bucket: 'augur-frontends', accessKeyId: 'k', secretAccessKey: 's' });
    for (const bad of [svg, page]) {
      await expect(files.put('library', '0.1.0_abc', [{ path: 'entry.js', data: Buffer.from('') }, bad])).rejects.toThrow(FrontendProblem);
      const memory = new MemoryFrontendFiles();
      await expect(memory.put('library', '0.1.0_abc', [bad])).rejects.toThrow(new RegExp(`"${bad.path.replace('.', '\\.')}" is a`));
      expect(memory.objects.size).toBe(0);
    }
    // Nothing of a refused frontend reaches the bucket, not even its allowed files.
    expect(seen).toEqual([]);
    expect(contentTypeOf('icon.svg')).toBeUndefined();
    expect(contentTypeOf('index.html')).toBeUndefined();
  });
});
