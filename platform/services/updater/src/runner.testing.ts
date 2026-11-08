/**
 * The spec's example app (appendix A) as contract 3 releases, built the way an app's release workflow
 * builds them (app-tools' fixtures and release writer), and a fake server the runner drives in tests.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { appRelease2, type AppRelease2 } from '@augur/app-tools/release2';
import { parseWorkload, type ScorePart } from '@augur/app-tools/validate';
import { appRunner, type AppHost, type AppJob, type JobReport, type JobRun, type PlatformCalls, type RunnerState } from './runner.ts';

const require = createRequire(import.meta.url);
const tools = dirname(require.resolve('@augur/app-tools/package.json'));
const fixture = (path: string) => readFileSync(join(tools, 'fixtures', 'notes', path), 'utf8');

export const KEY = 'k'.repeat(64);
export const ENV = `PLATFORM_URL=https://augur.example\nAPP_SECRETS_KEY=${KEY}\nAPP_PUBLISHERS=o/r\n`;
export const PUBLISHER = 'o/r/.github/workflows/release.yml';
/** A part's image in version `c`: web and migrate share one, as in the example. */
export const image = (c: string, part = 'web') => `ghcr.io/o/r/notes${part === 'worker' ? '-worker' : ''}@sha256:${c.repeat(64)}`;

export const examplePart = (name: string): ScorePart => parseWorkload(fixture(`score/${name}.score.yaml`));

/** The example's release in `version`, its images in version `c`; `change` changes its parts first, `more` replaces top-level fields after. */
export const release = (version: string, c = 'a', more: Partial<AppRelease2> = {}, change?: (parts: ScorePart[]) => void): AppRelease2 => {
  const parts = ['web', 'worker', 'migrate'].map(examplePart);
  change?.(parts);
  const r = appRelease2({
    manifest: { ...JSON.parse(fixture('manifest.json')), version },
    parts,
    bundle: {
      frontend: {
        artifact: `ghcr.io/o/r/notes-frontend@sha256:${c.repeat(64)}`,
        digest: `sha256:${'f'.repeat(64)}`,
      },
      images: Object.fromEntries(parts.map((p) => [p.metadata.name, image(c, p.metadata.name)])),
      channel: 'stable',
    },
    signer: { repository: 'o/r', workflow: '.github/workflows/release.yml' },
    releasedAt: '2026-11-08T12:00:00Z',
  });
  return { ...r, ...more };
};
export const install = (version: string, c = 'a', more: Partial<AppRelease2> = {}, change?: (parts: ScorePart[]) => void): AppJob => ({
  id: `j-${version}`,
  app: 'notes',
  action: 'install',
  release: release(version, c, more, change),
  state: 'requested',
});

type Project = {
  name: string;
  services: Record<string, Record<string, unknown> & { image: string }>;
  networks: { platform: { name: string } };
  volumes?: Record<string, object>;
  secrets?: Record<string, { file: string }>;
};

/** A server that runs whatever it's told; a container answers on the version its image was released as. */
export const fakeHost = (env = ENV, network?: string) => {
  let state: RunnerState = { apps: {} };
  const did: string[] = [];
  const running = new Map<string, string>();
  const versions = new Map<string, string>();
  const unsigned = new Set<string>();
  const users = new Map<string, string>();
  const jobs = new Map<string, JobRun>();
  const health: string[] = [];
  let project: Project | undefined;
  let files: Record<string, string | Uint8Array> = {};
  let clock = 0;
  const host: AppHost = {
    readEnv: async () => env,
    platformNetwork: async () => network,
    ownNetworks: async () => ['172.18.0.0/16'],
    readState: async () => structuredClone(state),
    async writeProject(s, p, f) {
      state = structuredClone(s);
      project = p as Project;
      files = f;
    },
    async verifySignedBy(ref, identity) {
      did.push(`verify ${identity}`);
      if (unsigned.has(ref)) throw new Error('no matching signatures');
    },
    imageUser: async (ref) => users.get(ref) ?? '10001',
    async backup() {
      did.push('backup');
      return 'platform-20261030-0100.sql.gz';
    },
    async provisionStorage(app, options) {
      did.push(`storage ${app}${options?.connections ? ` (${options.connections} connections)` : ''}`);
    },
    async dropStorage(id) {
      did.push(`drop ${id}`);
    },
    async start(services) {
      for (const s of services) {
        const svc = project!.services[s]!;
        running.set(s, versions.get(svc.image) ?? '');
        did.push(`start ${s}`);
      }
    },
    async runJob(service) {
      did.push(`job ${service}`);
      return jobs.get(service) ?? { code: 0, logs: 'migrated\n' };
    },
    async stop(services) {
      for (const s of services) {
        running.delete(s);
        did.push(`stop ${s}`);
      }
    },
    async health(url) {
      health.push(url);
      const name = new URL(url).hostname;
      return running.has(name) ? { version: running.get(name) } : undefined;
    },
    async wait(ms) {
      clock += ms;
    },
  };
  return {
    host,
    did,
    running,
    versions,
    unsigned,
    users,
    jobs,
    health,
    state: () => state,
    project: () => project,
    files: () => files,
    clock: () => clock,
  };
};

export const fakeCalls = () => {
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

export const setup = (env = ENV, network?: string) => {
  const h = fakeHost(env, network);
  const c = fakeCalls();
  let now = new Date('2026-10-27T12:00:00Z');
  const runner = appRunner({ host: h.host, calls: c.calls, now: () => now });
  const reports: JobReport[] = [];
  const run = (job: AppJob) => runner.run(job, async (r) => void reports.push(r));
  for (const [c, v] of [
    ['a', '1.0.0'],
    ['b', '1.1.0'],
  ] as const)
    for (const part of ['web', 'worker']) h.versions.set(image(c, part), v);
  return {
    ...h,
    calls: c,
    runner,
    reports,
    run,
    later: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
};
