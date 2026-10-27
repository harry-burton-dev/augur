import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runUpgrade, Withdrawn, type Report, type Server, type Target } from './upgrade.ts';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const image = (service: string, digest: string) => `ghcr.io/o/r/${service}@sha256:${digest}`;
const target = (more: Partial<Target> = {}): Target => ({
  id: 'up-1',
  from: '0.2.0',
  version: '0.3.0',
  state: 'requested',
  images: { storage: image('storage', 's3'), identity: image('identity', 'i3'), registry: image('registry', 'r3'), web: image('web', 'w3'), updater: image('updater', 'u3') },
  parts: { '@augur/identity': '0.4.0', '@augur/registry': '0.5.0', '@augur/shell': '0.6.0' },
  required: ['PLATFORM_VERSION', 'PLATFORM_URL'],
  deploy: { 'compose.yml': hash('c0') },
  ...more,
});

/** A server that does what it's told, and remembers it; `breaks` makes one thing go wrong. */
type Breaks = 'sign' | 'backup' | 'restore' | 'digest' | 'registry' | 'storage' | 'worker' | 'rollBack' | 'oldUpdater' | 'edited' | 'badFile';
const fakeServer = (breaks: Partial<Record<Breaks, boolean>> = {}) => {
  const did: string[] = [];
  // The deploy folder, as the running release (0.2.0) left it, unless it's been edited; and the next release's.
  const disk: Record<string, string | undefined> = { 'compose.yml': breaks.edited ? 'c0, edited' : 'c0', 'keycloak/realm.json': 'k0' };
  const own: Record<string, string> = { 'compose.yml': 'c0', 'keycloak/realm.json': 'k0' };
  const next: Record<string, string> = { 'compose.yml': breaks.badFile ? 'c1, not as released' : 'c1', 'keycloak/realm.json': 'k1', 'search.yml': 's1' };
  const read = (from: Record<string, string | undefined>, paths: string[]) => Object.fromEntries(paths.map((p) => [p, from[p] === undefined ? undefined : Buffer.from(from[p]!)]));
  let env = 'PLATFORM_VERSION=0.2.0\nPLATFORM_URL=https://augur.example.org\n';
  const versions: Record<string, string> = { identity: '0.3.0', registry: '0.4.0', folio: '0.1.0', web: '' };
  const newVersions: Record<string, string> = { identity: '0.4.0', registry: breaks.registry ? '0.4.0' : '0.5.0', folio: '0.2.0', web: '' };
  const oldVersions = { ...versions };
  let rolledBack = false;
  const server: Server = {
    readEnv: async () => env,
    writeEnv: async (text) => {
      env = text;
      did.push(`env ${/PLATFORM_VERSION=(\S+)/.exec(text)?.[1]}`);
    },
    hashDeployFiles: async (paths) => Object.fromEntries(paths.map((p) => [p, disk[p] === undefined ? undefined : hash(disk[p]!)])),
    ownDeployHashes: async (paths) => (breaks.oldUpdater ? undefined : Object.fromEntries(paths.map((p) => [p, own[p] === undefined ? undefined : hash(own[p])]))),
    readDeployFiles: async (paths) => read(disk, paths),
    releaseDeployFiles: async (ref, paths) => {
      did.push(`files from ${ref}`);
      return read(next, paths);
    },
    writeDeployFiles: async (files) => {
      for (const [path, bytes] of Object.entries(files)) disk[path] = bytes?.toString();
      did.push(`write ${Object.keys(files).join(' ')}`);
    },
    // The new compose.yml (c1) adds search.
    services: async () => ['postgres', 'keycloak', 'storage', 'identity', 'registry', 'web', 'updater', 'docker-proxy', ...(disk['compose.yml'] === 'c1' ? ['search'] : [])],
    mounting: async (paths) => (paths.includes('keycloak/realm.json') ? ['keycloak'] : []),
    recreate: async (services) => void did.push(`recreate ${services.join(' ')}`),
    remove: async (services) => void did.push(`remove ${services.join(' ')}`),
    verifySignature: async (ref) => {
      did.push(`verify ${ref}`);
      if (breaks.sign && ref.includes('/web@')) throw new Error('no matching signatures');
    },
    backup: async () => {
      if (breaks.backup) throw new Error('pg_dumpall: connection refused');
      did.push('backup');
      return 'platform-2026-10-23T120000Z.sql.gz';
    },
    restoreTest: async () => {
      if (breaks.restore) throw new Error('These tables did not come back: registry.apps.');
      did.push('restore-test');
    },
    pull: async (services, version) => void did.push(`pull ${services.join(' ')} ${version}`),
    digests: async (service) => [breaks.digest && service === 'registry' ? image(service, 'other') : `ghcr.io/o/r/${service}@sha256:${service[0]}3`],
    up: async (services) => {
      const onNew = env.includes('PLATFORM_VERSION=0.3.0');
      if (!onNew && breaks.rollBack) throw new Error('docker: no such image');
      if (!onNew) rolledBack = true;
      for (const s of services) versions[s] = onNew ? newVersions[s] : oldVersions[s];
      did.push(`up ${services.join(' ')}`);
    },
    health: async (service) => ({ version: versions[service] }),
    exitCode: async (service) => {
      const onNew = env.includes('PLATFORM_VERSION=0.3.0');
      // A worker runs on (no exit code) unless it fell over.
      if (service === 'folio-worker') return breaks.worker && onNew ? 1 : undefined;
      return breaks.storage && service === 'storage' && onNew ? 1 : 0;
    },
    wait: async () => {},
  };
  return { server, did, disk, env: () => env, rolledBack: () => rolledBack };
};

const run = async (t: Target, server: Server) => {
  const reports: Report[] = [];
  const outcome = await runUpgrade(t, server, async (r) => void reports.push(r));
  return { outcome, reports, steps: reports.map((r) => `${r.step} ${r.state}${r.outcome ? ` → ${r.outcome}` : ''}`), last: reports.at(-1)! };
};

describe('an upgrade', () => {
  it('checks, backs up, pulls, then restarts each part in order on the new release', async () => {
    const fake = fakeServer();
    const { outcome, steps, last, reports } = await run(target(), fake.server);
    expect(outcome).toBe('done');
    expect(steps).toEqual(['preflight running', 'preflight done', 'backup running', 'backup done', 'pull running', 'pull done', 'roll-forward running', 'roll-forward done', 'verify running', 'verify done → done']);
    expect(reports.find((r) => r.step === 'backup' && r.state === 'done')?.message).toBe('platform-2026-10-23T120000Z.sql.gz, restored and checked');
    expect(last.message).toBe('Running AUGUR 0.3.0.');
    expect(fake.did.filter((d) => !d.startsWith('verify'))).toEqual(['backup', 'restore-test', 'pull storage identity registry web updater 0.3.0', 'env 0.3.0', 'up postgres keycloak', 'up storage', 'up identity', 'up registry', 'up web']);
    expect(fake.did.filter((d) => d.startsWith('verify'))).toHaveLength(5);
    expect(fake.env()).toContain('PLATFORM_URL=https://augur.example.org');
  });

  it('restarts the apps that ship with AUGUR too, on the version the release gives them', async () => {
    const shipped = target({
      images: { ...target().images, folio: image('folio', 'f3'), 'folio-worker': image('folio-worker', 'f3') },
      // Folio's service, as the release names it (@apps/<id>).
      parts: { ...target().parts, [`@apps/${'folio'}`]: '0.2.0' },
    });
    const fake = fakeServer();
    expect((await run(shipped, fake.server)).outcome).toBe('done');
    expect(fake.did.filter((d) => d.startsWith('up '))).toEqual(['up postgres keycloak', 'up storage', 'up identity', 'up registry', 'up folio', 'up folio-worker', 'up web']);
    const { outcome, last } = await run(shipped, fakeServer({ worker: true }).server);
    expect(outcome).toBe('rolled-back');
    expect(last.message).toContain('folio-worker stopped (exit code 1)');
  });

  it('verifies images where the deployment pulls them from', async () => {
    const fake = fakeServer();
    await fake.server.writeEnv('PLATFORM_VERSION=0.2.0\nPLATFORM_URL=x\nPLATFORM_IMAGES=registry.example.org/augur\n');
    await run(target(), fake.server);
    expect(fake.did).toContain('verify registry.example.org/augur/web@sha256:w3');
  });

  it.each([
    ['the server runs another version', target({ from: '0.1.0' }), {}, 'The server’s settings say it runs 0.2.0, not 0.1.0.'],
    ['the release changes the deploy files and the updater can’t write them', target({ deploy: { 'compose.yml': hash('c1') } }), { oldUpdater: true }, 'AUGUR 0.3.0 changes the server’s own files (compose.yml), and this updater can’t write them'],
    ['a deploy file the release changes was edited on the server', target({ deploy: { 'compose.yml': hash('c1') } }), { edited: true }, 'compose.yml has been changed on the server since AUGUR 0.2.0'],
    ['the release’s updater carries other deploy files than it says', target({ deploy: { 'compose.yml': hash('c1') } }), { badFile: true }, 'carries compose.yml other than the release file says'],
    ['the release file couldn’t be read', target({ deploy: undefined }), {}, 'release file couldn’t be read'],
    ['a required setting is missing', target({ required: ['PLATFORM_URL', 'OBJECT_STORE_URL'] }), {}, 'Set OBJECT_STORE_URL in .env first'],
    ['an image isn’t signed', target(), { sign: true }, 'The web image isn’t signed by AUGUR’s Release workflow'],
    ['the backup fails', target(), { backup: true }, 'The backup couldn’t be taken: pg_dumpall: connection refused'],
    ['the backup doesn’t restore', target(), { restore: true }, 'didn’t restore in the test'],
    ['a pulled image isn’t the release’s', target(), { digest: true }, 'The registry image pulled for 0.3.0 isn’t the one the release names'],
  ] as const)('changes nothing when %s', async (_, t, breaks, message) => {
    const fake = fakeServer(breaks);
    const { outcome, last } = await run(t, fake.server);
    expect(outcome).toBe('rolled-back');
    expect(last).toMatchObject({ state: 'failed', outcome: 'rolled-back' });
    expect(last.message).toContain('Nothing was changed.');
    expect(last.message).toContain(message);
    expect(fake.did.some((d) => d.startsWith('up') || d.startsWith('env') || d.startsWith('write'))).toBe(false);
  });

  it('goes back to the release it was on when a part doesn’t come back on the new one', async () => {
    const fake = fakeServer({ registry: true });
    const { outcome, steps, last } = await run(target(), fake.server);
    expect(outcome).toBe('rolled-back');
    expect(steps.slice(-3)).toEqual(['roll-forward failed', 'roll-back running', 'roll-back done → rolled-back']);
    expect(last.message).toBe('Back on 0.2.0: registry came back on 0.4.0, not 0.5.0. If 0.2.0 has trouble with data 0.3.0 changed, restore platform-2026-10-23T120000Z.sql.gz (docs/upgrade.md, Going back).');
    expect(fake.env()).toContain('PLATFORM_VERSION=0.2.0');
    expect(fake.did.slice(-3)).toEqual(['env 0.2.0', 'up postgres keycloak', 'up storage identity registry web']);
  });

  it('writes the release’s deploy files, makes up new secrets, and starts new parts', async () => {
    const t = target({
      images: { ...target().images, search: image('search', 's3') },
      deploy: { 'compose.yml': hash('c1'), 'keycloak/realm.json': hash('k1'), 'search.yml': hash('s1') },
      required: ['PLATFORM_URL', 'SEARCH_CLIENT_SECRET'],
    });
    const fake = fakeServer();
    const { outcome, reports } = await run(t, fake.server);
    expect(outcome).toBe('done');
    expect(fake.did).toContain('files from ghcr.io/o/r/updater@sha256:u3');
    expect(fake.disk).toMatchObject({ 'compose.yml': 'c1', 'keycloak/realm.json': 'k1', 'search.yml': 's1' });
    expect(fake.env()).toMatch(/^SEARCH_CLIENT_SECRET=[0-9a-f]{64}$/m);
    expect(fake.did.filter((d) => !d.startsWith('verify') && !d.startsWith('files'))).toEqual([
      'backup',
      'restore-test',
      'pull storage identity registry web updater 0.3.0',
      'write compose.yml keycloak/realm.json search.yml',
      'env 0.3.0',
      'pull search 0.3.0',
      'up postgres keycloak',
      'recreate keycloak',
      'up storage',
      'up identity',
      'up registry',
      'up web',
      'up search',
    ]);
    expect(reports.find((r) => r.step === 'roll-forward' && r.state === 'done')?.message).toBe(
      'wrote compose.yml, keycloak/realm.json, search.yml; made up SEARCH_CLIENT_SECRET in .env; started search.',
    );
  });

  it('puts the deploy files back, and takes new parts away, when it goes back', async () => {
    const t = target({ images: { ...target().images, search: image('search', 's3') }, deploy: { 'compose.yml': hash('c1'), 'search.yml': hash('s1') } });
    const fake = fakeServer({ registry: true });
    expect((await run(t, fake.server)).outcome).toBe('rolled-back');
    expect(fake.disk).toMatchObject({ 'compose.yml': 'c0', 'search.yml': undefined });
    expect(fake.did.slice(-5)).toEqual(['remove search', 'write compose.yml search.yml', 'env 0.2.0', 'up postgres keycloak', 'up storage identity registry web']);
  });

  it('goes back when storage’s set-up stops with an error', async () => {
    const { outcome, last } = await run(target(), fakeServer({ storage: true }).server);
    expect(outcome).toBe('rolled-back');
    expect(last.message).toContain('Back on 0.2.0: storage stopped with an error (exit code 1)');
  });

  it('says it needs someone when going back fails too', async () => {
    const { outcome, last } = await run(target(), fakeServer({ registry: true, rollBack: true }).server);
    expect(outcome).toBe('failed');
    expect(last).toMatchObject({ step: 'roll-back', state: 'failed', outcome: 'failed' });
    expect(last.message).toContain('Back on 0.2.0 didn’t work either: docker: no such image');
  });

  it('stops when the upgrade is withdrawn before it starts', async () => {
    const fake = fakeServer();
    await expect(
      runUpgrade(target(), fake.server, async () => {
        throw new Withdrawn('cancelled');
      }),
    ).rejects.toBeInstanceOf(Withdrawn);
    expect(fake.did).toEqual([]);
  });
});
