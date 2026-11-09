import type { AppManifestEntry, MountContext } from '@augur/mfe-sdk';
import { isWorkerApp, type WorkerApp } from './apps3.js';
import { AppMounter, importEntry, type ImportEntry } from './mount.js';
import { SIGN_IN_AGAIN_PATH } from './session.js';
import { WorkerMounter, workerCard, type WorkerContext, type WorkerHostOptions } from './worker-host.js';

export interface StageOptions extends WorkerHostOptions {
  /** Moves to `path` inside `app`, for an app on the contract, which asks rather than touching the address. */
  navigate(app: AppManifestEntry, path: string): void;
  /** Sends the person to enter their password again and back to where they are; the shell's `/auth/again` by default. */
  signInAgain?(): void;
}

/** Asks for the password again and comes back to this address (session.ts, SIGN_IN_AGAIN_PATH). */
export const signInAgainHere = (where: Pick<Location, 'pathname' | 'search' | 'assign'> = window.location) =>
  where.assign(`${SIGN_IN_AGAIN_PATH}?return=${encodeURIComponent(where.pathname + where.search)}`);

/** A contract 3 app's context, from the one the shell makes for every app: the same person, floor and ways to raise, ask and tell. */
export const workerContext = (app: WorkerApp, ctx: MountContext, navigate: StageOptions['navigate'], signInAgain: () => void = signInAgainHere): WorkerContext => ({
  person: { id: ctx.user.id, name: ctx.user.name },
  workspace: { id: ctx.workspace.id, kind: ctx.workspace.kind, name: ctx.workspace.name },
  path: ctx.path,
  intent: ctx.intent,
  reply: ctx.reply,
  getToken: ctx.getToken,
  fetchImpl: ctx.fetch as typeof fetch,
  navigate: (path) => navigate(app, path),
  notify: (message) => ctx.notify(message),
  signInAgain,
  raise: (intent) => ctx.raise(intent),
  request: (intent) => ctx.request(intent),
});

/** Home's cards for apps on the contract: each runs its app's worker, which moves into the app through `navigate`. */
export const workerCards =
  (navigate: StageOptions['navigate'], options: WorkerHostOptions = {}) =>
  (app: WorkerApp, ctx: MountContext) =>
    workerCard(app, workerContext(app, ctx, navigate), options);

/**
 * The stage's one open app, whichever contract it is on: an app on the app contract runs in a worker
 * (WorkerMounter); the shell's own frontends (Home, Admin, the Upgrade Centre) are still mounted into
 * the page on SDK 2 (AppMounter). Opening one takes the other off.
 */
export class StageMounter {
  readonly #apps: AppMounter;
  readonly #workers: WorkerMounter;

  constructor(
    stage: HTMLElement,
    load: ImportEntry = importEntry,
    private readonly options: StageOptions,
  ) {
    this.#apps = new AppMounter(stage, load);
    this.#workers = new WorkerMounter(stage, options);
  }

  get mounted(): AppManifestEntry | null {
    return this.#workers.mounted ?? this.#apps.mounted;
  }

  /** The open app's worker session, when it is on the contract. */
  get session() {
    return this.#workers.session;
  }

  async mount(app: AppManifestEntry, ctx: MountContext): Promise<'mounted' | 'kept'> {
    if (isWorkerApp(app)) {
      await this.#apps.unmount();
      return this.#workers.mount(app, workerContext(app, ctx, this.options.navigate, this.options.signInAgain));
    }
    this.#workers.unmount();
    return this.#apps.mount(app, ctx);
  }

  async unmount(): Promise<void> {
    this.#workers.unmount();
    await this.#apps.unmount();
  }
}
