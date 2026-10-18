/** One entry in the registry manifest the shell loads at startup. */
export interface AppManifestEntry {
  id: string;
  name: string;
  /** Route prefix the shell maps to this app, e.g. "/library". */
  route: string;
  /** URL of the app's ES module entry, which default-exports an MicroFrontend. */
  entry: string;
  version: string;
  /** One line about the app, shown under its name in the Shell's Apps view. */
  description?: string;
  /** A UI kit icon name for the app. */
  icon?: string;
  /** Role required to see the app; omitted means every signed-in user. */
  requiredRole?: string;
  /** Intent types this app can handle, e.g. "document.open". */
  handles?: string[];
}

export interface User {
  id: string;
  name: string;
  departments: string[];
  roles: string[];
}

/** A request to do something, routed by the shell to whichever app handles it. */
export interface Intent<T = unknown> {
  type: string;
  payload: T;
}

export type Unsubscribe = () => void;

export interface EventBus {
  emit<T>(type: string, payload: T): void;
  on<T>(type: string, handler: (payload: T) => void): Unsubscribe;
}

/** What the shell hands a micro frontend when it mounts it. */
export interface MountContext {
  user: User;
  /** Returns a current access token for calling the gateway. */
  getToken(): Promise<string>;
  bus: EventBus;
  /** Ask the shell to route an intent; no app calls another directly. */
  raise(intent: Intent): Promise<void>;
  notify(message: { title: string; body?: string; needsYou?: boolean }): void;
  /** Path below the app's route prefix, e.g. "/doc/123" for "/library/doc/123". */
  path: string;
  /** Present when the app was opened to handle an intent. */
  intent?: Intent;
}

export interface MicroFrontend {
  mount(el: HTMLElement, ctx: MountContext): void | Promise<void>;
  unmount?(el: HTMLElement): void | Promise<void>;
}

/** Identity helper so an app's entry gets type checking. */
export const defineMicroFrontend = (mfe: MicroFrontend): MicroFrontend => mfe;
