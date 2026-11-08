import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { partsFor, type Parts } from './parts.ts';
import { afterRestart, checkOnce, lookAfterWatch, runUpgrade, Withdrawn, type Journal, type Report, type Server, type Target } from './upgrade.ts';

/** Parts beyond the platform's own, a service and a worker, as releases before ADR 0075 had for their apps. */
const parts: Parts = (() => {
  const own = partsFor();
  const at = own.order.indexOf('gateway');
  return {
    ...own,
    order: [...own.order.slice(0, at), 'folio', 'folio-worker', 'atlas', ...own.order.slice(at)],
    roles: { ...own.roles, folio: 'service', 'folio-worker': 'worker', atlas: 'service' },
    health: { ...own.health, folio: 'http://folio:8083/healthz', atlas: 'http://atlas:8086/healthz' },
  };
})();
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
type Breaks = 'sign' | 'backup' | 'restore' | 'digest' | 'registry' | 'storage' | 'worker' | 'rollBack' | 'oldUpdater' | 'edited' | 'badFile' | 'errors' | 'signIn' | 'blip' | 'quiet' | 'fallsOver' | 'ownKeycloak' | 'full' | 'envWrite' | 'verify' | 'journal';
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
  let looks = 0;
  const upped = new Set<string>();
  // The upgrade's journal in the deploy folder, and each one written with how far the server had got.
  let journal: Journal | undefined;
  const journals: { at: number; journal: Journal }[] = [];
  const server: Server = {
    readEnv: async () => env,
    writeEnv: async (text) => {
      // `envWrite`: the disk fills as the new settings are written.
      if (breaks.envWrite && text.includes('PLATFORM_VERSION=0.3.0')) throw new Error('ENOSPC: no space left on device');
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
    verifySignature: async (ref, identity) => {
      did.push(`verify ${ref}${identity ? ` as ${identity}` : ''}`);
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
    // `ownKeycloak`: the running compose.yml (c0) names Keycloak's own image; the next one (c1), AUGUR's.
    images: async (version) => {
      const names = ['postgres', 'keycloak', 'storage', 'identity', 'registry', 'web', 'updater', 'search'];
      return Object.fromEntries(names.map((s) => [s, s === 'keycloak' && breaks.ownKeycloak && disk['compose.yml'] !== 'c1' ? 'quay.io/keycloak/keycloak:26.8.1' : `ghcr.io/o/r/${s}:${version}`]));
    },
    digests: async (service) => [breaks.digest && service === 'registry' ? image(service, 'other') : `ghcr.io/o/r/${service}@sha256:${service[0]}3`],
    up: async (services) => {
      const onNew = env.includes('PLATFORM_VERSION=0.3.0');
      if (!onNew && breaks.rollBack) throw new Error('docker: no such image');
      if (!onNew) rolledBack = true;
      for (const s of services) versions[s] = onNew ? newVersions[s] : oldVersions[s];
      for (const s of services) upped.add(s);
      did.push(`up ${services.join(' ')}`);
    },
    // `fallsOver`: registry stops answering a few minutes into the watch.
    health: async (service) => {
      if (breaks.fallsOver && service === 'registry' && looks >= 4 && env.includes('PLATFORM_VERSION=0.3.0')) throw new Error('connect ECONNREFUSED');
      // `verify`: registry comes up, then falls over once the front door is on the new release too.
      if (breaks.verify && service === 'registry' && upped.has('web') && env.includes('PLATFORM_VERSION=0.3.0')) throw new Error('connect ECONNREFUSED');
      return { version: versions[service] };
    },
    exitCode: async (service) => {
      const onNew = env.includes('PLATFORM_VERSION=0.3.0');
      // A worker runs on (no exit code) unless it fell over.
      if (service === 'folio-worker') return breaks.worker && onNew ? 1 : undefined;
      return breaks.storage && service === 'storage' && onNew ? 1 : 0;
    },
    // After the upgrade: one in ten calls failing with `errors`, sign-in down with `signIn`, or down for one look with `blip`.
    traffic: async () => ({ requests: breaks.quiet ? 3 : 100, serverErrors: breaks.errors && env.includes('PLATFORM_VERSION=0.3.0') ? 10 : 0 }),
    signInProblem: async () => {
      looks += 1;
      if (breaks.signIn || (breaks.blip && looks === 3)) return 'the sign-in service answered 503.';
      return undefined;
    },
    wait: async () => {},
    // `full`: the deploy folder's disk has 1 GiB left.
    freeBytes: async () => (breaks.full ? 1024 ** 3 : 50 * 1024 ** 3),
    readJournal: async () => journal && structuredClone(journal),
    writeJournal: async (next) => {
      if (breaks.journal) throw new Error('EACCES: permission denied');
      journal = structuredClone(next);
      journals.push({ at: did.length, journal: structuredClone(next) });
    },
    clearJournal: async () => void (journal = undefined),
  };
  return {
    server,
    did,
    disk,
    env: () => env,
    setEnv: (text: string) => void (env = text),
    rolledBack: () => rolledBack,
    journal: () => journal,
    journals,
    setJournal: (next: Journal) => void (journal = structuredClone(next)),
  };
};

const run = async (t: Target, server: Server) => {
  const reports: Report[] = [];
  const outcome = await runUpgrade(t, server, async (r) => void reports.push(r), { parts });
  return { outcome, reports, steps: reports.map((r) => `${r.step} ${r.state}${r.outcome ? ` → ${r.outcome}` : ''}`), last: reports.at(-1)! };
};

describe('an upgrade', () => {
  it('runs an AUGUR dev build only on the workbench, signed by the dev builds workflow on dev', async () => {
    const devIdentity = 'https://github.com/o/r/.github/workflows/augur-dev.yml@refs/heads/dev';
    const dev = target({ version: '0.3.0-dev.48' });
    const elsewhere = fakeServer();
    const refused: Report[] = [];
    await runUpgrade(dev, elsewhere.server, async (r) => void refused.push(r), { devIdentity, parts });
    expect(refused.find((r) => r.step === 'preflight' && r.state === 'failed')?.message).toContain('0.3.0-dev.48 is a dev build of AUGUR, and only the workbench (SERVER_RING=dev in .env) runs those.');
    expect(elsewhere.did).toEqual([]);

    const workbench = fakeServer();
    workbench.setEnv(`${workbench.env()}SERVER_RING=dev\n`);
    const reports: Report[] = [];
    const outcome = await runUpgrade(dev, workbench.server, async (r) => void reports.push(r), { devIdentity, parts });
    expect(reports.filter((r) => r.state === 'failed').map((r) => r.message)).toEqual([]);
    expect(outcome).toBe('done');
    const verified = workbench.did.filter((d) => d.startsWith('verify'));
    expect(verified).toHaveLength(5);
    expect(verified.every((d) => d.endsWith(` as ${devIdentity}`))).toBe(true);

    // A release is still checked against the Release workflow, on the workbench too.
    const release = fakeServer();
    release.setEnv(`${release.env()}SERVER_RING=dev\n`);
    await run(target(), release.server);
    expect(release.did.filter((d) => d.startsWith('verify')).some((d) => d.includes(' as '))).toBe(false);
  });

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

  it('stops the parts a release doesn’t have, such as one added after it when going back, and starts them again if it goes back', async () => {
    const withAtlas = (breaks = {}) => {
      const fake = fakeServer(breaks);
      const services = fake.server.services;
      fake.server.services = async () => [...(await services()), 'atlas'];
      return fake;
    };
    const fake = withAtlas();
    const { outcome, reports } = await run(target(), fake.server);
    expect(outcome).toBe('done');
    expect(fake.did.indexOf('remove atlas')).toBeLessThan(fake.did.indexOf('env 0.3.0'));
    expect(reports.find((r) => r.step === 'roll-forward' && r.state === 'done')?.message).toContain('stopped atlas, which 0.3.0 doesn’t have');

    const failing = withAtlas({ registry: true });
    expect((await run(target(), failing.server)).outcome).toBe('rolled-back');
    expect(failing.did.some((d) => d.startsWith('up ') && d.includes('atlas'))).toBe(true);
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

  it('refuses a release with an image for a part the server runs that it doesn’t know, rather than restart it unchecked', async () => {
    const fake = fakeServer();
    const services = fake.server.services;
    fake.server.services = async () => [...(await services()), 'mandate'];
    const { outcome, last } = await run(target({ images: { ...target().images, mandate: image('mandate', 'm3') } }), fake.server);
    expect(outcome).toBe('rolled-back');
    expect(last.message).toContain('Nothing was changed.');
    expect(last.message).toContain('has an image for mandate, which this server runs, and this updater doesn’t know how to restart it');
    expect(fake.did.some((d) => d.startsWith('up') || d.startsWith('env') || d.startsWith('backup'))).toBe(false);
    // Its own parts are the platform's only.
    const alone = fakeServer();
    alone.server.services = async () => [...(await services()), 'folio'];
    const reports: Report[] = [];
    const shipped = target({ images: { ...target().images, folio: image('folio', 'f3') } });
    expect(await runUpgrade(shipped, alone.server, async (r) => void reports.push(r))).toBe('rolled-back');
    expect(reports.at(-1)?.message).toContain('for folio');
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
    ['a required setting is missing', target({ required: ['PLATFORM_URL', 'OBJECT_STORE_URL'] }), {}, 'AUGUR 0.3.0 won’t start without OBJECT_STORE_URL. Enter it when you ask'],
    ['an entered value can’t be written', target({ settings: { ORG_NAME: 'it\'s "ours"' } }), {}, 'The value entered for ORG_NAME can’t go in .env'],
    ['an image isn’t signed', target(), { sign: true }, 'The web image isn’t signed by AUGUR’s Release workflow'],
    ['the backup fails', target(), { backup: true }, 'The backup couldn’t be taken: pg_dumpall: connection refused'],
    ['the backup doesn’t restore', target(), { restore: true }, 'didn’t restore in the test'],
    ['a pulled image isn’t the release’s', target(), { digest: true }, 'The registry image pulled for 0.3.0 isn’t the one the release names'],
    ['the disk is nearly full', target(), { full: true }, 'The deploy folder’s disk has 1.0 GiB free, and an upgrade needs 2.0 GiB'],
    ['the upgrade asks to set who signs images', target({ settings: { IMAGE_SIGNER: 'https://github.com/someone/else/.github/workflows/release.yml@refs/heads/main' } }), {}, 'The upgrade asks to set IMAGE_SIGNER, which decides what this server trusts'],
    ['the upgrade asks to set where images come from or which files Compose reads', target({ settings: { PLATFORM_IMAGES: 'evil.example/augur', COMPOSE_FILE: 'other.yml', APPS_NETWORK: 'host' } }), {}, 'The upgrade asks to set PLATFORM_IMAGES, COMPOSE_FILE, APPS_NETWORK, which decide'],
    ['the upgrade asks to set the app runner’s key', target({ settings: { APP_SECRETS_KEY: 'k' } }), {}, 'APP_SECRETS_KEY'],
    ['a setting’s name isn’t a plain one', target({ settings: { 'ORG_NAME=x\nIMAGE_SIGNER': 'y' } }), {}, 'which isn’t a setting’s name'],
    ['the upgrade asks to change a setting the server already has', target({ settings: { PLATFORM_URL: 'https://elsewhere.example.org' } }), {}, 'The upgrade asks to change PLATFORM_URL, which .env already sets. An upgrade only adds settings'],
    ['the journal can’t be written', target(), { journal: true }, 'The updater couldn’t write down the upgrade in the deploy folder'],
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
    expect(last.message).toBe('Back on 0.2.0: registry came back on 0.4.0, not 0.5.0. If 0.2.0 has trouble with data 0.3.0 changed, restore platform-2026-10-23T120000Z.sql.gz: docs/upgrade-went-back.md says how, and what to check first.');
    expect(fake.env()).toContain('PLATFORM_VERSION=0.2.0');
    expect(fake.did.slice(-3)).toEqual(['env 0.2.0', 'up postgres keycloak', 'up storage identity registry web']);
  });

  it('writes the release’s deploy files, makes up new secrets, and starts new parts', async () => {
    const t = target({
      images: { ...target().images, search: image('search', 's3') },
      deploy: { 'compose.yml': hash('c1'), 'keycloak/realm.json': hash('k1'), 'search.yml': hash('s1') },
      required: ['PLATFORM_URL', 'SEARCH_CLIENT_SECRET', 'SEARCH_URL'],
      settings: { SEARCH_URL: 'http://search:9200', ORG_NAME: 'Acme & Co $HOME' },
    });
    const fake = fakeServer();
    const { outcome, reports } = await run(t, fake.server);
    expect(outcome).toBe('done');
    expect(fake.did).toContain('files from ghcr.io/o/r/updater@sha256:u3');
    expect(fake.disk).toMatchObject({ 'compose.yml': 'c1', 'keycloak/realm.json': 'k1', 'search.yml': 's1' });
    expect(fake.env()).toMatch(/^SEARCH_CLIENT_SECRET=[0-9a-f]{64}$/m);
    expect(fake.env()).toContain("SEARCH_URL=http://search:9200\nORG_NAME='Acme & Co $HOME'\n");
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
      'wrote compose.yml, keycloak/realm.json, search.yml; set SEARCH_URL, ORG_NAME as entered; made up SEARCH_CLIENT_SECRET in .env; started search.',
    );
  });

  it('pulls a part moving onto AUGUR’s image once the new compose.yml names it, and puts it back on the old one when it goes back', async () => {
    const t = target({ images: { ...target().images, keycloak: image('keycloak', 'k3') }, deploy: { 'compose.yml': hash('c1') } });
    const fake = fakeServer({ ownKeycloak: true });
    expect((await run(t, fake.server)).outcome).toBe('done');
    expect(fake.did.filter((d) => d.startsWith('pull') || d.startsWith('write'))).toEqual(['pull storage identity registry web updater 0.3.0', 'write compose.yml', 'pull keycloak 0.3.0']);

    const failing = fakeServer({ ownKeycloak: true, registry: true });
    expect((await run(t, failing.server)).outcome).toBe('rolled-back');
    expect(failing.disk['compose.yml']).toBe('c0');
    expect(failing.did).not.toContain('remove keycloak');
    expect(failing.did.at(-1)).toBe('up keycloak storage identity registry web');
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

  it('takes an entered setting the server already has with that very value as it is', async () => {
    const fake = fakeServer();
    expect((await run(target({ settings: { PLATFORM_URL: 'https://augur.example.org' } }), fake.server)).outcome).toBe('done');
  });

  it('goes back and writes the old settings again when writing the new ones fails', async () => {
    const fake = fakeServer({ envWrite: true });
    const { outcome, last } = await run(target(), fake.server);
    expect(outcome).toBe('rolled-back');
    expect(last.message).toContain('Back on 0.2.0: ENOSPC: no space left on device');
    expect(fake.did.filter((d) => !d.startsWith('verify'))).toEqual(['backup', 'restore-test', 'pull storage identity registry web updater 0.3.0', 'env 0.2.0', 'up storage identity registry web']);
    expect(fake.env()).toContain('PLATFORM_VERSION=0.2.0');
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

describe('the watch after an upgrade (ADR 0020)', () => {
  it('calls it done only after the new release has run with sign-in and calls working, a blip forgiven', async () => {
    const { server } = fakeServer({ blip: true });
    const { outcome, steps, last } = await run(target({ watch: {} }), server);
    expect(outcome).toBe('done');
    expect(steps.slice(-3)).toEqual(['verify done', 'watch running', 'watch done → done']);
    expect(last.message).toBe('AUGUR 0.3.0 ran for 10 minutes with sign-in working and every part ready, and AUGUR’s services answered 100 calls with few errors.');
  });

  it('says when it was too quiet to judge errors, rather than passing in silence', async () => {
    const { outcome, last } = await run(target({ watch: {} }), fakeServer({ quiet: true }).server);
    expect(outcome).toBe('done');
    expect(last.message).toBe(
      'AUGUR 0.3.0 ran for 10 minutes with sign-in working and every part ready. Too quiet to judge errors: 3 calls to AUGUR’s services, and it takes 20, so a light watch goes on until there are, for up to a day.',
    );
    // The registry starts the light watch from the count (ADR 0020, amended 2 Nov).
    expect(last.calls).toBe(3);
  });

  it('looks once for the light watch: AUGUR’s calls since the last look, and whether sign-in works', async () => {
    const traffic = async (minutes: number) => ({ minutes, requests: minutes * 2, serverErrors: 1 });
    expect(await lookAfterWatch({ id: 'up-1', version: '0.3.0', minutes: 5 }, { traffic, signInProblem: async () => undefined })).toEqual({ id: 'up-1', calls: 10, serverErrors: 1 });
    expect(await lookAfterWatch({ id: 'up-1', version: '0.3.0', minutes: 5 }, { traffic: async () => Promise.reject(new Error('down')), signInProblem: async () => 'Keycloak answered 503.' })).toEqual({
      id: 'up-1',
      calls: 0,
      serverErrors: 0,
      signInProblem: 'Keycloak answered 503.',
    });
  });

  it('goes back when a part stops answering during the watch, not only at its end', async () => {
    const fake = fakeServer({ fallsOver: true });
    const { outcome, steps } = await run(target({ watch: {} }), fake.server);
    expect(outcome).toBe('rolled-back');
    expect(steps.slice(-3)).toEqual(['watch failed', 'roll-back running', 'roll-back done → rolled-back']);
  });

  it('goes back by itself when calls start failing or sign-in stops', async () => {
    const errors = fakeServer({ errors: true });
    const failed = await run(target({ watch: {} }), errors.server);
    expect(failed.outcome).toBe('rolled-back');
    expect(failed.steps.slice(-3)).toEqual(['watch failed', 'roll-back running', 'roll-back done → rolled-back']);
    expect(failed.last.message).toContain('10 of the 100 calls to AUGUR’s services in the last 1 minute failed, more than 5%.');
    expect(errors.rolledBack()).toBe(true);

    const signIn = await run(target({ watch: {} }), fakeServer({ signIn: true }).server);
    expect(signIn.last.message).toContain('Signing in stopped working after the upgrade: the sign-in service answered 503.');
  });

  it('leaves a release with a breaking one between running, and says so for a person', async () => {
    const { server, rolledBack } = fakeServer({ errors: true });
    const { outcome, last } = await run(target({ watch: { breakingSince: '0.2.5' } }), server);
    expect(outcome).toBe('failed');
    expect(last).toMatchObject({ step: 'watch', state: 'failed', outcome: 'failed' });
    expect(last.message).toContain('it didn’t go back by itself, because 0.2.5 between is breaking');
    expect(rolledBack()).toBe(false);
  });
});

describe('a breaking release between (ADR 0020)', () => {
  const breaking = target({ watch: { breakingSince: '0.2.5' } });

  it('doesn’t go back by itself once a part has restarted on the new release and one doesn’t come back', async () => {
    const fake = fakeServer({ registry: true });
    const { outcome, last } = await run(breaking, fake.server);
    expect(outcome).toBe('failed');
    expect(last).toMatchObject({ step: 'roll-forward', state: 'failed', outcome: 'failed' });
    expect(last.message).toContain('registry came back on 0.4.0, not 0.5.0.');
    expect(last.message).toContain('The server is partly on AUGUR 0.3.0: it didn’t go back by itself, because 0.2.5 between is breaking. See docs/upgrade-went-back.md');
    expect(fake.rolledBack()).toBe(false);
    expect(fake.env()).toContain('PLATFORM_VERSION=0.3.0');
  });

  it('doesn’t go back by itself when a part falls over in the last check', async () => {
    const fake = fakeServer({ verify: true });
    const { outcome, last } = await run(breaking, fake.server);
    expect(outcome).toBe('failed');
    expect(last).toMatchObject({ step: 'verify', state: 'failed', outcome: 'failed' });
    expect(last.message).toContain('AUGUR 0.3.0 is still running: it didn’t go back by itself, because 0.2.5 between is breaking');
    expect(fake.rolledBack()).toBe(false);
  });

  it('still goes back when nothing had restarted on the new release yet', async () => {
    const fake = fakeServer({ envWrite: true });
    const { outcome, last } = await run(breaking, fake.server);
    expect(outcome).toBe('rolled-back');
    expect(last).toMatchObject({ step: 'roll-back', outcome: 'rolled-back' });
    expect(fake.did).toContain('env 0.2.0');
  });
});

describe('the upgrade’s journal, for a restart partway through', () => {
  const files = target({ images: { ...target().images, search: image('search', 's3') }, deploy: { 'compose.yml': hash('c1'), 'search.yml': hash('s1') }, watch: { breakingSince: '0.2.5' } });

  it('is written before anything changes, notes when a part is about to restart, and is gone when the upgrade ends', async () => {
    const fake = fakeServer();
    expect((await run(files, fake.server)).outcome).toBe('done');
    const [first, ...later] = fake.journals;
    expect(fake.did.slice(0, first!.at).some((d) => /^(up|env|write|remove|recreate)/.test(d))).toBe(false);
    expect(first!.journal).toMatchObject({
      id: 'up-1',
      from: '0.2.0',
      version: '0.3.0',
      before: 'PLATFORM_VERSION=0.2.0\nPLATFORM_URL=https://augur.example.org\n',
      oldFiles: { 'compose.yml': Buffer.from('c0').toString('base64'), 'search.yml': null },
      services: ['storage', 'identity', 'registry', 'web'],
      breakingSince: '0.2.5',
      restarted: false,
    });
    const restarting = later.find((j) => j.journal.restarted)!;
    expect(fake.did.slice(0, restarting.at).some((d) => d.startsWith('up'))).toBe(false);
    expect(fake.did[restarting.at]).toBe('up postgres keycloak');
    expect(restarting.journal).toMatchObject({ fresh: ['search'], others: ['postgres', 'keycloak'] });
    expect(fake.journal()).toBeUndefined();
  });

  it('is gone when the upgrade goes back, or changes nothing', async () => {
    const back = fakeServer({ registry: true });
    expect((await run(target(), back.server)).outcome).toBe('rolled-back');
    expect(back.journal()).toBeUndefined();
    const failed = fakeServer({ registry: true });
    expect((await run(files, failed.server)).outcome).toBe('failed');
    expect(failed.journal()).toBeUndefined();
  });

  /** The journal an updater left when it stopped partway through, `restarted` or not. */
  const leftBehind = async (t: Target, restarted: boolean) => {
    const fake = fakeServer();
    // An upgrade as far as the journal goes: the new files and settings written, then the updater stops.
    const writeJournal = fake.server.writeJournal;
    let stopped = false;
    fake.server.writeJournal = async (j) => {
      await writeJournal(j);
      if (j.restarted === restarted && (restarted || j.filesWritten)) {
        stopped = true;
        throw new Error('the updater stopped');
      }
    };
    const up = fake.server.up;
    fake.server.up = async (services) => {
      if (stopped) throw new Error('the updater stopped');
      return up(services);
    };
    const writeEnv = fake.server.writeEnv;
    fake.server.writeEnv = async (text) => {
      if (stopped) throw new Error('the updater stopped');
      return writeEnv(text);
    };
    const writeDeployFiles = fake.server.writeDeployFiles;
    fake.server.writeDeployFiles = async (f) => {
      if (stopped) throw new Error('the updater stopped');
      return writeDeployFiles(f);
    };
    const remove = fake.server.remove;
    fake.server.remove = async (s) => {
      if (stopped) throw new Error('the updater stopped');
      return remove(s);
    };
    const clearJournal = fake.server.clearJournal;
    fake.server.clearJournal = async () => (stopped ? undefined : clearJournal());
    await run(t, fake.server).catch(() => undefined);
    const journal = fake.journal()!;
    expect(journal).toBeDefined();
    // The restarted updater: a fresh look at the same server.
    const again = fakeServer();
    for (const [path, bytes] of Object.entries(fake.disk)) again.disk[path] = bytes;
    again.setEnv(fake.env());
    again.setJournal(journal);
    return { again, journal };
  };

  const resume = async (t: Target, server: Server) => {
    const reports: Report[] = [];
    const outcome = await afterRestart({ ...t, state: 'running' }, server, async (r) => void reports.push(r), { parts });
    return { outcome, reports, last: reports.at(-1)! };
  };

  it('goes back from it when the updater restarts before any part restarted, breaking release or not', async () => {
    const { again, journal } = await leftBehind(files, false);
    expect(journal.filesWritten).toBe(true);
    expect(again.disk['compose.yml']).toBe('c1');
    const { outcome, last } = await resume(files, again.server);
    expect(outcome).toBe('rolled-back');
    expect(last).toMatchObject({ step: 'roll-back', state: 'done', outcome: 'rolled-back' });
    expect(last.message).toContain('Back on 0.2.0: The updater restarted partway through the upgrade to 0.3.0, so it went back.');
    expect(again.disk).toMatchObject({ 'compose.yml': 'c0', 'search.yml': undefined });
    expect(again.env()).toBe('PLATFORM_VERSION=0.2.0\nPLATFORM_URL=https://augur.example.org\n');
    expect(again.journal()).toBeUndefined();
  });

  it('goes back from it after parts restarted, when no breaking release lies between', async () => {
    const t = { ...files, watch: {} };
    const { again } = await leftBehind(t, true);
    const { outcome } = await resume(t, again.server);
    expect(outcome).toBe('rolled-back');
    expect(again.did).toEqual(expect.arrayContaining(['remove search', 'env 0.2.0', 'up postgres keycloak']));
    expect(again.env()).toContain('PLATFORM_VERSION=0.2.0');
  });

  it('leaves the server for a person when parts had restarted and a breaking release lies between', async () => {
    const { again } = await leftBehind(files, true);
    const { outcome, last } = await resume(files, again.server);
    expect(outcome).toBe('failed');
    expect(last).toMatchObject({ step: 'roll-forward', state: 'failed', outcome: 'failed' });
    expect(last.message).toContain('The updater restarted partway through the upgrade to 0.3.0. The server is partly on AUGUR 0.3.0: it didn’t go back by itself, because 0.2.5 between is breaking.');
    expect(again.did).toEqual([]);
    expect(again.journal()).toBeUndefined();
  });

  it('notes each step, so a restart in the watch is known to find every part on the new release', async () => {
    const fake = fakeServer();
    expect((await run(files, fake.server)).outcome).toBe('done');
    expect(fake.journals.map((j) => j.journal.step)).toEqual(['pull', 'roll-forward', 'roll-forward', 'verify', 'watch']);
  });

  it('says AUGUR is still running when it restarted in the watch past a breaking release', async () => {
    const { again, journal } = await leftBehind(files, true);
    again.setJournal({ ...journal, step: 'watch' });
    const { outcome, last } = await resume(files, again.server);
    expect(outcome).toBe('failed');
    expect(last.message).toContain('The updater restarted partway through the upgrade to 0.3.0. AUGUR 0.3.0 is still running: it didn’t go back by itself');
    expect(again.did).toEqual([]);
  });

  it('goes back when it restarted in the watch, and says the watch couldn’t finish', async () => {
    const t = { ...files, watch: {} };
    const { again, journal } = await leftBehind(t, true);
    again.setJournal({ ...journal, step: 'watch' });
    const { outcome, last } = await resume(t, again.server);
    expect(outcome).toBe('rolled-back');
    expect(last.message).toContain('Back on 0.2.0: The updater restarted during the watch of 0.3.0, so the watch couldn’t finish and it went back.');
  });

  it('says nothing was changed when there is no journal, or it is another upgrade’s: it stopped before changing anything', async () => {
    const none = fakeServer();
    const { outcome, last } = await resume(target(), none.server);
    expect(outcome).toBe('rolled-back');
    expect(last).toMatchObject({ step: 'roll-back', state: 'failed', outcome: 'rolled-back' });
    expect(last.message).toBe('Nothing was changed. The updater restarted before the upgrade to 0.3.0 changed anything (while it checked, backed up or pulled). Ask for it again on the Updates page.');
    expect(none.did).toEqual([]);

    const { again, journal } = await leftBehind(files, false);
    again.setJournal({ ...journal, id: 'up-0' });
    expect((await resume(files, again.server)).outcome).toBe('rolled-back');
    expect(again.did).toEqual([]);
  });

  it('says a person has to look when the journal can’t be read', async () => {
    const fake = fakeServer();
    fake.server.readJournal = async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    };
    const { outcome, last } = await resume(target(), fake.server);
    expect(outcome).toBe('failed');
    expect(last.message).toBe('The updater restarted partway through the upgrade to 0.3.0, and what it wrote down couldn’t be read (Unexpected end of JSON input). Check Admin → Status, and docs/upgrade-went-back.md.');
    expect(fake.did).toEqual([]);
  });
});

describe('one look on demand (node dist/index.js check)', () => {
  const services = ['storage', 'identity', 'registry', 'folio', 'folio-worker', 'web'];

  it('passes when sign-in works, every part answers and AUGUR’s calls succeed, and says what it looked at', async () => {
    const result = await checkOnce(fakeServer().server, services, undefined, parts);
    expect(result).toEqual({ ok: true, checked: { signIn: true, parts: services, calls: { minutes: 10, requests: 100, serverErrors: 0 } }, problems: [] });
  });

  it('fails and names each part that doesn’t answer, sign-in that doesn’t work and calls that fail', async () => {
    const fake = fakeServer({ signIn: true, errors: true, storage: true });
    fake.setEnv('PLATFORM_VERSION=0.3.0\n');
    const server = { ...fake.server, health: async (service: string) => (service === 'identity' ? Promise.reject(new Error('connect ECONNREFUSED')) : { version: '1' }) };
    const result = await checkOnce(server, services, undefined, parts);
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      'Signing in doesn’t work: the sign-in service answered 503.',
      '10 of the 100 calls to AUGUR’s services in the last 10 minutes failed, more than 5%.',
      'storage stopped with an error (exit code 1); its logs say why.',
      'identity doesn’t answer.',
    ]);
  });

  it('counts a worker that stopped, and doesn’t judge errors when the gateway can’t say', async () => {
    const fake = fakeServer({ worker: true });
    fake.setEnv('PLATFORM_VERSION=0.3.0\n');
    const result = await checkOnce({ ...fake.server, traffic: async () => undefined }, services, undefined, parts);
    expect(result.checked.calls).toBeNull();
    expect(result.problems).toEqual(['folio-worker stopped (exit code 1); its logs say why.']);
  });
});
