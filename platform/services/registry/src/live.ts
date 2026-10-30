import type { Ring } from './ring.ts';

/**
 * Live on the workbench (docs/release-channels.md, "Live on the workbench"): an app's developer loads its
 * frontend from their own machine's `pnpm dev:app <id> --live`, over the tailnet, in the real shell with
 * real sign-in, floors and data, for them alone. Only on the workbench (SERVER_RING=dev), whose front door
 * lets the shell load scripts from `*.ts.net`. Kept in memory: a restart puts everyone back on the app.
 */
export const LIVE_ONLY_ON_DEV = 'Only the workbench (SERVER_RING=dev) loads an app from your machine.';

/** A frontend entry on a machine on the tailnet: https, a *.ts.net name, and a JavaScript or TypeScript module. */
const LIVE_URL = /^https:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+ts\.net(:\d{1,5})?\/[^\s?#]*\.(?:m?js|ts)$/;

/** Why `url` can't be loaded live, or nothing. */
export const liveUrlProblem = (url: string) =>
  url.length > 2048 || !LIVE_URL.test(url)
    ? 'That isn’t an app entry on your machine. Use the address `pnpm dev:app <id> --live` prints: https://<your machine>.ts.net/…/entry.ts.'
    : undefined;

/** Who is loading which app from where. */
export class LiveOverrides {
  private readonly byPerson = new Map<string, Map<string, string>>();
  constructor(readonly ring: Ring) {}

  get allowed() {
    return this.ring === 'dev';
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
