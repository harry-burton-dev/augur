import { describe, expect, it } from 'vitest';
import { runUpgrade, Withdrawn, type Report, type Server, type Target } from './upgrade.ts';

const image = (service: string, digest: string) => `ghcr.io/o/r/${service}@sha256:${digest}`;
const target = (more: Partial<Target> = {}): Target => ({
  id: 'up-1',
  from: '0.2.0',
  version: '0.3.0',
  state: 'requested',
  images: { storage: image('storage', 's3'), identity: image('identity', 'i3'), registry: image('registry', 'r3'), web: image('web', 'w3'), updater: image('updater', 'u3') },
  parts: { '@augur/identity': '0.4.0', '@augur/registry': '0.5.0', '@augur/shell': '0.6.0' },
  required: ['PLATFORM_VERSION', 'PLATFORM_URL'],
  deploy: { 'compose.yml': 'c0' },
  ...more,
});

/** A server that does what it's told, and remembers it; `breaks` makes one thing go wrong. */
const fakeServer = (breaks: Partial<Record<'sign' | 'backup' | 'restore' | 'digest' | 'registry' | 'storage' | 'rollBack', boolean>> = {}) => {
  const did: string[] = [];
  let env = 'PLATFORM_VERSION=0.2.0\nPLATFORM_URL=https://augur.example.org\n';
  const versions: Record<string, string> = { identity: '0.3.0', registry: '0.4.0', web: '' };
  const newVersions: Record<string, string> = { identity: '0.4.0', registry: breaks.registry ? '0.4.0' : '0.5.0', web: '' };
  const oldVersions = { ...versions };
  let rolledBack = false;
  const server: Server = {
    readEnv: async () => env,
    writeEnv: async (text) => {
      env = text;
      did.push(`env ${/PLATFORM_VERSION=(\S+)/.exec(text)?.[1]}`);
    },
    hashDeployFiles: async (paths) => Object.fromEntries(paths.map((p) => [p, p === 'compose.yml' ? 'c0' : undefined])),
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
    exitCode: async (service) => (breaks.storage && service === 'storage' && env.includes('PLATFORM_VERSION=0.3.0') ? 1 : 0),
    wait: async () => {},
  };
  return { server, did, env: () => env, rolledBack: () => rolledBack };
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
    expect(fake.did.filter((d) => !d.startsWith('verify'))).toEqual(['backup', 'restore-test', 'pull storage identity registry web updater 0.3.0', 'env 0.3.0', 'up storage', 'up identity', 'up registry', 'up web']);
    expect(fake.did.filter((d) => d.startsWith('verify'))).toHaveLength(5);
    expect(fake.env()).toContain('PLATFORM_URL=https://augur.example.org');
  });

  it('verifies images where the deployment pulls them from', async () => {
    const fake = fakeServer();
    await fake.server.writeEnv('PLATFORM_VERSION=0.2.0\nPLATFORM_URL=x\nPLATFORM_IMAGES=registry.example.org/augur\n');
    await run(target(), fake.server);
    expect(fake.did).toContain('verify registry.example.org/augur/web@sha256:w3');
  });

  it.each([
    ['the server runs another version', target({ from: '0.1.0' }), {}, 'The server’s settings say it runs 0.2.0, not 0.1.0.'],
    ['the release changes the deploy files', target({ deploy: { 'compose.yml': 'c1', 'nginx.conf': 'n1' } }), {}, 'AUGUR 0.3.0 changes the server’s own files (compose.yml, nginx.conf), so it’s upgraded by hand'],
    ['the release file couldn’t be read', target({ deploy: undefined }), {}, 'release file couldn’t be read'],
    ['a required setting is missing', target({ required: ['PLATFORM_URL', 'OBJECT_STORE_URL'] }), {}, 'Set OBJECT_STORE_URL in .env first'],
    ['a part is new to the updater', target({ images: { ...target().images, search: image('search', 'x3') } }), {}, 'parts the updater doesn’t know how to restart (search)'],
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
    expect(fake.did.some((d) => d.startsWith('up') || d.startsWith('env'))).toBe(false);
  });

  it('goes back to the release it was on when a part doesn’t come back on the new one', async () => {
    const fake = fakeServer({ registry: true });
    const { outcome, steps, last } = await run(target(), fake.server);
    expect(outcome).toBe('rolled-back');
    expect(steps.slice(-3)).toEqual(['roll-forward failed', 'roll-back running', 'roll-back done → rolled-back']);
    expect(last.message).toBe('Back on 0.2.0: registry came back on 0.4.0, not 0.5.0. If 0.2.0 has trouble with data 0.3.0 changed, restore platform-2026-10-23T120000Z.sql.gz (docs/upgrade.md, Going back).');
    expect(fake.env()).toContain('PLATFORM_VERSION=0.2.0');
    expect(fake.did.slice(-2)).toEqual(['env 0.2.0', 'up storage identity registry web']);
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
