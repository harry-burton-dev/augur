import { chmod, mkdir, mkdtemp, open, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { composeAppHost, runToEnd, verifyArgs, writeSettings } from './server.ts';

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

describe('the apps’ project folder', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'updater-apps-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('writes each part’s files readable inside its container, keeps settings files private, and drops files no version names', async () => {
    const host = composeAppHost({ dir, dockerHost: 'tcp://nowhere:2375', dockerConfig: dir, signer: { identity: 'i', issuer: 'x' } });
    await host.writeProject({ apps: {} }, { name: 'augur-apps' }, { 'files/app-notes-web-blue/0': 'secret', 'files/app-notes-web-green/0': 'old', 'app-notes-blue.env': 'A=1\n' });
    expect(await readFile(join(dir, 'apps/files/app-notes-web-blue/0'), 'utf8')).toBe('secret');
    expect((await stat(join(dir, 'apps/files/app-notes-web-blue/0'))).mode & 0o777).toBe(0o444);
    expect((await stat(join(dir, 'apps/app-notes-blue.env'))).mode & 0o777).toBe(0o600);
    expect((await stat(join(dir, 'apps'))).mode & 0o777).toBe(0o700);
    expect(await readFile(join(dir, 'apps/compose.yml'), 'utf8')).toContain('"name": "augur-apps"');

    await host.writeProject({ apps: {} }, { name: 'augur-apps' }, { 'files/app-notes-web-blue/0': 'new' });
    expect(await readFile(join(dir, 'apps/files/app-notes-web-blue/0'), 'utf8')).toBe('new');
    expect(await readdir(join(dir, 'apps/files'))).toEqual(['app-notes-web-blue']);
  });

  it('makes an app’s network internal, joins the runner and the platform’s parts it names by their names, and takes away a network no app needs', async () => {
    const bin = join(dir, 'bin');
    const log = join(dir, 'docker.log');
    await writeFile(
      join(dir, 'fake-docker'),
      `#!/bin/sh
echo "$*" >> ${log}
case "$*" in
  "container inspect --format {{.Id}} "*) echo self ;;
  "network ls --filter label=augur.network=app "*) echo app-old ;;
  *"com.docker.compose.service=gateway"*) echo gw ;;
  *"com.docker.compose.service=postgres"*) echo pg ;;
  *"com.docker.compose.service="*) ;;
  *com.docker.compose.project*) echo platform ;;
  "network inspect --format {{json .Containers}} app-notes") echo '{"gw":{}}' ;;
  "ps --all --no-trunc --filter network=app-old --format {{.ID}}") echo left ;;
esac
`,
    );
    await mkdir(bin);
    await rename(join(dir, 'fake-docker'), join(bin, 'docker'));
    await chmod(join(bin, 'docker'), 0o755);
    vi.stubEnv('PATH', `${bin}:${process.env.PATH}`);
    try {
      const host = composeAppHost({ dir, dockerHost: 'tcp://nowhere:2375', dockerConfig: dir, signer: { identity: 'i', issuer: 'x' } });
      await host.appNetworks([{ app: 'notes', name: 'app-notes', join: ['gateway', 'postgres'] }]);
      const said = (await readFile(log, 'utf8')).trim().split('\n');
      expect(said).toContain('network create --internal --label augur.network=app --label augur.app=notes app-notes');
      expect(said).toContain('network connect app-notes self');
      expect(said).toContain('network connect --alias postgres app-notes pg');
      // Already on it: nothing to do.
      expect(said.some((l) => l.includes('--alias gateway'))).toBe(false);
      expect(said).toContain('network disconnect --force app-old left');
      expect(said).toContain('network rm app-old');
      expect(said.some((l) => l === 'network rm app-notes')).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('runs a job to its end and says how it ended: its exit code, or that its time ran out', async () => {
    const env = { PATH: process.env.PATH ?? '/usr/bin:/bin' };
    expect(await runToEnd('sh', ['-c', 'echo migrated; exit 0'], env, 5_000)).toEqual({ code: 0, logs: 'migrated\n' });
    expect(await runToEnd('sh', ['-c', 'echo half; echo broke >&2; exit 3'], env, 5_000)).toEqual({ code: 3, logs: 'half\nbroke\n' });
    expect((await runToEnd('sh', ['-c', 'sleep 5'], env, 100)).code).toBe('timeout');
  });
});
