/** One entry in the registry manifest the shell loads at startup. */
export interface AppManifestEntry {
  id: string;
  name: string;
  /** Route prefix the shell maps to this app, e.g. "/library". */
  route: string;
  /** URL of the app's ES module entry, which default-exports an MicroFrontend. */
  entry: string;
  /** The app's own release, semver, e.g. "1.4.0". */
  version: string;
  /**
   * The SDK releases the app works with, as a semver range over SDK_VERSION,
   * e.g. "^1.2.0". The shell won't open an app whose range its SDK doesn't satisfy.
   */
  sdk: string;
  /** One line about the app, shown under its name in the Shell's Apps view. */
  description?: string;
  /** A UI kit icon name for the app. */
  icon?: string;
  /** Role required to see the app; omitted means every signed-in user. */
  requiredRole?: string;
  /** Intent types this app can handle, e.g. "document.open". */
  handles?: string[];
  /** The app is an AI: the menus draw it as a bubble. */
  ai?: boolean;
  /**
   * The app's menu. The shell shows it as Orbit at the app's root, and as the
   * app's chapter in Title; choosing an item opens the app at its `path`.
   * Without one, the app opens straight away.
   */
  menu?: AppMenuCategory[];
}

/** One way into an app, shown in its menu. */
export interface AppMenuItem {
  id?: string;
  label: string;
  /** A UI kit icon name. */
  icon?: string;
  /** One short fact ("3 unread", "Updated today"), never a sentence. */
  detail?: string;
  /** Extra words search should find it by. */
  keywords?: string;
  ai?: boolean;
  /** Where in the app it opens, below the app's route, e.g. "/documents". */
  path: string;
}

/** A group of an app's menu items: one stop on the Orbit ring. */
export interface AppMenuCategory {
  id?: string;
  label: string;
  icon?: string;
  ai?: boolean;
  items: AppMenuItem[];
}

export interface User {
  id: string;
  name: string;
  email?: string;
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
  /** Open whichever app handles the intent, with the intent in its context. No app calls another directly. */
  raise(intent: Intent): Promise<void>;
  /**
   * Ask whichever app handles the intent for an answer, e.g. "pick a document".
   * The shell opens that app over this one and resolves with what it returns.
   * Rejects with an IntentCancelled error (see isIntentCancelled) when the
   * person closes it, and an IntentError when no app they can open handles it.
   */
  request<T = unknown>(intent: Intent): Promise<T>;
  notify(message: { title: string; body?: string; needsYou?: boolean }): void;
  /** Path below the app's route prefix, e.g. "/doc/123" for "/library/doc/123". */
  path: string;
  /** Present when the app was opened to handle an intent. */
  intent?: Intent;
  /** Present when the app was opened to answer a request: give the answer, or cancel. */
  reply?: IntentReply;
}

export interface IntentReply {
  respond(result: unknown): void;
  cancel(): void;
}

export interface MicroFrontend {
  mount(el: HTMLElement, ctx: MountContext): void | Promise<void>;
  unmount?(el: HTMLElement): void | Promise<void>;
}

/** Identity helper so an app's entry gets type checking. */
export const defineMicroFrontend = (mfe: MicroFrontend): MicroFrontend => mfe;
