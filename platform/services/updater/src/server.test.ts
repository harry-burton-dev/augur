import { chmod, mkdtemp, open, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyArgs, writeSettings } from './server.ts';

describe('signature checks', () => {
  it('check against Sigstore online, or offline against a mirrored trust root', () => {
    const online = verifyArgs('https://github.com/o/r/.github/workflows/release.yml@refs/heads/main', 'https://token.actions.githubusercontent.com', 'ghcr.io/o/r/x@sha256:aa');
    expect(online).not.toContain('--offline=true');
    expect(online.at(-1)).toBe('ghcr.io/o/r/x@sha256:aa');
    const offline = verifyArgs('id', 'issuer', 'mirror.example/x@sha256:aa', '/deploy/releases/trusted_root.json');
    expect(offline).toEqual(expect.arrayContaining(['--offline=true', '--trusted-root', '/deploy/releases/trusted_root.json']));
    expect(offline.at(-1)).toBe('mirror.example/x@sha256:aa');
  });
});

describe('writing .env', () => {
  let dir: string;
  let env: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'updater-env-'));
    env = join(dir, '.env');
    await writeFile(env, 'PLATFORM_VERSION=0.2.0\n');
    await chmod(env, 0o640);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('writes it whole and renames it over the old one, keeping its mode and owner', async () => {
    const was = await stat(env);
    const owners: number[][] = [];
    await writeSettings(env, 'PLATFORM_VERSION=0.3.0\n', { chown: async (_, uid, gid) => void owners.push([uid, gid]), uid: was.uid + 1 });
    const now = await stat(env);
    expect(await readFile(env, 'utf8')).toBe('PLATFORM_VERSION=0.3.0\n');
    expect(now.ino).not.toBe(was.ino);
    expect(now.mode & 0o777).toBe(0o640);
    expect(owners).toEqual([[was.uid, was.gid]]);
    expect(await readdir(dir)).toEqual(['.env']);
  });

  it('writes it in place when its owner can’t be kept, with the old text kept beside it until the new is in', async () => {
    const was = await stat(env);
    const seen: string[][] = [];
    await writeSettings(env, 'PLATFORM_VERSION=0.3.0\n', {
      chown: async () => {
        throw new Error('EPERM: operation not permitted');
      },
      uid: was.uid + 1,
      inPlace: async (path, text) => {
        seen.push((await readdir(dir)).sort());
        expect(await readFile(join(dir, '.env.before-upgrade'), 'utf8')).toBe('PLATFORM_VERSION=0.2.0\n');
        expect((await stat(join(dir, '.env.before-upgrade'))).mode & 0o777).toBe(0o600);
        await writeFile(path, text);
      },
    });
    expect(seen).toEqual([['.env', '.env.before-upgrade']]);
    expect(await readFile(env, 'utf8')).toBe('PLATFORM_VERSION=0.3.0\n');
    expect((await stat(env)).ino).toBe(was.ino);
    expect(await readdir(dir)).toEqual(['.env']);
  });

  it('writes in place without changing its mode or owner, which only the file’s owner may (the updater reading it through an ACL)', async () => {
    const was = await stat(env);
    // A file the updater doesn't own: changing its mode or owner is refused, as the kernel would.
    const handle = await open(env, 'r');
    const proto = Object.getPrototypeOf(handle) as { chmod: (mode: number) => Promise<void>; chown: (uid: number, gid: number) => Promise<void>; stat: () => Promise<{ ino: number }> };
    await handle.close();
    const eperm = () => Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
    const ownChmod = proto.chmod;
    const chmods = vi.spyOn(proto, 'chmod').mockImplementation(async function (this: typeof proto, mode: number) {
      if ((await this.stat()).ino === was.ino) throw eperm();
      return ownChmod.call(this, mode);
    });
    const chowns = vi.spyOn(proto, 'chown').mockRejectedValue(eperm());
    try {
      await writeSettings(env, 'PLATFORM_VERSION=0.3.0\n', { uid: was.uid + 1 });
    } finally {
      chmods.mockRestore();
      chowns.mockRestore();
    }
    const now = await stat(env);
    expect(await readFile(env, 'utf8')).toBe('PLATFORM_VERSION=0.3.0\n');
    expect(now.ino).toBe(was.ino);
    expect(now.mode & 0o777).toBe(0o640);
    expect(await readdir(dir)).toEqual(['.env']);
  });

  it('puts the old text back when writing in place is cut short, and says so', async () => {
    const was = await stat(env);
    let writes = 0;
    const write = writeSettings(env, 'PLATFORM_VERSION=0.3.0\nPLATFORM_URL=https://augur.example.org\n', {
      chown: async () => {
        throw new Error('EPERM: operation not permitted');
      },
      uid: was.uid + 1,
      inPlace: async (path, text) => {
        writes += 1;
        if (writes === 1) {
          await writeFile(path, text.slice(0, 10));
          throw new Error('ENOSPC: no space left on device');
        }
        await writeFile(path, text);
      },
    });
    await expect(write).rejects.toThrow('.env couldn’t be written (ENOSPC: no space left on device), so it was put back as it was.');
    expect(await readFile(env, 'utf8')).toBe('PLATFORM_VERSION=0.2.0\n');
    expect(await readdir(dir)).toEqual(['.env']);
  });

  it('keeps the old text beside it when it can’t be put back either', async () => {
    const was = await stat(env);
    const write = writeSettings(env, 'PLATFORM_VERSION=0.3.0\n', {
      chown: async () => {
        throw new Error('EPERM: operation not permitted');
      },
      uid: was.uid + 1,
      inPlace: async (path, text) => {
        await writeFile(path, text.slice(0, 5));
        throw new Error('ENOSPC: no space left on device');
      },
    });
    await expect(write).rejects.toThrow(/\.env\.before-upgrade holds it as it was: copy it over \.env/);
    expect(await readFile(join(dir, '.env.before-upgrade'), 'utf8')).toBe('PLATFORM_VERSION=0.2.0\n');
  });
});
