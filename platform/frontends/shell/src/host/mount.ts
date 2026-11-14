import type { AppManifestEntry, MicroFrontend, MountContext } from '@augur/mfe-sdk';
import { incompatibility } from './manifest.js';

export type ImportEntry = (url: string) => Promise<{ default?: unknown }>;

/** The browser's own dynamic import; kept behind a function so tests can stand in for it. */
export const importEntry: ImportEntry = (url) => import(/* @vite-ignore */ url);

const isMicroFrontend = (x: unknown): x is MicroFrontend =>
  !!x && typeof x === 'object' && typeof (x as MicroFrontend).mount === 'function';

export class MountError extends Error {
  constructor(
    readonly app: AppManifestEntry,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Mounts one app at a time into the stage. Each app gets its own element, so an
 * app that misbehaves on unmount can't leave anything behind for the next one.
 */
export class AppMounter {
  private current: { app: AppManifestEntry; mfe: MicroFrontend; el: HTMLElement; floor: string } | null = null;
  private loads = new Map<string, Promise<MicroFrontend>>();
  private generation = 0;

  constructor(
    private readonly stage: HTMLElement,
    private readonly load: ImportEntry = importEntry,
  ) {}

  get mounted(): AppManifestEntry | null {
    return this.current?.app ?? null;
  }

  private resolve(app: AppManifestEntry): Promise<MicroFrontend> {
    const unsupported = incompatibility(app);
    if (unsupported) return Promise.reject(new MountError(app, unsupported));
    let pending = this.loads.get(app.entry);
    if (!pending) {
      pending = this.load(app.entry).then(
        (mod) => {
          if (!isMicroFrontend(mod.default)) throw new MountError(app, `${app.name} didn't load as an app the shell can open.`);
          return mod.default;
        },
        () => {
          throw new MountError(app, `${app.name} isn't available right now. Nothing was lost; try again.`);
        },
      );
      // A failed load is not cached, so Try again really tries again.
      pending.catch(() => this.loads.delete(app.entry));
      this.loads.set(app.entry, pending);
    }
    return pending;
  }

  /**
   * Unmounts whatever is open and mounts `app`. A newer call wins over a slower older one.
   *
   * An app whose manifest sets `followsAddress` and that gives `navigated` stays mounted instead when it is
   * already open, from the same catalogue entry (so the same floor and previews), on the same floor, and
   * nothing is waiting for it (an intent or a request): the shell tells it the new path. Both are needed,
   * because the shell's own moves (Find, menus, notifications) push the address without a popstate, so an
   * app that can't hear them would show the old place. Resolves `'kept'` then, else `'mounted'`.
   */
  async mount(app: AppManifestEntry, ctx: MountContext): Promise<'mounted' | 'kept'> {
    const generation = ++this.generation;
    const open = this.current;
    if (open && app.followsAddress && open.mfe.navigated && open.app === app && open.floor === ctx.workspace.id && !ctx.intent && !ctx.reply) {
      try {
        open.mfe.navigated(open.el, ctx.path);
      } catch {
        // An app that trips over the news is mounted again, as one without the flag would be.
        return this.mountFresh(app, ctx, generation);
      }
      return 'kept';
    }
    return this.mountFresh(app, ctx, generation);
  }

  private async mountFresh(app: AppManifestEntry, ctx: MountContext, generation: number): Promise<'mounted' | 'kept'> {
    let mfe: MicroFrontend;
    try {
      mfe = await this.resolve(app);
    } catch (err) {
      // The person asked to leave the open app; don't leave it showing behind the problem.
      if (generation === this.generation) await this.unmount();
      throw err;
    }
    if (generation !== this.generation) return 'mounted';
    await this.unmount();
    const el = document.createElement('div');
    el.dataset.app = app.id;
    el.style.display = 'contents';
    this.stage.append(el);
    this.current = { app, mfe, el, floor: ctx.workspace.id };
    try {
      await mfe.mount(el, ctx);
    } catch {
      await this.unmount();
      throw new MountError(app, `${app.name} couldn't open. Nothing was lost; try again.`);
    }
    return 'mounted';
  }

  async unmount(): Promise<void> {
    const open = this.current;
    if (!open) return;
    this.current = null;
    try {
      await open.mfe.unmount?.(open.el);
    } finally {
      open.el.remove();
    }
  }
}
