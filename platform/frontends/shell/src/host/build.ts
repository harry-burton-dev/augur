/**
 * Which build of the shell this tab runs, against the one the server serves now (PER-415, design review FE-5).
 * An upgrade or a rollback swaps the files under a tab that stays open, so the shell asks again when the tab
 * comes back into view or into focus and when its notification stream reconnects (services restart in an
 * upgrade), and offers a reload.
 */
export interface ShellBuild {
  /** The shell's release, from its package.json; empty for a server whose shell writes no build file (older releases). */
  version: string;
  /** Different for every build, so a rebuild of the same release counts too. */
  build: string;
}

/** Said from the shell's own release, which moves only when the shell itself changed: otherwise it's "changed". */
export type BuildChange = 'upgraded' | 'rolled back' | 'changed';

/** Written by the build beside index.html (vite.config.ts), and served like it, with no-cache. */
export const BUILD_FILE = '/shell-build.json';

/** A server whose shell predates the build file answers with its page instead (nginx's fallback to index.html). */
const NO_FILE: ShellBuild = { version: '', build: '' };

/** The build the server serves now; undefined when it can't be read, which is never a reason to say anything. */
export async function servedBuild(fetchImpl: typeof fetch): Promise<ShellBuild | undefined> {
  try {
    const res = await fetchImpl(BUILD_FILE, { cache: 'no-store' });
    if (!res.ok) return undefined;
    if (!/json/.test(res.headers.get('content-type') ?? '')) return /html/.test(res.headers.get('content-type') ?? '') ? NO_FILE : undefined;
    const body = (await res.json()) as Partial<ShellBuild>;
    return typeof body.version === 'string' && typeof body.build === 'string' && body.build ? { version: body.version, build: body.build } : undefined;
  } catch {
    return undefined;
  }
}

/** Negative when a is older than b, positive when newer, 0 when they're the same release (semver's order, prereleases simply). */
const compare = (a: string, b: string) => {
  const [coreA = '', preA = ''] = a.split('+')[0]!.split(/-(.*)/);
  const [coreB = '', preB = ''] = b.split('+')[0]!.split(/-(.*)/);
  const x = coreA.split('.').map(Number);
  const y = coreB.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  if (preA === preB) return 0;
  if (!preA || !preB) return preA ? -1 : 1;
  return preA.localeCompare(preB, 'en', { numeric: true });
};

export function buildChange(running: ShellBuild, served: ShellBuild | undefined): BuildChange | undefined {
  if (!served || served.build === running.build) return undefined;
  if (!served.version || !running.version) return 'changed';
  const order = compare(served.version, running.version);
  return order > 0 ? 'upgraded' : order < 0 ? 'rolled back' : 'changed';
}

/** What the shell says, under the deployment's own name. */
export function buildNotice(change: BuildChange, product: string) {
  const what = change === 'upgraded' ? 'was upgraded' : change === 'rolled back' ? 'went back to an earlier version' : 'changed';
  return { title: `${product} ${what} while this tab was open`, body: 'Reload to use it. Anything not yet saved in an app may be lost.', action: 'Reload' };
}
