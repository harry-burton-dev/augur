/**
 * The spec's example app (appendix A) as a contract 3 release, built the way the release workflow
 * builds it: app-tools' fixtures and its release writer. Tests change a copy to break one rule.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const tools = dirname(require.resolve('@augur/app-tools/package.json'));
const fixture = (path: string) => readFileSync(join(tools, 'fixtures', 'notes', path), 'utf8');

const digest = (c: string) => `sha256:${c.repeat(64)}`;

export const exampleManifest = () => JSON.parse(fixture('manifest.json'));
export const examplePart = (name: 'web' | 'worker' | 'migrate') => parse(fixture(`score/${name}.score.yaml`));

/** The example's release file; `over` replaces top-level fields. */
export const exampleRelease = async (over: Record<string, unknown> = {}) => {
  const { appRelease2 } = await import('@augur/app-tools/release2');
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
