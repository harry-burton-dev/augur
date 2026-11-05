import type { Ring } from './ring.ts';

/**
 * Live on the workbench (docs/release-channels.md, "Live on the workbench"): an app's developer loads its
 * frontend from their own machine's `pnpm dev:app <id> --live`, over the tailnet, in the real shell with
 * real sign-in, floors and data, for them alone. Only on the workbench (SERVER_RING=dev), and only from a
 * machine on the workbench's own tailnet, the one in PLATFORM_URL: its front door lets the shell load scripts
 * from `*.<that tailnet>.ts.net` and nowhere else (infra/deploy/live-origins.envsh). Kept in memory: a
 * restart puts everyone back on the app.
 */
export const LIVE_ONLY_ON_DEV = 'Only the workbench (SERVER_RING=dev) loads an app from your machine.';
export const LIVE_NEEDS_TAILNET = 'This workbench isn’t at a Tailscale address (PLATFORM_URL=https://<machine>.<tailnet>.ts.net), so no machine is on its tailnet to load an app from.';

/** The tailnet a `https://<machine>.<tailnet>.ts.net` address is on, or nothing for any other address. */
export const tailnetOf = (url?: string) => url?.match(/^https:\/\/[a-z0-9-]+\.([a-z0-9-]+)\.ts\.net(?::\d{1,5})?(?:\/|$)/i)?.[1]?.toLowerCase();

/** A frontend entry on a machine on the tailnet: https, a *.ts.net name, and a JavaScript or TypeScript module (a React app's is .tsx). */
const LIVE_URL = /^https:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+ts\.net(:\d{1,5})?\/[^\s?#]*\.(?:m?js|tsx?)$/;

/** Why `url` can't be loaded live from a machine on `tailnet`, or nothing. */
export const liveUrlProblem = (url: string, tailnet?: string) => {
  if (url.length > 2048 || !LIVE_URL.test(url)) {
    return 'That isn’t an app entry on your machine. Use the address `pnpm dev:app <id> --live` prints: https://<your machine>.ts.net/…/entry.tsx.';
  }
  if (!tailnet || !new URL(url).hostname.endsWith(`.${tailnet}.ts.net`)) {
    return `That machine isn’t on this workbench’s tailnet (${tailnet ?? 'none'}.ts.net), so the shell won’t load scripts from it.`;
  }
  return undefined;
};

/** Who is loading which app from where. */
export class LiveOverrides {
  private readonly byPerson = new Map<string, Map<string, string>>();
  /** `tailnet`: the workbench's own, from PLATFORM_URL (tailnetOf). */
  constructor(
    readonly ring: Ring,
    readonly tailnet?: string,
  ) {}

  /** Why nobody can load an app live here, or nothing when they can. */
  get problem() {
    if (this.ring !== 'dev') return LIVE_ONLY_ON_DEV;
    if (!this.tailnet) return LIVE_NEEDS_TAILNET;
    return undefined;
  }

  get allowed() {
    return !this.problem;
  }

  /** Why `url` can't be loaded live here, or nothing. */
  urlProblem(url: string) {
    return liveUrlProblem(url, this.tailnet);
  }

  /** The entry `person` loads `app` from, while the server is the workbench. */
  of(person: string | undefined, app: string) {
    return this.allowed && person ? this.byPerson.get(person)?.get(app) : undefined;
  }

  /** Every app `person` loads live, by app. */
  all(person: string) {
    return this.allowed ? new Map(this.byPerson.get(person) ?? []) : new Map<string, string>();
  }

  set(person: string, app: string, url: string | null) {
    const mine = this.byPerson.get(person) ?? new Map<string, string>();
    if (url === null) mine.delete(app);
    else mine.set(app, url);
    if (mine.size) this.byPerson.set(person, mine);
    else this.byPerson.delete(person);
  }
}
