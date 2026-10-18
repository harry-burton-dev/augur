import type { AppManifestEntry, MicroFrontend, MountContext } from '@platform/mfe-sdk';

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
  private current: { app: AppManifestEntry; mfe: MicroFrontend; el: HTMLElement } | null = null;
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

  /** Unmounts whatever is open and mounts `app`. A newer call wins over a slower older one. */
  async mount(app: AppManifestEntry, ctx: MountContext): Promise<void> {
    const generation = ++this.generation;
    let mfe: MicroFrontend;
    try {
      mfe = await this.resolve(app);
    } catch (err) {
      // The person asked to leave the open app; don't leave it showing behind the problem.
      if (generation === this.generation) await this.unmount();
      throw err;
    }
    if (generation !== this.generation) return;
    await this.unmount();
    const el = document.createElement('div');
    el.dataset.app = app.id;
    el.style.display = 'contents';
    this.stage.append(el);
    this.current = { app, mfe, el };
    try {
      await mfe.mount(el, ctx);
    } catch {
      await this.unmount();
      throw new MountError(app, `${app.name} couldn't open. Nothing was lost; try again.`);
    }
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
