import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appSecretFor } from '@augur/service-kit';
import type { ScorePart } from '@augur/app-tools/validate';
import { APP_WATCH_EVERY_MS, appNetworksOf, appsProject, publishersFrom, RETIRE_MS, runsAsRoot, type AppJob, type JobReport, type RunnerState, type RunningApp } from './runner.ts';
import { examplePart, ENV, FRONTEND_DIGEST, image, install, KEY, release, setup } from './runner.testing.ts';
import { releaseIdentity } from './signers.ts';

/** Whether this machine has Docker Compose, to check a project with `docker compose config` (CI's runners do). */
const hasCompose = (() => {
  try {
    execFileSync('docker', ['compose', 'version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const versionOf = (t: ReturnType<typeof setup>, c: string, v: string) => {
  t.versions.set(image(c, 'web'), v);
  t.versions.set(image(c, 'worker'), v);
};
const SECRET = appSecretFor(KEY, 'notes', 'sign-in');

describe('running Score parts (spec 4, 10)', () => {
  it('makes the example’s three parts three services: named by part and slot, held to their limits, read-only, with no added powers and only the volumes they asked for', async () => {
    const t = setup();
    expect(await t.run(install('1.0.0'))).toBe('done');
    const services = t.project()!.services;
    expect(Object.keys(services)).toEqual(['app-notes-web-blue', 'app-notes-worker-blue', 'app-notes-migrate-blue']);
    for (const s of Object.values(services)) {
      expect(s).toMatchObject({
        read_only: true,
        tmpfs: ['/tmp'],
        cap_drop: ['ALL'],
        security_opt: ['no-new-privileges:true'],
        networks: ['app-notes'],
      });
      expect(s).not.toHaveProperty('ports');
      expect(s).not.toHaveProperty('privileged');
    }
    expect(services['app-notes-web-blue']).toMatchObject({
      image: image('a'),
      mem_limit: 512 * 2 ** 20,
      cpus: 1,
      restart: 'unless-stopped',
    });
    expect(services['app-notes-worker-blue']).toMatchObject({
      image: image('a', 'worker'),
      mem_limit: 256 * 2 ** 20,
      cpus: 0.5,
    });
    // A job runs only when the runner runs it.
    expect(services['app-notes-migrate-blue']).toMatchObject({
      entrypoint: ['node', 'dist/migrate.js'],
      restart: 'no',
      profiles: ['jobs'],
      mem_limit: 256 * 2 ** 20,
      cpus: 0.5,
    });
    // Volumes: web's scratch, writable; the worker's files, read-only; nothing for migrate.
    expect(services['app-notes-web-blue']!.volumes).toEqual([
      {
        type: 'volume',
        source: 'app-notes-web-scratch',
        target: '/scratch',
        read_only: false,
      },
    ]);
    expect(services['app-notes-worker-blue']!.volumes).toEqual([
      {
        type: 'volume',
        source: 'app-notes-worker-maps',
        target: '/maps',
        read_only: true,
      },
    ]);
    expect(services['app-notes-migrate-blue']).not.toHaveProperty('volumes');
    expect(Object.keys(t.project()!.volumes ?? {})).toEqual(['app-notes-web-scratch', 'app-notes-worker-maps']);
    // Only ${resources.*} outputs: no service addresses, and the database login is the app's own.
    const web = services['app-notes-web-blue']!.environment as Record<string, string>;
    expect(web).toMatchObject({
      PORT: '8080',
      GATEWAY_URL: 'http://gateway:8080',
      CLIENT_ID: 'app-notes',
      DATABASE_USER: 'app_notes',
      DATABASE_SCHEMA: 'notes',
      DATABASE_HOST: 'postgres',
      RETENTION_DAYS: '365',
      ALLOW_SHARING: 'false',
      OTEL_SERVICE_NAME: 'notes-web',
    });
    for (const s of Object.values(services)) {
      for (const key of ['IDENTITY_URL', 'EVENTS_URL', 'REGISTRY_URL', 'MODELS_URL', 'DATABASE_URL', 'SERVICE_CLIENT_SECRET']) expect(s.environment).not.toHaveProperty(key);
    }
    // Secrets arrive as files, mounted as Compose secrets; the project itself holds none.
    expect(services['app-notes-web-blue']!.secrets).toEqual([
      {
        source: 'app-notes-web-blue-file-0',
        target: '/run/augur/client-secret',
      },
      {
        source: 'app-notes-web-blue-file-1',
        target: '/run/augur/database-password',
      },
      { source: 'app-notes-web-blue-file-2', target: '/run/augur/export-key' },
    ]);
    expect(t.project()!.secrets!['app-notes-web-blue-file-0']).toEqual({
      file: './files/app-notes-web-blue/0',
    });
    expect(t.files()['files/app-notes-web-blue/0']).toBe(SECRET);
    expect(t.files()['files/app-notes-web-blue/1']).toBe(appSecretFor(KEY, 'notes', 'database'));
    // An optional secret setting with no value is an empty file.
    expect(t.files()['files/app-notes-web-blue/2']).toBe('');
    const text = JSON.stringify(t.project());
    for (const secret of [SECRET, appSecretFor(KEY, 'notes', 'database'), appSecretFor(KEY, 'notes', 'bucket')]) expect(text).not.toContain(secret);
    expect(JSON.stringify(t.state())).not.toContain(SECRET);

    // Provisioned, signed in, the job run, then the long-running parts started; the inbound part is the upstream.
    expect(t.did).toEqual([
      `verify ${releaseIdentity(PUBLISHER_WORKFLOW)}`,
      `verify ${releaseIdentity(PUBLISHER_WORKFLOW)}`,
      // The frontend bundle: signed like the images, then fetched by digest (spec 3.3, 3.4).
      `verify ${releaseIdentity(PUBLISHER_WORKFLOW)}`,
      'fetch notes-frontend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa application/vnd.augur.frontend.v1.tar+gzip',
      'storage notes (30 connections)',
      'job app-notes-migrate-blue',
      'start app-notes-web-blue',
      'start app-notes-worker-blue',
    ]);
    expect(t.calls.did).toEqual([`frontend notes 1.0.0 ${FRONTEND_DIGEST.slice(7, 19)}`, `credential notes ${SECRET.slice(0, 6)}`, 'register notes 1.0.0', 'upstream notes http://app-notes-web-blue:8080']);
    expect(t.state().apps.notes).toEqual({
      active: {
        slot: 'blue',
        version: '1.0.0',
        parts: expect.any(Array),
        manifest: expect.objectContaining({ id: 'notes', version: '1.0.0' }),
        repository: 'o/r',
      },
    });
    expect(t.reports.find((r) => r.step === 'start' && r.state === 'done')?.message).toBe('Ran migrate to the end first.');
    expect(t.reports.at(-1)).toMatchObject({
      step: 'retire',
      outcome: 'done',
      message: 'Notes 1.0.0 is installed.',
    });
  });

  it('stops at provisioning, naming the ceiling, when a part asks for more memory than it allows', async () => {
    const t = setup(`${ENV}APP_PART_MEMORY_CEILING=1Gi\n`);
    const big = install('1.0.0', 'a', {}, (parts) => (parts[0]!.containers.web!.resources.limits.memory = '2Gi'));
    expect(await t.run(big)).toBe('failed');
    expect(t.reports.at(-1)).toMatchObject({
      step: 'storage',
      outcome: 'failed',
      message: 'web asks for 2Gi of memory, above this deployment’s ceiling of 1Gi a part (APP_PART_MEMORY_CEILING in .env). Nothing was started.',
    });
    expect(t.did.filter((d) => !d.startsWith('verify') && !d.startsWith('fetch'))).toEqual([]);
    // The registry has the frontend bundle by then (kept on verify, inert until the version registers); nothing else.
    expect(t.calls.did.filter((d) => !d.startsWith('frontend'))).toEqual([]);
    expect(t.state().apps).toEqual({});
    // The app's totals have ceilings too, and the ceiling's default stands without the setting.
    const total = setup(`${ENV}APP_CPU_CEILING=1500m\n`);
    expect(await total.run(install('1.0.0'))).toBe('failed');
    expect(total.reports.at(-1)?.message).toMatch(/2 CPU together, above this deployment’s ceiling of 1\.5 CPU an app \(APP_CPU_CEILING in \.env\)/);
  });

  it('never switches when the migrate job fails, and says what it said last', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    t.calls.did.length = 0;
    t.jobs.set('app-notes-migrate-green', {
      code: 3,
      logs: `${'line\n'.repeat(20)}error: relation "notes" already exists\n`,
    });
    expect(await t.run(install('1.1.0', 'b'))).toBe('failed');
    expect(t.reports.at(-1)).toMatchObject({
      step: 'start',
      outcome: 'failed',
    });
    expect(t.reports.at(-1)?.message).toBe(
      'migrate (a job) exited 3. Its last lines: line | line | line | line | line | line | line | line | line | error: relation "notes" already exists 1.0.0 is still serving.',
    );
    expect(t.did.filter((d) => d.startsWith('start')).slice(-1)).toEqual(['start app-notes-worker-blue']);
    expect(t.calls.did.filter((d) => d.startsWith('register') || d.startsWith('upstream'))).toEqual([]);
    expect(t.state().apps.notes).toEqual({
      active: expect.objectContaining({ slot: 'blue', version: '1.0.0' }),
    });

    // One that runs out of time doesn't switch either.
    t.jobs.set('app-notes-migrate-green', { code: 'timeout', logs: '' });
    expect(await t.run(install('1.1.0', 'b'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe('migrate (a job) didn’t finish within 180 s, saying nothing 1.0.0 is still serving.');
  });

  it('waits on every service part’s /healthz, each within its own time', async () => {
    const api = (parts: ReturnType<typeof examplePart>[]) => {
      const second = structuredClone(parts[0]!);
      second.metadata.name = 'api';
      second.metadata.annotations!['augur.dev/ready-seconds'] = '30';
      delete second.resources!.gateway!.params;
      delete second.resources!.scratch;
      delete second.containers.web!.volumes;
      parts.splice(1, 0, second);
    };
    const t = setup();
    expect(await t.run(install('1.0.0', 'a', {}, api))).toBe('done');
    expect(new Set(t.health)).toEqual(new Set(['http://app-notes-web-blue:8080/healthz', 'http://app-notes-api-blue:8080/healthz']));
    // The worker and the job are never asked.
    expect(t.health.some((u) => /worker|migrate/.test(u))).toBe(false);

    // The second service part never answers: the install is undone once its 30 s are up.
    const slow = setup();
    const start = slow.host.start;
    slow.host.start = async (services) => {
      await start(services);
      slow.running.delete('app-notes-api-blue');
    };
    expect(await slow.run(install('1.0.0', 'a', {}, api))).toBe('failed');
    expect(slow.reports.at(-1)).toMatchObject({
      step: 'health',
      message: 'The api part of Notes 1.0.0 didn’t answer within 30 s; its logs say why.',
    });
    expect(slow.clock()).toBeGreaterThanOrEqual(30_000);
    expect(slow.clock()).toBeLessThan(60_000);
    expect(slow.running.size).toBe(0);
  });

  it('refuses an image that runs as root', async () => {
    const t = setup();
    t.users.set(image('a', 'worker'), '');
    expect(await t.run(install('1.0.0'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe('worker’s image runs as root (it sets no user): a part runs as a user other than root, given as a number so it can be told without the image’s own user list (spec 4.13). Set USER to one, such as USER 10001, in its Dockerfile.');
    expect(t.did.some((d) => d.startsWith('start') || d.startsWith('job'))).toBe(false);
    expect(runsAsRoot('0:0')).toBe(true);
    expect(runsAsRoot('root')).toBe(true);
    // A name may be uid 0 in the image's passwd; only a number says it isn't.
    expect(runsAsRoot('node')).toBe(true);
    expect(runsAsRoot('00')).toBe(true);
    expect(runsAsRoot('10001:10001')).toBe(false);
  });

  it('refuses a part that reads a secret anywhere but a file, or mounts what it wasn’t given', async () => {
    const t = setup();
    expect(await t.run(install('1.0.0', 'a', {}, (p) => (p[0]!.containers.web!.variables!.DB_PASSWORD = '${resources.db.password}')))).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe('web reads the secret db.password in the variable DB_PASSWORD: a secret arrives only as a file (files), never anywhere else.');
    expect(await t.run(install('1.0.0', 'a', {}, (p) => (p[2]!.containers.migrate!.args = ['--pw', '${resources.db.password}'])))).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/migrate reads the secret db\.password in its arguments \(2\)/);
    // Score's escape is a literal, not a read.
    expect(await t.run(install('1.0.0', 'a', {}, (p) => (p[2]!.containers.migrate!.args = ['--pw', '$${resources.db.password}'])))).toBe('done');
    expect(t.project()!.services['app-notes-migrate-blue']!.command).toEqual(['--pw', '$${resources.db.password}']);

    const u = setup();
    // The release writer refuses these too; the runner doesn't rely on it.
    const hostFolder = install('1.0.0');
    hostFolder.release!.parts[0]!.containers.web!.volumes = {
      '/data': { source: '/srv/data' },
    };
    expect(await u.run(hostFolder)).toBe('failed');
    expect(u.reports.at(-1)?.message).toMatch(/^web: AUGUR: \/containers\/web\/volumes\/~1data\/source must match/);
    const notGiven = install('1.0.0');
    notGiven.release!.parts[0]!.containers.web!.volumes = {
      '/data': { source: '${resources.db}' },
    };
    expect(await u.run(notGiven)).toBe('failed');
    expect(u.reports.at(-1)?.message).toBe('web mounts ${resources.db} at /data: a part mounts only its own augur-scratch or augur-files resources, as ${resources.<name>} (spec 4.7).');
    const redis = install('1.0.0');
    redis.release!.parts[0]!.resources!.cache = { type: 'redis' };
    expect(await u.run(redis)).toBe('failed');
    expect(u.reports.at(-1)?.message).toBe('web asks for cache of type redis: resource type not offered by this AUGUR.');
  });

  it('refuses a limit Docker would read as none, and a name too long to be a host name', async () => {
    const t = setup();
    // Score's schema refuses 0 itself; Docker refuses these.
    const none = install('1.0.0');
    none.release!.parts[1]!.containers.worker!.resources.limits.memory = '1';
    expect(await t.run(none)).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/memory limit 1 is below the 6Mi a container needs\./);
    const tiny = install('1.0.0');
    tiny.release!.parts[1]!.containers.worker!.resources.limits.cpu = '1m';
    expect(await t.run(tiny)).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/^worker’s CPU limit 1m is below the 0\.01 CPU a container may be given\./);
    // An id and a part name each within their own limits, too long together.
    const id = `n${'o'.repeat(39)}`;
    const long = { ...install('1.0.0'), app: id };
    long.release = { ...long.release!, id, manifest: { ...long.release!.manifest, id } };
    long.release.parts[1]!.metadata.name = `w${'o'.repeat(31)}`;
    expect(await t.run(long)).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/is longer than the 63 characters a host name may be/);
    expect(t.did.some((d) => d.startsWith('start') || d.startsWith('storage'))).toBe(false);
  });

  it('writes a project Compose reads as written: a $ the part means is never filled in from the updater’s settings', async () => {
    const t = setup();
    expect(await t.run(install('1.0.0', 'a', {}, (p) => (p[0]!.containers.web!.variables!.GREETING = 'costs $5 at $HOME')))).toBe('done');
    expect((t.project()!.services['app-notes-web-blue']!.environment as Record<string, string>).GREETING).toBe('costs $$5 at $$HOME');
    // Every $ in the project is doubled, which Compose reads as one.
    expect(JSON.stringify(t.project()).replace(/\$\$/g, '')).not.toContain('$');
  });

  it.skipIf(!hasCompose)('passes docker compose config, with every value as the part wrote it', async () => {
    const t = setup();
    expect(await t.run(install('1.0.0', 'a', {}, (p) => {
      p[0]!.containers.web!.variables!.GREETING = 'costs $5 at $HOME';
      p[2]!.containers.migrate!.args = ['--pw', '$${resources.db.password}'];
    }))).toBe('done');
    const dir = mkdtempSync(join(tmpdir(), 'apps-'));
    for (const [path, text] of Object.entries(t.files())) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    writeFileSync(join(dir, 'compose.yml'), JSON.stringify(t.project()));
    const config = JSON.parse(execFileSync('docker', ['compose', '-f', join(dir, 'compose.yml'), '--profile', 'jobs', 'config', '--format', 'json'], { env: { PATH: process.env.PATH, HOME: '/somewhere' } }).toString());
    rmSync(dir, { recursive: true, force: true });
    // Compose filled nothing in (no error, no HOME): config prints the value escaped again, as it would read it.
    expect(config.services['app-notes-web-blue'].environment.GREETING).toBe('costs $$5 at $$HOME');
    expect(config.services['app-notes-migrate-blue'].command).toEqual(['--pw', '$${resources.db.password}']);
    expect(JSON.stringify(config)).not.toContain('/somewhere');
    expect(config.services['app-notes-web-blue'].read_only).toBe(true);
    expect(config.services['app-notes-web-blue'].cap_drop).toEqual(['ALL']);
  });

  it('takes only releases on contract 3, for the app the job names', async () => {
    const t = setup();
    expect(
      await t.run({
        id: 'j',
        app: 'notes',
        action: 'install',
        release: {
          id: 'notes',
          version: '1.0.0',
          service: { image: image('a') },
        } as never,
        state: 'requested',
      }),
    ).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe('This release isn’t on app contract 3, the only one this AUGUR’s runner runs.');
    expect(await t.run({ ...install('1.0.0'), app: 'other' })).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe('The release is for notes, not other.');
  });
});

const PUBLISHER_WORKFLOW = 'o/r/.github/workflows/release.yml';

describe('the app runner', () => {
  it('installs a dev build only on a dev or preview server, from the dev workflow on dev, after a backup', async () => {
    const dev = {
      signer: { repository: 'o/r', workflow: '.github/workflows/app-dev.yml' },
    };
    const onProduction = setup(`${ENV}SERVER_RING=production\n`);
    expect(await onProduction.run(install('1.0.1-dev.40', 'c', dev))).toBe('failed');
    expect(onProduction.reports.at(-1)?.message).toMatch(/only a dev or preview server/);
    expect(onProduction.did).toEqual([]);

    const workbench = setup(`${ENV}SERVER_RING=dev\n`);
    versionOf(workbench, 'c', '1.0.1-dev.40');
    expect(await workbench.run(install('1.0.1-dev.40', 'c', dev))).toBe('done');

    const t = setup(`${ENV}SERVER_RING=preview\n`);
    versionOf(t, 'c', '1.0.1-dev.40');
    expect(await t.run(install('1.0.1-dev.40', 'c', dev))).toBe('done');
    expect(t.did.slice(0, 5)).toEqual([
      'verify ^https://github\\.com/o/r/\\.github/workflows/app-dev\\.yml@refs/heads/(main|dev)$',
      'verify ^https://github\\.com/o/r/\\.github/workflows/app-dev\\.yml@refs/heads/(main|dev)$',
      'verify ^https://github\\.com/o/r/\\.github/workflows/app-dev\\.yml@refs/heads/(main|dev)$',
      'fetch notes-frontend@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc application/vnd.augur.frontend.v1.tar+gzip',
      'backup',
    ]);
    expect(t.reports.find((r) => r.step === 'verify' && r.state === 'done')?.message).toMatch(/Backup platform-20261030-0100\.sql\.gz/);

    // Signed by the release workflow, a dev version isn't taken as a dev build.
    const wrong = setup(`${ENV}SERVER_RING=preview\n`);
    expect(await wrong.run(install('1.0.1-dev.41', 'c'))).toBe('failed');
    expect(wrong.reports.at(-1)?.message).toMatch(/isn’t trusted to publish dev builds/);
  });

  it('upgrades blue/green, and stops the old version once its time is up', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    t.did.length = 0;
    expect(await t.run(install('1.1.0', 'b'))).toBe('done');
    expect(t.did).toContain('job app-notes-migrate-green');
    expect(t.did).toContain('start app-notes-web-green');
    expect(t.running.has('app-notes-web-blue')).toBe(true);
    expect(t.state().apps.notes.active).toMatchObject({
      slot: 'green',
      version: '1.1.0',
    });
    expect(t.state().apps.notes.retiring).toMatchObject({
      slot: 'blue',
      version: '1.0.0',
      until: '2026-10-27T12:10:00.000Z',
    });
    expect(Object.keys(t.project()!.services)).toEqual([
      'app-notes-web-green',
      'app-notes-worker-green',
      'app-notes-migrate-green',
      'app-notes-web-blue',
      'app-notes-worker-blue',
      'app-notes-migrate-blue',
    ]);
    // Both slots share the app's scratch folder and files.
    expect(Object.keys(t.project()!.volumes ?? {})).toEqual(['app-notes-web-scratch', 'app-notes-worker-maps']);
    await t.runner.retireDue();
    expect(t.running.has('app-notes-web-blue')).toBe(true);
    t.later(RETIRE_MS);
    await t.runner.retireDue();
    expect(t.running.has('app-notes-web-blue')).toBe(false);
    expect(t.running.has('app-notes-worker-blue')).toBe(false);
    expect(Object.keys(t.project()!.services)).toEqual(['app-notes-web-green', 'app-notes-worker-green', 'app-notes-migrate-green']);
    expect(Object.keys(t.files()).filter((f) => f.includes('blue'))).toEqual([]);
  });

  it('watches an upgrade for 5 minutes after the switch, and goes back by itself when it stops answering', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    const wait = t.host.wait;
    // The new version answers through the health step, then falls over two minutes after the switch.
    let switchedAt: number | undefined;
    t.host.wait = async (ms) => {
      await wait(ms);
      if (ms === APP_WATCH_EVERY_MS) switchedAt ??= t.clock() - ms;
      if (switchedAt !== undefined && t.clock() - switchedAt >= 2 * 60_000) t.running.delete('app-notes-web-green');
    };
    t.calls.did.length = 0;
    expect(await t.run(install('1.1.0', 'b'))).toBe('failed');
    expect(t.reports.at(-1)).toMatchObject({
      step: 'watch',
      state: 'failed',
      outcome: 'failed',
      message: 'Notes 1.1.0: the web part stopped answering after the switch. Back on 1.0.0 by itself.',
    });
    expect(t.calls.did.slice(-2)).toEqual(['register notes 1.0.0', 'upstream notes http://app-notes-web-blue:8080']);
    expect(t.running.has('app-notes-web-blue')).toBe(true);
    expect(t.running.has('app-notes-worker-green')).toBe(false);
    expect(t.state().apps.notes).toEqual({
      active: expect.objectContaining({ slot: 'blue', version: '1.0.0' }),
    });
  });

  it('says so, and leaves it running, when the old version was installed before the runner kept its manifest', async () => {
    const t = setup();
    await t.host.writeProject(
      {
        apps: {
          notes: {
            active: {
              slot: 'blue',
              version: '1.0.0',
              image: image('a'),
              storage: { database: true, bucket: false },
            },
          },
        },
      },
      {},
      {},
    );
    t.running.set('app-notes-blue', '1.0.0');
    const wait = t.host.wait;
    t.host.wait = async (ms) => {
      await wait(ms);
      if (ms === APP_WATCH_EVERY_MS) t.running.delete('app-notes-web-green');
    };
    expect(await t.run(install('1.1.0', 'b'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe(
      'Notes 1.1.0: the web part stopped answering after the switch. It didn’t go back by itself: 1.0.0 was installed before the runner kept what it needs to go back. Install 1.0.0 again from Admin → Apps.',
    );
  });

  it('keeps a version from before contract 3 running as it was until it is replaced', async () => {
    const t = setup();
    await t.host.writeProject(
      {
        apps: {
          notes: {
            active: {
              slot: 'blue',
              version: '0.9.0',
              image: image('z'),
              storage: { database: true, bucket: false },
              manifest: {
                id: 'notes',
                name: 'Notes',
                version: '0.9.0',
              } as never,
            },
          },
        },
      },
      {},
      {},
    );
    t.running.set('app-notes-blue', '0.9.0');
    t.calls.did.length = 0;
    expect(await t.run(install('1.0.0'))).toBe('done');
    // Its container is in the project as it was, its settings file left beside it, until it retires.
    expect(t.project()!.services['app-notes-blue']).toMatchObject({
      image: image('z'),
      env_file: ['./app-notes-blue.env'],
    });
    expect(t.state().apps.notes.active).toMatchObject({
      slot: 'green',
      version: '1.0.0',
    });
    t.later(RETIRE_MS);
    await t.runner.retireDue();
    expect(t.running.has('app-notes-blue')).toBe(false);
    expect(t.project()!.services).not.toHaveProperty('app-notes-blue');
  });

  it('leaves the old version serving when the new one doesn’t come up on its version', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    versionOf(t, 'c', '1.0.9');
    t.calls.did.length = 0;
    expect(await t.run(install('1.2.0', 'c'))).toBe('failed');
    expect(t.clock()).toBeGreaterThanOrEqual(120_000);
    expect(t.reports.at(-1)).toMatchObject({
      step: 'health',
      state: 'failed',
      outcome: 'failed',
      message: 'The web part of Notes came up on 1.0.9, not 1.2.0. 1.0.0 is still serving.',
    });
    expect(t.running.has('app-notes-web-green')).toBe(false);
    expect(t.running.has('app-notes-worker-green')).toBe(false);
    expect(t.state().apps.notes).toEqual({
      active: expect.objectContaining({ slot: 'blue', version: '1.0.0' }),
    });
    expect(t.calls.did.filter((d) => d.startsWith('register') || d.startsWith('upstream'))).toEqual([]);
  });

  it('puts the gateway back on the old version when the registry refuses the new one', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    t.calls.refuse();
    expect(await t.run(install('1.1.0', 'b'))).toBe('failed');
    expect(t.calls.did.at(-1)).toBe('upstream notes http://app-notes-web-blue:8080');
    expect(t.state().apps.notes.active?.version).toBe('1.0.0');
  });

  it('puts the old manifest back too when the registry takes the new one but the upstream can’t move', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    const set = t.calls.calls.setUpstream;
    t.calls.calls.setUpstream = async (app, url) => {
      if (url?.includes('green')) throw new Error('it answered 503');
      await set(app, url);
    };
    t.calls.did.length = 0;
    expect(await t.run(install('1.1.0', 'b'))).toBe('failed');
    expect(t.calls.did.slice(-3)).toEqual(['register notes 1.1.0', 'register notes 1.0.0', 'upstream notes http://app-notes-web-blue:8080']);
    expect(t.running.has('app-notes-web-green')).toBe(false);
    expect(t.state().apps.notes).toEqual({
      active: expect.objectContaining({ slot: 'blue' }),
    });
  });

  it('goes back when the switch can’t be reported, and leaves the new version running if going back fails too', async () => {
    const failingReport = (t: ReturnType<typeof setup>) => async (r: JobReport) => {
      if (r.step === 'switch' && r.state === 'done') throw new Error('it couldn’t be reached');
      t.reports.push(r);
    };
    const t = setup();
    await t.run(install('1.0.0'));
    expect(await t.runner.run(install('1.1.0', 'b'), failingReport(t))).toBe('failed');
    expect(t.calls.did.slice(-2)).toEqual(['register notes 1.0.0', 'upstream notes http://app-notes-web-blue:8080']);
    expect(t.running.has('app-notes-web-green')).toBe(false);
    expect(t.state().apps.notes).toEqual({
      active: expect.objectContaining({ slot: 'blue' }),
    });

    // With the registry away the gateway stays on the new version, so stopping it would take the app down.
    const set = t.calls.calls.setUpstream;
    t.calls.calls.setUpstream = async (app, url) => {
      if (url?.includes('blue')) throw new Error('it couldn’t be reached');
      await set(app, url);
    };
    // The job isn't ended: the next turn finds it running and goes back from the state.
    await expect(t.runner.run(install('1.1.0', 'b'), failingReport(t))).rejects.toThrow(/Going back to 1\.0\.0 didn’t work either, so app-notes-web-green, app-notes-worker-green, app-notes-migrate-green are still running/);
    expect(t.running.has('app-notes-web-green')).toBe(true);
    expect(t.state().apps.notes.retiring).toMatchObject({ slot: 'green' });
    expect(t.state().apps.notes.retiring?.until).toBeUndefined();
    t.calls.calls.setUpstream = set;
    expect(await t.run({ ...install('1.1.0', 'b'), state: 'running' })).toBe('failed');
    expect(t.running.has('app-notes-web-green')).toBe(false);
    expect(t.calls.did.at(-1)).toBe('upstream notes http://app-notes-web-blue:8080');
    expect(t.state().apps.notes).toEqual({ active: expect.objectContaining({ slot: 'blue' }) });
  });

  it('takes a backup before the first release from another repository, and not for the next ones', async () => {
    const own = {
      signer: {
        repository: 'o/notes',
        workflow: '.github/workflows/release.yml',
      },
    };
    const t = setup(`${ENV.replace('APP_PUBLISHERS=o/r', 'APP_PUBLISHERS=o/r o/notes')}`);
    versionOf(t, 'c', '1.2.0');
    versionOf(t, 'd', '1.3.0');
    expect(await t.run(install('1.0.0'))).toBe('done');
    expect(t.did).not.toContain('backup');

    // Notes moves to another repository: its data passes to that repository's release, so a backup comes first.
    expect(await t.run(install('1.2.0', 'c', own))).toBe('done');
    expect(t.did.filter((d) => d === 'backup')).toHaveLength(1);
    expect(t.reports.find((r) => r.step === 'verify' && r.state === 'done' && r.message)?.message).toBe(
      'Signed in o/notes, where notes now comes from. Backup platform-20261030-0100.sql.gz taken first.',
    );
    expect(t.state().apps.notes.active).toMatchObject({
      version: '1.2.0',
      repository: 'o/notes',
    });

    // From then on it's an ordinary update.
    expect(await t.run(install('1.3.0', 'd', own))).toBe('done');
    expect(t.did.filter((d) => d === 'backup')).toHaveLength(1);
  });

  it('runs only what a publisher in APP_PUBLISHERS signed, every part’s image', async () => {
    const t = setup();
    const stranger = install('1.0.0', 'a', {
      signer: { repository: 'x/y', workflow: '.github/workflows/release.yml' },
    });
    expect(await t.run(stranger)).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe('x/y/.github/workflows/release.yml isn’t trusted to publish apps on this server. Add it to APP_PUBLISHERS in .env to trust it.');
    t.unsigned.add(image('a', 'worker'));
    expect(await t.run(install('1.0.0'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/^worker’s image isn’t signed by o\/r/);
    expect(t.did.some((d) => d.startsWith('start') || d.startsWith('storage'))).toBe(false);
    const trusting = setup(`${ENV}APP_PUBLISHERS=x/y\n`);
    expect(await trusting.run(stranger)).toBe('done');
    // Without APP_PUBLISHERS nobody is trusted.
    const none = setup(ENV.replace('APP_PUBLISHERS=o/r\n', ''));
    expect(await none.run(install('1.0.0'))).toBe('failed');
    expect(none.reports.at(-1)?.message).toMatch(/isn’t trusted to publish apps on this server/);
  });

  it('fetches the release’s frontend bundle by digest, checks it, and gives it to the registry before the manifest (spec 3.3)', async () => {
    const t = setup();
    expect(await t.run(install('1.0.0'))).toBe('done');
    expect(t.did.filter((d) => d === `verify ${releaseIdentity(PUBLISHER_WORKFLOW)}`)).toHaveLength(3);
    expect(t.did).toContain('fetch notes-frontend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa application/vnd.augur.frontend.v1.tar+gzip');
    const kept = t.calls.did.indexOf(`frontend notes 1.0.0 ${FRONTEND_DIGEST.slice(7, 19)}`);
    expect(kept).toBeGreaterThan(-1);
    expect(kept).toBeLessThan(t.calls.did.indexOf('register notes 1.0.0'));
    // The frontend is fetched once the images are trusted, never before.
    expect(t.did.indexOf('fetch notes-frontend@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa application/vnd.augur.frontend.v1.tar+gzip')).toBeGreaterThan(t.did.findIndex((d) => d.startsWith('verify')));
  });

  it('refuses a frontend bundle that isn’t signed, or isn’t the one the release names, before anything starts', async () => {
    const t = setup();
    t.unsigned.add(`ghcr.io/o/r/notes-frontend@sha256:${'a'.repeat(64)}`);
    expect(await t.run(install('1.0.0'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/^The frontend bundle isn’t signed by o\/r/);
    const swapped = setup();
    swapped.artifacts.set(`ghcr.io/o/r/notes-frontend@sha256:${'a'.repeat(64)}`, Buffer.from('not the bundle'));
    expect(await swapped.run(install('1.0.0'))).toBe('failed');
    expect(swapped.reports.at(-1)?.message).toBe(`The frontend bundle at ghcr.io/o/r/notes-frontend@sha256:${'a'.repeat(64)} isn’t the one the release names (${FRONTEND_DIGEST}).`);
    expect(swapped.did.some((d) => d.startsWith('start') || d.startsWith('storage'))).toBe(false);
  });

  it('goes back when the registry won’t keep the frontend, as when it refuses the manifest', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    t.calls.refuseFrontend();
    expect(await t.run(install('1.1.0', 'b'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/^The registry didn’t keep notes 1\.1\.0’s frontend: it answered 501, This deployment doesn’t keep apps’ frontends by version/);
    expect(t.state().apps.notes.active).toMatchObject({ version: '1.0.0' });
    // Found before anything of the new version ran.
    expect(t.did.filter((d) => d.startsWith('start') || d.startsWith('storage') || d.startsWith('backup'))).toHaveLength(3);
  });

  it('needs APP_SECRETS_KEY', async () => {
    const t = setup('PLATFORM_URL=https://augur.example\nAPP_PUBLISHERS=o/r\n');
    expect(await t.run(install('1.0.0'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/APP_SECRETS_KEY is not set/);
  });

  it('removes an app’s containers and forgets where it was', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    expect(
      await t.run({
        id: 'r',
        app: 'notes',
        action: 'remove',
        state: 'requested',
      }),
    ).toBe('done');
    expect(t.running.size).toBe(0);
    expect(t.state().apps).toEqual({});
    expect(t.calls.did.at(-1)).toBe('upstream notes null');
  });

  it('goes back from the state when it can’t go back after the watch, and never stops the version serving', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    const wait = t.host.wait;
    t.host.wait = async (ms) => {
      await wait(ms);
      if (ms === APP_WATCH_EVERY_MS) t.running.delete('app-notes-web-green');
    };
    const set = t.calls.calls.setUpstream;
    t.calls.calls.setUpstream = async (app, url) => {
      if (url?.includes('blue')) throw new Error('it couldn’t be reached');
      await set(app, url);
    };
    await expect(t.run(install('1.1.0', 'b'))).rejects.toThrow(/Going back to 1\.0\.0 didn’t work yet/);
    // Written as a switch not finished: the old version active, the new one retiring with no end, so nothing stops the old.
    expect(t.state().apps.notes.active).toMatchObject({ slot: 'blue' });
    expect(t.state().apps.notes.retiring).toMatchObject({ slot: 'green' });
    expect(t.state().apps.notes.retiring?.until).toBeUndefined();
    t.later(RETIRE_MS * 2);
    await t.runner.retireDue();
    expect(t.running.has('app-notes-web-blue')).toBe(true);
    t.calls.calls.setUpstream = set;
    expect(await t.run({ ...install('1.1.0', 'b'), state: 'running' })).toBe('failed');
    expect(t.calls.did.slice(-2)).toEqual(['register notes 1.0.0', 'upstream notes http://app-notes-web-blue:8080']);
    expect(t.running.has('app-notes-worker-green')).toBe(false);
  });

  it('says what serves when it restarted while watching', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    await t.run(install('1.1.0', 'b'));
    const now = t.state();
    now.apps.notes.retiring!.until = '2026-10-27T12:15:00.000Z';
    await t.host.writeProject(now, {}, {});
    t.calls.did.length = 0;
    expect(await t.run({ ...install('1.1.0', 'b'), state: 'running' })).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe('The app runner restarted while watching 1.1.0. 1.1.0 is serving, without the rest of its watch; 1.0.0 keeps running until 12:15 UTC, and Admin → Apps can go back to it.');
    expect(t.calls.did).toEqual([]);
    expect(t.running.has('app-notes-web-green')).toBe(true);
  });

  describe('restarting around a switch', () => {
    /** As if it had started green, and may or may not have switched to it, before it stopped. */
    const stopped = async (t: ReturnType<typeof setup>) => {
      const candidate: RunningApp = {
        slot: 'green',
        version: '1.1.0',
        parts: release('1.1.0', 'b').parts,
        manifest: release('1.1.0', 'b').manifest,
        repository: 'o/r',
      };
      await t.host.writeProject({ apps: { notes: { ...t.state().apps.notes, retiring: candidate } } }, {}, {});
      t.running.set('app-notes-web-green', '1.1.0');
      t.running.set('app-notes-worker-green', '1.1.0');
      t.calls.did.length = 0;
    };
    const again: AppJob = { ...install('1.1.0', 'b'), state: 'running' };

    it('puts the old version’s manifest and upstream back before it stops the new one', async () => {
      const t = setup();
      await t.run(install('1.0.0'));
      await stopped(t);
      const set = t.calls.calls.setUpstream;
      t.calls.calls.setUpstream = async (app, url) => {
        expect(t.running.has('app-notes-web-green')).toBe(true);
        await set(app, url);
      };
      expect(await t.run(again)).toBe('failed');
      expect(t.calls.did).toEqual(['register notes 1.0.0', 'upstream notes http://app-notes-web-blue:8080']);
      expect(t.running.has('app-notes-web-green')).toBe(false);
      expect(t.running.has('app-notes-worker-green')).toBe(false);
      expect(t.state().apps.notes).toEqual({
        active: expect.objectContaining({ slot: 'blue' }),
      });
    });

    it('forgets the upstream of a first install, which has nothing to go back to', async () => {
      const t = setup();
      await stopped(t);
      expect(await t.run(again)).toBe('failed');
      expect(t.calls.did).toEqual(['upstream notes null']);
      expect(t.running.size).toBe(0);
      expect(t.state().apps).toEqual({});
    });

    it('stops nothing while the gateway can’t be moved, and tries again on the next turn', async () => {
      const t = setup();
      await t.run(install('1.0.0'));
      await stopped(t);
      const set = t.calls.calls.setUpstream;
      t.calls.calls.setUpstream = async () => {
        throw new Error('it couldn’t be reached');
      };
      await expect(t.run(again)).rejects.toThrow('it couldn’t be reached');
      expect(t.running.has('app-notes-web-green')).toBe(true);
      expect(t.state().apps.notes.retiring).toMatchObject({ slot: 'green' });
      expect(t.reports.at(-1)?.outcome).toBe('done');

      t.calls.calls.setUpstream = set;
      expect(await t.run(again)).toBe('failed');
      expect(t.running.has('app-notes-web-green')).toBe(false);
      expect(t.calls.did.at(-1)).toBe('upstream notes http://app-notes-web-blue:8080');
    });
  });
});

describe('settings and previews', () => {
  it('reads APP_PUBLISHERS as repositories or workflows', () => {
    expect(publishersFrom('o/r, a/b/.github/workflows/ship.yml')).toEqual(['o/r/.github/workflows/release.yml', 'a/b/.github/workflows/ship.yml']);
  });

  it('prefers secrets named in .env, as the storage container does', async () => {
    const t = setup(`${ENV}NOTES_DATABASE_PASSWORD=named-password\n`);
    expect(await t.run(install('1.0.0'))).toBe('done');
    expect(t.files()['files/app-notes-web-blue/1']).toBe('named-password');
  });

  it('caps the database login at APP_DATABASE_CONNECTIONS, and refuses parts that ask for more between them', async () => {
    const t = setup(`${ENV}APP_DATABASE_CONNECTIONS=12\n`);
    expect(await t.run(install('1.0.0'))).toBe('done');
    expect(t.did).toContain('storage notes (12 connections)');
    const greedy = setup(`${ENV}APP_DATABASE_CONNECTIONS=12\n`);
    expect(await greedy.run(install('1.0.0', 'a', {}, (p) => (p[2]!.resources!.db!.params = { connections: 5 })))).toBe('failed');
    expect(greedy.reports.at(-1)?.message).toBe('The parts ask for 15 database connections between them (web 10, migrate 5), above this deployment’s 12 per app (APP_DATABASE_CONNECTIONS in .env).');
  });

  it('puts an app’s parts on a network of its own, which the gateway joins, and the stores only for an app granted them (spec 4.8, 10.4)', async () => {
    const t = setup();
    expect(await t.run(install('1.0.0'))).toBe('done');
    expect(t.project()!.networks).toEqual({ 'app-notes': { external: true, name: 'app-notes' } });
    // The example asks for the database, the bucket and telemetry; the network was there before any part ran.
    expect(t.networks()).toEqual([{ app: 'notes', name: 'app-notes', join: ['gateway', 'postgres', 'garage', 'otel-lgtm'] }]);
    expect(t.missing()).toEqual([]);

    // Parts that ask only for the gateway get the gateway and nothing else.
    const r = release('1.0.0');
    const bare: ScorePart[] = r.parts.map((p) => ({ ...p, resources: Object.fromEntries(Object.entries(p.resources ?? {}).filter(([, x]) => x.type === 'augur-gateway')) }));
    expect(appNetworksOf({ apps: { notes: { active: { slot: 'blue', version: '1.0.0', parts: bare, manifest: r.manifest } } } }, ENV)).toEqual([{ app: 'notes', name: 'app-notes', join: ['gateway'] }]);
  });

  it('leaves the collector off an app’s network when the deployment sends telemetry elsewhere, and says nothing to send to', async () => {
    const t = setup(`${ENV}OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.example:4318\n`);
    expect(await t.run(install('1.0.0'))).toBe('done');
    expect(t.networks()[0]!.join).toEqual(['gateway', 'postgres', 'garage']);
    expect(t.project()!.services['app-notes-web-blue']!.environment).toMatchObject({ OTEL_EXPORTER_OTLP_ENDPOINT: '' });
  });

  it('takes an app’s network away with its last version, and keeps it while a preview runs', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    expect(await t.run({ id: 'r', app: 'notes', action: 'remove', state: 'requested' })).toBe('done');
    expect(t.networks()).toEqual([]);
    const r = release('1.1.0-pr.12.1', 'd');
    const previewOnly: RunnerState = { apps: {}, previews: { 'notes-pr12': { app: 'notes', pr: 12, version: r.version, parts: r.parts, manifest: r.manifest } } };
    expect(appNetworksOf(previewOnly, ENV)).toEqual([{ app: 'notes', name: 'app-notes', join: ['gateway', 'postgres', 'garage', 'otel-lgtm'] }]);
  });

  it('keeps the gateway and stores on the apps’ networks every turn, as a platform upgrade gives them new containers', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    const before = t.networkCalls();
    await t.runner.keepNetworks();
    expect(t.networkCalls()).toBe(before + 1);
    expect(t.networks()).toEqual([{ app: 'notes', name: 'app-notes', join: ['gateway', 'postgres', 'garage', 'otel-lgtm'] }]);
  });

  it('keeps containers from before contract 3 on the platform’s network, unless APPS_NETWORK names one', () => {
    const legacy: RunnerState = { apps: { old: { active: { slot: 'blue', version: '1.0.0', image: 'ghcr.io/o/old@sha256:' + 'a'.repeat(64) } } } };
    expect(appsProject(legacy, ENV, 'net').project.networks).toEqual({ platform: { external: true, name: 'net' } });
    expect(appsProject({ apps: {} }, ENV, 'net').project.networks).toBeUndefined();
  });

  it('runs a pull request’s build beside the app, signed in as it with scratch storage, and replaces it in place', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    t.did.length = 0;
    t.calls.did.length = 0;
    versionOf(t, 'd', '1.1.0-pr.12.1');
    versionOf(t, 'e', '1.1.0-pr.12.2');
    const signer = {
      signer: {
        repository: 'o/r',
        workflow: '.github/workflows/app-preview.yml',
      },
    };
    const preview = (version: string, c: string): AppJob => ({
      id: `p-${version}`,
      app: 'notes',
      action: 'preview',
      pr: 12,
      release: release(version, c, signer),
      state: 'requested',
    });
    // The app's release workflow doesn't make previews.
    expect(
      await t.run({
        ...preview('1.1.0-pr.12.1', 'd'),
        release: release('1.1.0-pr.12.1', 'd'),
      }),
    ).toBe('failed');
    t.did.length = 0;
    expect(await t.run(preview('1.1.0-pr.12.1', 'd'))).toBe('done');
    const verify = 'verify https://github.com/o/r/.github/workflows/app-preview.yml@refs/pull/12/merge';
    const fetch = 'fetch notes-frontend@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd application/vnd.augur.frontend.v1.tar+gzip';
    expect(t.did).toEqual([verify, verify, verify, fetch, 'storage notes-pr12 (30 connections)', 'job app-notes-migrate-pr12', 'start app-notes-web-pr12', 'start app-notes-worker-pr12']);
    // Never registered, never the app's upstream: the registry sends only its developers to it. Its frontend is kept under the build's version.
    expect(t.calls.did).toEqual([`frontend notes 1.1.0-pr.12.1 ${FRONTEND_DIGEST.slice(7, 19)}`]);
    expect(t.reports.at(-1)).toMatchObject({
      step: 'switch',
      outcome: 'done',
      upstream: 'http://app-notes-web-pr12:8080',
    });
    // Signed in as the app, with storage of its own.
    expect(t.files()['files/app-notes-web-pr12/0']).toBe(SECRET);
    expect(t.files()['files/app-notes-web-pr12/1']).toBe(appSecretFor(KEY, 'notes-pr12', 'database'));
    expect(t.project()!.services['app-notes-web-pr12']).toMatchObject({
      image: image('d'),
      cap_drop: ['ALL'],
      labels: { 'augur.preview': '12' },
      environment: expect.objectContaining({
        DATABASE_USER: 'app_notes_pr12',
        CLIENT_ID: 'app-notes',
      }),
    });
    expect(t.project()!.services['app-notes-web-pr12']!.volumes).toEqual([
      {
        type: 'volume',
        source: 'app-notes-pr12-web-scratch',
        target: '/scratch',
        read_only: false,
      },
    ]);
    expect(t.running.has('app-notes-web-blue')).toBe(true);

    t.did.length = 0;
    expect(await t.run(preview('1.1.0-pr.12.2', 'e'))).toBe('done');
    expect(t.did.slice(4, 8)).toEqual(['storage notes-pr12 (30 connections)', 'stop app-notes-web-pr12', 'stop app-notes-worker-pr12', 'stop app-notes-migrate-pr12']);
    expect(t.state().previews?.['notes-pr12']).toMatchObject({
      version: '1.1.0-pr.12.2',
    });

    t.did.length = 0;
    expect(
      await t.run({
        id: 'r-1',
        app: 'notes',
        action: 'preview-remove',
        pr: 12,
        state: 'requested',
      }),
    ).toBe('done');
    expect(t.did).toEqual(['stop app-notes-web-pr12', 'stop app-notes-worker-pr12', 'stop app-notes-migrate-pr12', 'drop notes-pr12', 'remove volumes app-notes-pr12-web-scratch app-notes-pr12-worker-maps']);
    expect(t.state().previews).toEqual({});
    expect(Object.keys(t.project()!.services)).toEqual(['app-notes-web-blue', 'app-notes-worker-blue', 'app-notes-migrate-blue']);
  });

  it('takes a preview that doesn’t come up away again, leaving the app alone', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    versionOf(t, 'f', '0.0.1');
    const signer = {
      signer: {
        repository: 'o/r',
        workflow: '.github/workflows/app-preview.yml',
      },
    };
    expect(
      await t.run({
        id: 'p-1',
        app: 'notes',
        action: 'preview',
        pr: 3,
        release: release('1.1.0-pr.3.1', 'f', signer),
        state: 'requested',
      }),
    ).toBe('failed');
    expect(t.reports.at(-1)).toMatchObject({
      step: 'health',
      outcome: 'failed',
      message: 'The web part of Notes came up on 0.0.1, not 1.1.0-pr.3.1.',
    });
    expect(t.running.has('app-notes-web-pr3')).toBe(false);
    expect(t.running.has('app-notes-web-blue')).toBe(true);
    expect(t.state().previews).toEqual({});
  });

  it('keeps a preview through the app’s installs, however they end, so it can still be taken away', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    versionOf(t, 'd', '1.1.0-pr.12.1');
    versionOf(t, 'c', '1.0.9');
    const signer = {
      signer: {
        repository: 'o/r',
        workflow: '.github/workflows/app-preview.yml',
      },
    };
    await t.run({
      id: 'p-1',
      app: 'notes',
      action: 'preview',
      pr: 12,
      release: release('1.1.0-pr.12.1', 'd', signer),
      state: 'requested',
    });

    expect(await t.run(install('1.1.0', 'b'))).toBe('done');
    expect(t.state().previews).toHaveProperty(['notes-pr12']);
    expect(t.project()!.services).toHaveProperty(['app-notes-web-pr12']);

    // A version that doesn't come up, undone.
    expect(await t.run(install('1.2.0', 'c'))).toBe('failed');
    expect(t.state().previews).toHaveProperty(['notes-pr12']);
    expect(t.project()!.services).toHaveProperty(['app-notes-web-pr12']);

    // A version that falls over after the switch, gone back from.
    versionOf(t, 'e', '1.3.0');
    const wait = t.host.wait;
    t.host.wait = async (ms) => {
      await wait(ms);
      if (ms === APP_WATCH_EVERY_MS) t.running.delete('app-notes-web-blue');
    };
    expect(await t.run(install('1.3.0', 'e'))).toBe('failed');
    expect(t.state().apps.notes.active?.version).toBe('1.1.0');
    expect(t.state().previews).toHaveProperty(['notes-pr12']);
    expect(t.project()!.services).toHaveProperty(['app-notes-web-pr12']);

    t.did.length = 0;
    expect(
      await t.run({
        id: 'r-1',
        app: 'notes',
        action: 'preview-remove',
        pr: 12,
        state: 'requested',
      }),
    ).toBe('done');
    expect(t.did.slice(-2)).toEqual(['drop notes-pr12', 'remove volumes app-notes-pr12-web-scratch app-notes-pr12-worker-maps']);
  });

  it('finishes taking away a preview the state doesn’t name, without asking Compose to stop it', async () => {
    const t = setup();
    t.host.stop = async (services) => {
      throw new Error(`no such service: ${services.join(' ')}`);
    };
    expect(
      await t.run({
        id: 'r-1',
        app: 'notes',
        action: 'preview-remove',
        pr: 3,
        state: 'requested',
      }),
    ).toBe('done');
    expect(t.did).toEqual(['drop notes-pr3']);
    expect(t.reports.at(-1)).toMatchObject({
      outcome: 'done',
      message: 'Nothing of pull request 3 was running.',
    });
  });
});
