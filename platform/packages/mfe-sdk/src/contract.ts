import type { Focus } from './refs.js';

/**
 * The kinds of app that ship with AUGUR (SDK 1.11, ADR 0032): `platform`, for
 * using and managing AUGUR, and `pillar`, the foundation of what AUGUR
 * produces. Every other app is just an app and has no kind. A later kind is
 * added in a minor, so a reader treats a value it doesn't know as no kind.
 */
export const APP_CATEGORIES = ['platform', 'pillar'] as const;
/** One of `APP_CATEGORIES` (SDK 1.11). */
export type AppCategory = (typeof APP_CATEGORIES)[number];

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
   * The app's menu. The shell shows it as Orbit at the app's root; choosing
   * an item opens the app at its `path`. A group with one item opens it
   * directly. Without a menu, the app opens straight away.
   */
  menu?: AppMenuCategory[];
  /**
   * The broad parts of what the app covers, such as Admin's Organisation and
   * System (SDK 1.5): what Title lists under the app. Each menu group names
   * its `area`. With fewer than two, Title shows the app alone, never a
   * doubled item. Nothing repeats its parent: an area's label and icon differ
   * from the app's. See docs/shell-principles.md.
   */
  areas?: AppArea[];
  /**
   * `false`: the app keeps its own menu inside it, so the shell never shows
   * its Orbit. Choosing it or one of its areas in Title opens the app there;
   * its root opens the app itself, Esc doesn't leave it, and the way back to
   * the shell is the top bar's Home and All apps (SDK 1.4).
   */
  orbit?: boolean;
  /**
   * `true`: the app shows the same on every floor, as Admin does, so moving
   * floors inside it would change nothing. The shell's floor gauge rests while
   * it's open, staying in view and saying why (SDK 1.6).
   */
  sameOnEveryFloor?: boolean;
  /** The kinds of floor the app works on. Without it, every kind. */
  floors?: WorkspaceKind[];
  /**
   * What the app shows on each kind of floor, for the shell to place. Each
   * names a `module`: a key of the entry's `surfaces` (SDK 1.2).
   */
  surfaces?: ManifestSurface[];
  /**
   * The app's service answers `GET /v1/search?q=` with a `SearchAnswer`, and
   * the shell's Find asks it, through the gateway on the person's floor, as
   * they type (SDK 1.3).
   */
  search?: boolean;
  /**
   * The largest request the gateway lets through to the app's service, in MB
   * (SDK 1.3): what its manifest asks, or less where an admin lowered it. The
   * registry always fills it in; an app checks a file against it before sending.
   */
  maxUpload?: number;
  /**
   * Features the app is trying before they're everyone's (SDK 1.7). Admins say
   * who gets each (off, those who turn it on, or everyone) in Admin → Apps,
   * people turn the opt-in ones on in the shell's Previews, and the app asks
   * `ctx.previewOn(id)`. An app keeps working with every preview off.
   */
  previews?: FeaturePreview[];
  /** The ids of the app's previews that are on for the person: the registry fills it in (SDK 1.7). */
  previewsOn?: string[];
  /**
   * `true`: the app can narrow what it shows to a working context inside the
   * floor, read from `ctx.focus` (SDK 1.10). Reserved (ADR 0029): the shell
   * doesn't offer a working context yet, so this changes nothing today.
   */
  focus?: boolean;
  /**
   * `true`: the app follows the address itself, as the app kit's router does,
   * so Back and Forward inside its route don't mount it again (SDK 1.11). While
   * the same app stays open on the same floor and no intent is waiting for it,
   * the shell keeps it mounted and calls its `navigated` with the new path.
   * Without it, every move mounts the app again at the new path.
   */
  followsAddress?: boolean;
  /**
   * What kind of app this is (SDK 1.11, ADR 0032): `platform`, for using and
   * managing AUGUR, or `pillar`, the foundation of what AUGUR produces. Only
   * apps that ship with AUGUR or come from its signed app feed can be either;
   * every other app is just an app. The registry gives the shell the kind in
   * force, so an app's claim the registry doesn't honour arrives as no kind.
   */
  category?: AppCategory;
}

/** A feature an app is trying out (SDK 1.7). */
export interface FeaturePreview {
  /** How the app names it in `ctx.previewOn`: "board-view". */
  id: string;
  /** What people see in Previews: "Board view". */
  name: string;
  /** A sentence on what it changes. */
  detail?: string;
  /** Its last day, YYYY-MM-DD. After it, it's off for everyone, and Admin says to drop it or ship it. */
  until?: string;
}

/**
 * What an app's service answers to `GET /v1/search?q=`: what it holds that
 * matches, best first, and only what the person who asked can open. The shell
 * shows at most ten, under the app's name, and opens one at its `path`.
 */
export interface SearchAnswer {
  results: SearchResult[];
}

export interface SearchResult {
  /** Unique within the app. */
  id: string;
  title: string;
  /** One line: what kind of thing it is, where it lives, when it changed. */
  detail?: string;
  /** Where in the app it opens, below the app's route, e.g. "/doc/7". Without one, the app opens at its start. */
  path?: string;
  /** The floor it's on, by id, when that isn't the one asked from. Results on the person's floor are listed first. */
  workspace?: string;
}

/**
 * One thing an app shows on one kind of floor. The shell places `card`s on
 * Home (SDK 1.2); the other slots are declared and checked, and placed later.
 */
export interface ManifestSurface {
  /** "team" means any team, at any depth. */
  floor: WorkspaceKind;
  slot: 'page' | 'card' | 'panel' | 'settings' | 'admin';
  /** The key in the entry's `surfaces` that draws it, e.g. "./TeamClaims". */
  module: string;
  /** Only for people with this role on the floor. */
  role?: 'member' | 'lead';
  /** Shows this floor and the teams below it that the person is on. */
  rollup?: boolean;
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
  /** The `id` of the app's area the group belongs to (SDK 1.5). */
  area?: string;
  items: AppMenuItem[];
}

/** One broad part of what an app covers, listed in Title (SDK 1.5). */
export interface AppArea {
  /** Unique in the app; menu groups name it in `area`. */
  id: string;
  label: string;
  /** A UI kit icon name, not the app's own. */
  icon?: string;
  /** One line on what's in it. Without one, Title names the area's first groups. */
  detail?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  /** The sign-in service's old department names. Read `ctx.workspace` for where the person is. */
  departments: string[];
  roles: string[];
}

export type WorkspaceKind = 'personal' | 'team' | 'org';

/** A floor as a link or breadcrumb draws it. */
export interface WorkspaceRef {
  id: string;
  kind: WorkspaceKind;
  /** What people see: "You" for their own floor, a team's name, the org's name. */
  name: string;
  /** The word in links, `/@finance/…`; the person's own floor is always `me`. */
  slug: string;
  /**
   * Teams only: what the team's level is called, "Department" right below the
   * org and "Team" below that unless an admin renamed them (SDK 1.9). Say it
   * where you'd say "team"; `kind` stays `team` at every level.
   */
  level?: string;
}

/**
 * The floor the person is standing on: their own, a team, or the org. The
 * shell owns it and apps only read it; backends never trust it from the
 * browser, as the gateway checks it on every `ctx.fetch`.
 */
export interface Workspace extends WorkspaceRef {
  /** From the org down to this floor, itself included. The person's own floor is alone on its path. */
  path: WorkspaceRef[];
  /** `lead` on their own floor and on teams they lead. */
  role: 'member' | 'lead';
}

/** What an app tells the person through the shell's stream. */
export interface NotifyMessage {
  title: string;
  body?: string;
  /** The person has to do something: it's marked, counted in the band, and shown on Home. */
  needsYou?: boolean;
  /** Up to two things to do right from the stream, such as "Approve" and "Open" (SDK 1.2). Extras are dropped. */
  actions?: NotificationAction[];
}

/** A button on a notification: pressing it raises `intent` through the shell, and marks the notification read. */
export interface NotificationAction {
  /** One or two words: "Approve", "Open". */
  label: string;
  intent: Intent;
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
  /**
   * A notification on the shell's stream. `actions` (SDK 1.2) puts up to two
   * buttons on it, each raising an intent through the shell when pressed,
   * exactly as `raise` does; the app runs no code in the stream.
   */
  notify(message: NotifyMessage): void;
  /**
   * The floor the app was mounted on (SDK 1.1). Changing floor unmounts the
   * app and mounts it again with the new one, so an app never shows one
   * floor's data on another.
   */
  workspace: Workspace;
  /** The current floor, for code that runs later than mount and shouldn't trust a copy it kept (SDK 1.1). */
  getWorkspace(): Workspace;
  /**
   * Calls the gateway for this floor (SDK 1.1): `fetch` with the person's
   * token and the floor's `X-Workspace-Id` added, e.g. `ctx.fetch('/api/library/v1/docs')`.
   */
  fetch(path: string, init?: RequestInit): Promise<Response>;
  /** Path below the app's route prefix, e.g. "/doc/123" for "/library/doc/123". */
  path: string;
  /** Present when the app was opened to handle an intent. */
  intent?: Intent;
  /** Present when the app was opened to answer a request: give the answer, or cancel. */
  reply?: IntentReply;
  /**
   * Whether one of the app's feature previews (its manifest's `previews`) is
   * on for this person (SDK 1.7). False for an id the manifest doesn't list.
   * Turning one on or off mounts the app again, so the answer holds while it's mounted.
   */
  previewOn(id: string): boolean;
  /**
   * The working context the person chose inside the floor, such as an
   * operation and its phase (SDK 1.10). Reserved (ADR 0029): always undefined
   * until the shell offers working contexts. Undefined means the whole floor.
   */
  focus?: Focus;
}

export interface IntentReply {
  respond(result: unknown): void;
  cancel(): void;
}

export interface MicroFrontend {
  mount(el: HTMLElement, ctx: MountContext): void | Promise<void>;
  unmount?(el: HTMLElement): void | Promise<void>;
  /**
   * The shell kept the app mounted through a move inside its route, Back or
   * Forward or a link, because its manifest sets `followsAddress` (SDK 1.11).
   * `path` is below the app's route, as `ctx.path` is at mount; `ctx.path`
   * keeps the path it was mounted at. An app whose router reads the address
   * itself has nothing to do here.
   */
  navigated?(el: HTMLElement, path: string): void;
  /**
   * The app's smaller pieces the shell places outside the app itself, by the
   * `module` its manifest's `surfaces` name (SDK 1.2): a glance card on Home,
   * for one. Each is mounted with the same context as the app, at path `/`.
   */
  surfaces?: Record<string, Surface>;
}

/**
 * Something an app draws in a place the shell owns. A `card` fills a tile of
 * about 320 by 200 pixels: a few facts and one way in (`ctx.raise` or a link),
 * never a whole screen. It must render quickly and never block: Home mounts
 * up to six at once.
 */
export interface Surface {
  mount(el: HTMLElement, ctx: MountContext): void | Promise<void>;
  unmount?(el: HTMLElement): void | Promise<void>;
}

/** Identity helper so an app's entry gets type checking. */
export const defineMicroFrontend = (mfe: MicroFrontend): MicroFrontend => mfe;
