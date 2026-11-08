/**
 * The spec's example app (appendix A) as a contract 3 release, built the way the release workflow
 * builds it: app-tools' fixtures and its release writer. Tests change a copy to break one rule.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { appRelease2, asksOf2, type AppRelease2 } from '@augur/app-tools/release2';
import type { AppManifest3 } from '@augur/app-tools/validate';

const require = createRequire(import.meta.url);
const tools = dirname(require.resolve('@augur/app-tools/package.json'));
const fixture = (path: string) => readFileSync(join(tools, 'fixtures', 'notes', path), 'utf8');

const digest = (c: string) => `sha256:${c.repeat(64)}`;

export const exampleManifest = () => JSON.parse(fixture('manifest.json'));
export const examplePart = (name: 'web' | 'worker' | 'migrate') => parse(fixture(`score/${name}.score.yaml`));

/** The example's release file; `over` replaces top-level fields. */
export const exampleRelease = (over: Partial<AppRelease2> = {}): AppRelease2 => {
  const release = appRelease2({
    manifest: exampleManifest(),
    parts: [examplePart('web'), examplePart('worker'), examplePart('migrate')],
    bundle: {
      frontend: { artifact: `ghcr.io/example-org/augur-notes-frontend@${digest('b')}`, digest: digest('c') },
      channel: 'stable',
    },
    signer: { repository: 'example-org/augur-notes', workflow: '.github/workflows/release.yml' },
    releasedAt: '2026-11-08T12:00:00Z',
  });
  return { ...release, ...over };
};

/**
 * The example as another app or version: id, version and channel set in the file and its manifest alike.
 * `manifest` changes the manifest (its asks follow it); `over` replaces top-level fields after that.
 */
export const releaseOf = (id = 'notes', version = '1.0.0', manifest: Partial<AppManifest3> = {}, over: Partial<AppRelease2> = {}): AppRelease2 => {
  const base = exampleRelease();
  const pre = version.includes('-') ? version.slice(version.indexOf('-') + 1) : undefined;
  const m = { ...base.manifest, ...manifest, id, version } as AppManifest3;
  return {
    ...base,
    id,
    version,
    channel: pre === undefined ? 'stable' : pre.startsWith('pr.') ? 'preview' : pre.startsWith('dev.') ? 'dev' : 'beta',
    manifest: m,
    asks: asksOf2(m, base.parts),
    ...over,
  };
};
