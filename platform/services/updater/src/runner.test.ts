import { describe, expect, it } from 'vitest';
import { appSecretFor } from '@augur/service-kit';
import { appRunner, appsProject, containerEnv, publishersFrom, READY_MS, RETIRE_MS, type AppHost, type AppJob, type JobReport, type PlatformCalls, type RunnerState } from './runner.ts';

const KEY = 'k'.repeat(64);
const ENV = `PLATFORM_URL=https://augur.example\nAPP_SECRETS_KEY=${KEY}\n`;
const PUBLISHER = 'o/r/.github/workflows/release.yml';
const image = (c: string) => `ghcr.io/o/r/apps/notes@sha256:${c.repeat(64)}`;
const release = (version: string, c = 'a', more: object = {}) => ({
  id: 'notes',
  version,
  manifest: { id: 'notes', name: 'Notes', version, storage: { database: true } },
  service: { image: image(c) },
  signer: { repository: 'o/r', workflow: '.github/workflows/release.yml' },
  ...more,
});
const install = (version: string, c = 'a', more: object = {}): AppJob => ({ id: `j-${version}`, app: 'notes', action: 'install', release: release(version, c, more), state: 'requested' });

/** A server that runs whatever it's told; a container answers on the version its image was released as. */
const fakeHost = (env = ENV) => {
  let state: RunnerState = { apps: {} };
  const did: string[] = [];
  const running = new Map<string, string>();
  const versions = new Map<string, string>();
  const unsigned = new Set<string>();
  let project: ReturnType<typeof appsProject> | undefined;
  let envFiles: Record<string, string> = {};
  let clock = 0;
  const host: AppHost = {
    readEnv: async () => env,
    readState: async () => structuredClone(state),
    async writeProject(s, p, files) {
      state = structuredClone(s);
      project = p as ReturnType<typeof appsProject>;
      envFiles = files;
    },
    async verifySignedBy(ref, identity) {
      did.push(`verify ${identity}`);
      if (unsigned.has(ref)) throw new Error('no matching signatures');
    },
    async provisionStorage(app) {
      did.push(`storage ${app}`);
    },
    async start(services) {
      for (const s of services) {
        const svc = (project!.services as Record<string, { image: string }>)[s];
        running.set(s, versions.get(svc.image) ?? '');
        did.push(`start ${s}`);
      }
    },
    async stop(services) {
      for (const s of services) {
        running.delete(s);
        did.push(`stop ${s}`);
      }
    },
    async health(url) {
      const name = new URL(url).hostname;
      return running.has(name) ? { version: running.get(name) } : undefined;
    },
    async wait(ms) {
      clock += ms;
    },
  };
  return { host, did, running, versions, unsigned, state: () => state, project: () => project, envFiles: () => envFiles, clock: () => clock };
};

const fakeCalls = () => {
  const did: string[] = [];
  let refuseRegister = false;
  const calls: PlatformCalls = {
    async setCredential(app, secret) {
      did.push(`credential ${app} ${secret.slice(0, 6)}`);
    },
    async register(manifest) {
      if (refuseRegister) throw new Error('it answered 400');
      did.push(`register ${manifest.id} ${manifest.version}`);
    },
    async setUpstream(app, url) {
      did.push(`upstream ${app} ${url}`);
    },
  };
  return { calls, did, refuse: () => (refuseRegister = true) };
};

const setup = (env = ENV) => {
  const h = fakeHost(env);
  const c = fakeCalls();
  let now = new Date('2026-10-27T12:00:00Z');
  const runner = appRunner({ host: h.host, calls: c.calls, publishers: [PUBLISHER], now: () => now });
  const reports: JobReport[] = [];
  const run = (job: AppJob) => runner.run(job, async (r) => void reports.push(r));
  h.versions.set(image('a'), '1.0.0');
  h.versions.set(image('b'), '1.1.0');
  return { ...h, calls: c, runner, reports, run, later: (ms: number) => (now = new Date(now.getTime() + ms)) };
};

describe('the app runner', () => {
  it('installs an app: checks its signature, gives it storage and a sign-in, starts it, then lists it', async () => {
    const t = setup();
    expect(await t.run(install('1.0.0'))).toBe('done');
    expect(t.did).toEqual(['verify https://github.com/o/r/.github/workflows/release.yml@refs/heads/main', 'storage notes', 'start app-notes-blue']);
    expect(t.calls.did).toEqual([`credential notes ${appSecretFor(KEY, 'notes', 'sign-in').slice(0, 6)}`, 'register notes 1.0.0', 'upstream notes http://app-notes-blue:8080']);
    expect(t.state().apps.notes).toEqual({ active: { slot: 'blue', version: '1.0.0', image: image('a'), storage: { database: true, bucket: false } } });
    expect(t.reports.at(-1)).toMatchObject({ step: 'retire', outcome: 'done', message: 'Notes 1.0.0 is installed.' });
    expect(t.envFiles()['app-notes-blue']).toContain(`DATABASE_URL=postgres://app_notes:${appSecretFor(KEY, 'notes', 'database')}@postgres:5432/platform`);
    expect(t.envFiles()['app-notes-blue']).toContain('APP_REGISTERED_BY=runner');
  });

  it('upgrades blue/green, and stops the old version once its time is up', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    t.did.length = 0;
    expect(await t.run(install('1.1.0', 'b'))).toBe('done');
    expect(t.did).toContain('start app-notes-green');
    expect(t.running.has('app-notes-blue')).toBe(true);
    expect(t.state().apps.notes.active).toMatchObject({ slot: 'green', version: '1.1.0' });
    expect(t.state().apps.notes.retiring).toMatchObject({ slot: 'blue', version: '1.0.0', until: '2026-10-27T12:10:00.000Z' });
    expect(Object.keys(t.project()!.services)).toEqual(['app-notes-green', 'app-notes-blue']);
    await t.runner.retireDue();
    expect(t.running.has('app-notes-blue')).toBe(true);
    t.later(RETIRE_MS);
    await t.runner.retireDue();
    expect(t.running.has('app-notes-blue')).toBe(false);
    expect(Object.keys(t.project()!.services)).toEqual(['app-notes-green']);
  });

  it('leaves the old version serving when the new one doesn’t come up on its version', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    t.versions.set(image('c'), '1.0.9');
    t.calls.did.length = 0;
    expect(await t.run(install('1.2.0', 'c'))).toBe('failed');
    expect(t.clock()).toBeGreaterThanOrEqual(READY_MS);
    expect(t.reports.at(-1)).toMatchObject({ step: 'health', state: 'failed', outcome: 'failed', message: 'Notes came up on 1.0.9, not 1.2.0. 1.0.0 is still serving.' });
    expect(t.running.has('app-notes-green')).toBe(false);
    expect(t.state().apps.notes).toEqual({ active: expect.objectContaining({ slot: 'blue', version: '1.0.0' }) });
    expect(t.calls.did.filter((d) => d.startsWith('register') || d.startsWith('upstream'))).toEqual([]);
  });

  it('puts the gateway back on the old version when the registry refuses the new one', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    t.calls.refuse();
    expect(await t.run(install('1.1.0', 'b'))).toBe('failed');
    expect(t.calls.did.at(-1)).toBe('upstream notes http://app-notes-blue:8080');
    expect(t.state().apps.notes.active?.version).toBe('1.0.0');
  });

  it('runs only what a trusted publisher signed', async () => {
    const t = setup();
    const stranger = install('1.0.0', 'a', { signer: { repository: 'x/y', workflow: '.github/workflows/release.yml' } });
    expect(await t.run(stranger)).toBe('failed');
    expect(t.reports.at(-1)?.message).toBe('x/y/.github/workflows/release.yml isn’t trusted to publish apps on this server. Add it to APP_PUBLISHERS in .env to trust it.');
    t.unsigned.add(image('a'));
    expect(await t.run(install('1.0.0'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/isn’t signed by o\/r/);
    expect(t.did.some((d) => d.startsWith('start'))).toBe(false);
    const trusting = setup(`${ENV}APP_PUBLISHERS=x/y\n`);
    expect(await trusting.run(stranger)).toBe('done');
  });

  it('needs APP_SECRETS_KEY', async () => {
    const t = setup('PLATFORM_URL=https://augur.example\n');
    expect(await t.run(install('1.0.0'))).toBe('failed');
    expect(t.reports.at(-1)?.message).toMatch(/APP_SECRETS_KEY is not set/);
  });

  it('removes an app’s containers and forgets where it was', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    expect(await t.run({ id: 'r', app: 'notes', action: 'remove', state: 'requested' })).toBe('done');
    expect(t.running.size).toBe(0);
    expect(t.state().apps).toEqual({});
    expect(t.calls.did.at(-1)).toBe('upstream notes null');
  });

  it('cleans up after a job it was partway through when it restarted', async () => {
    const t = setup();
    await t.run(install('1.0.0'));
    // As if it had started green and then stopped.
    await t.host.writeProject({ apps: { notes: { ...t.state().apps.notes, retiring: { slot: 'green', version: '1.1.0', image: image('b'), storage: { database: true, bucket: false } } } } }, {}, {});
    t.running.set('app-notes-green', '1.1.0');
    expect(await t.run({ ...install('1.1.0', 'b'), state: 'running' })).toBe('failed');
    expect(t.running.has('app-notes-green')).toBe(false);
    expect(t.state().apps.notes).toEqual({ active: expect.objectContaining({ slot: 'blue' }) });
  });
});

describe('settings', () => {
  it('reads APP_PUBLISHERS as repositories or workflows', () => {
    expect(publishersFrom('o/r, a/b/.github/workflows/ship.yml')).toEqual(['o/r/.github/workflows/release.yml', 'a/b/.github/workflows/ship.yml']);
  });

  it('prefers secrets named in .env, as the storage container does', () => {
    const env = containerEnv(`${ENV}TEAM_NOTES_BUCKET_SECRET=${'b'.repeat(64)}\n`, 'team-notes', { database: false, bucket: true });
    expect(env.S3_SECRET_ACCESS_KEY).toBe('b'.repeat(64));
    expect(env.S3_BUCKET).toBe('team-notes');
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.OIDC_ISSUER).toBe('https://augur.example/sso/realms/platform');
  });

  it('puts every container on the platform’s network with no added powers', () => {
    const project = appsProject({ apps: { notes: { active: { slot: 'blue', version: '1.0.0', image: image('a'), storage: { database: false, bucket: false } } } } }, 'net');
    expect(project.networks).toEqual({ platform: { external: true, name: 'net' } });
    expect(project.services['app-notes-blue']).toMatchObject({ image: image('a'), cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'], env_file: ['./app-notes-blue.env'] });
  });
});
