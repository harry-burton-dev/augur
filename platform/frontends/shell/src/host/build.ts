/**
 * Which build of the shell this tab runs, against the one the server serves now (PER-415, design review FE-5).
 * An upgrade or a rollback swaps the files under a tab that stays open, so the shell asks again when it comes
 * back into view and when its notification stream reconnects (services restart in an upgrade), and offers a reload.
 */
export interface ShellBuild {
  /** The shell's release, from its package.json. */
  version: string;
  /** Different for every build, so a rebuild of the same release counts too. */
  build: string;
}

export type BuildChange = { kind: 'upgraded' | 'rolled back' | 'changed'; version: string };

/** Written by the build beside index.html (vite.config.ts), and served like it, with no-cache. */
export const BUILD_FILE = '/shell-build.json';

/** The build the server serves now; undefined when it can't be read, which is never a reason to say anything. */
export async function servedBuild(fetchImpl: typeof fetch): Promise<ShellBuild | undefined> {
  try {
    const res = await fetchImpl(BUILD_FILE, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const body = (await res.json()) as Partial<ShellBuild>;
    return typeof body.version === 'string' && typeof body.build === 'string' ? { version: body.version, build: body.build } : undefined;
  } catch {
    return undefined;
  }
}

const parts = (v: string) => (v.split(/[-+]/)[0] ?? '').split('.').map((n) => Number(n) || 0);

/** Negative when a is older than b, positive when newer, 0 when the release numbers match. */
const compare = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

export function buildChange(running: ShellBuild, served: ShellBuild | undefined): BuildChange | undefined {
  if (!served || served.build === running.build) return undefined;
  const order = compare(served.version, running.version);
  return { kind: order > 0 ? 'upgraded' : order < 0 ? 'rolled back' : 'changed', version: served.version };
}

/** What the shell says, under the deployment's own name. */
export function buildNotice(change: BuildChange, product: string) {
  const what = change.kind === 'upgraded' ? 'was upgraded' : change.kind === 'rolled back' ? 'went back to an earlier version' : 'changed';
  return { title: `${product} ${what} while this tab was open`, body: 'Reload to use it. Anything not yet saved in an app may be lost.', action: 'Reload' };
}
