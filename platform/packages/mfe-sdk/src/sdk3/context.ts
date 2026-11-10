/**
 * SDK 3: the contract between the shell and an app's frontend under the app contract (contract 3,
 * ADR 0075 and 0076). The app's code runs in a web worker with no DOM and no network; the shell's
 * host draws what the app describes, through Quill's remote vocabulary, and makes every call for it.
 * `start(ctx)` is the one thing an app exports. These are the types; the runtime arrives with the
 * worker host (the plan's P6b). Names here are the spec's (section 6) and are normative.
 */
import type { Intent, WorkspaceKind } from '../contract.js';

/** The contract major this SDK speaks: manifest 3, release file v2, resource types v1, gateway API v1. */
export const CONTRACT_MAJOR = 3;

/** The person the app runs for. The frontend never sees their token, email or roles: a part reads those from the signed caller. */
export interface Person {
  id: string;
  name: string;
}

/** The floor the app runs on. Changing floor restarts the worker, so an app never shows one floor's data on another (spec 6.14). */
export interface Workspace {
  id: string;
  kind: WorkspaceKind;
  /** What people see: "You" for their own floor, a team's name, the org's name. */
  name: string;
}

/**
 * A node the app describes for the host to draw: an element of Quill's remote vocabulary by name,
 * with its props and children, or text. The kit's remote package builds these; an app rarely writes
 * them by hand. An element outside the host's allowlist is dropped with a console reason (spec 6.7).
 */
export type RemoteNode = RemoteElement | string | null | undefined | RemoteNode[];
export interface RemoteElement {
  /** The element's name, such as `quill-list`. */
  type: string;
  props?: Record<string, unknown>;
  children?: RemoteNode;
}

/** A root the app renders a tree into: the screen, an About section or the Home card (spec 6.8). */
export interface FrameRoot {
  /** Draws `node` in this root, replacing what was there. The host batches and virtualises. */
  render(node: RemoteNode): void;
  /** Clears the root. */
  clear(): void;
}

/** The width of the one main column of work (PDR-014): reading width, wide, or the whole pane. */
export type FrameWidth = 'read' | 'wide' | 'full';

/**
 * How the shell lays out the app's pane. Each is the shell's, drawn from the kit's tokens, with the app
 * bar and the page head in every one: `focus`, one main column and no About panel; `aside`, the main
 * column and the About panel beside it; `split`, a list column beside its detail; `canvas`, one column
 * edge to edge, for a map, a graph or the full canvas.
 */
export type FrameLayout = 'focus' | 'aside' | 'split' | 'canvas';

/** How tightly the app's pane is spaced: the app's default, which the person's own setting overrides. */
export type FrameDensity = 'comfortable' | 'compact';

/** How far the app's screen sits in from the pane's edges: the standard inset, or flush for a canvas or media. The page head keeps its inset either way. */
export type FrameInset = 'standard' | 'flush';

/** An action the app offers in its pane's heading; `command` names one of the manifest's `contributes.commands`. */
export interface FrameAction {
  command: string;
  /** Shown instead of the command's label, when the moment needs other words. */
  label?: string;
  /** Not available now, with the reason the host shows (explain, never hide). */
  unavailable?: string;
}

/** What the app sets about its own pane; the shell draws the app bar, the rail and the About panel itself. */
export interface FrameState {
  /** The heading of the app's own pane. The manifest's `name` stays the app bar's entry. */
  title?: string;
  actions?: FrameAction[];
  /** The pane is working on something; the host shows it without the app drawing a spinner. */
  busy?: boolean;
  width?: FrameWidth;
  /** The pane's layout for this page; the manifest's `contributes.frame.layout`, else `aside` with About sections and `focus` without, until set. */
  layout?: FrameLayout;
  /** The pane's spacing for this page; the person's own density setting still wins. */
  density?: FrameDensity;
  /** Whether the screen sits in from the pane's edges or against them. */
  inset?: FrameInset;
}

/** Something sitting under a place that `fills` (spec 6.3), such as one notebook under Notebooks. */
export interface PlaceItem {
  label: string;
  icon?: string;
  detail?: string;
  /** Below `/<id>`. */
  path: string;
}

/** The extension points an app fills at run time (spec 6.8). Everything else the shell draws from the manifest. */
export interface Frame {
  /** The screen's main content. */
  screen: FrameRoot;
  /** The content of a declared About section (`contributes.about`), by id. */
  about(id: string): FrameRoot;
  /** The Home card, for an app that declares `contributes.card`. */
  card: FrameRoot;
  /** Sets the pane's title, actions, busy state, width and layout; fields left out keep their value. */
  set(state: FrameState): void;
  /** What sits under a declared place that `fills`. The shell caps the list and shows "and n more". */
  under(placeId: string, items: PlaceItem[]): void;
  /** Handles a declared command. A command with no handler yet is shown unavailable, saying the app hasn't loaded it. */
  onCommand(id: string, handler: (detail?: unknown) => void | Promise<void>): () => void;
}

/** Files cross the bridge as bytes; the token never does (spec 6.10). */
export interface Files {
  /** Hands the bytes to the host, which calls the app's route with the person's token and the app header. */
  upload(blob: Blob, path: string): Promise<Response>;
  /** Fetches the bytes through the host, or asks the host to save them for the person. */
  download(path: string, options?: { save?: boolean }): Promise<Blob | undefined>;
  /** Files dropped on the app's pane from the desktop, or chosen with a `quill-file-button`, land in the host, which forwards them here. */
  onDrop(handler: (files: File[]) => void | Promise<void>): () => void;
}

/** The full-canvas frame of an app that declares `contributes.canvas` (spec 6.11): the one place an app draws its own pixels. */
export interface Canvas {
  /**
   * Opens the canvas at `entry`, one script inside the release's bundle beside the app's entry; the host
   * sizes it and stops it with the app. The port is the canvas's only way out: what the app posts on it
   * reaches the canvas's `augurCanvas` port, and back.
   */
  open(entry: string): Promise<MessagePort>;
  /** Takes the canvas away; the screen shows again. */
  close(): void;
}

/** What an app tells the person through the shell's stream. */
export interface Notice {
  title: string;
  body?: string;
  /** One of the manifest's `contributes.notifications.kinds` ids. */
  kind?: string;
  needsYou?: boolean;
}

/**
 * What `start(ctx)` receives, over the bridge, when the worker starts. The host sets the app's id on
 * every call itself; nothing here lets the app name another app or reach the page (spec 6.5, 6.6).
 */
export interface AppContext {
  person: Person;
  workspace: Workspace;
  /** The path below `/<id>` the app was opened at; the host owns the URL (spec 6.12). */
  path: string;
  /**
   * What the shell runs the app for: `'screen'` in the stage, or `'card'` when Home runs it only for
   * its card, which needs no screen. From a card, navigate, raise and request work only just after
   * the person pressed something in it.
   */
  surface: 'screen' | 'card';
  /** Called on every move the host makes inside the app, with the new path below `/<id>`. */
  onNavigate(handler: (path: string) => void): () => void;
  /** Asks the host to move to `path`, below `/<id>`. */
  navigate(path: string): void;
  /**
   * Calls the gateway for this floor: `path` is under `/api/` (the app's own routes as `/api/<id>/…`);
   * an absolute URL is refused. The host adds the token, the floor and the app header, and the body
   * comes back as bytes (spec 6.6).
   */
  fetch(path: string, init?: RequestInit): Promise<Response>;
  frame: Frame;
  files: Files;
  /** Present only for an app whose manifest declares `contributes.canvas`. */
  canvas?: Canvas;
  /** Opens whichever app handles the intent. No app calls another directly. */
  raise(intent: Intent): Promise<void>;
  /** Asks whichever app handles the intent for an answer, such as "pick a document". */
  request<T = unknown>(intent: Intent): Promise<T>;
  notify(notice: Notice): void;
  /**
   * Asks the person for their password again, then opens the app where it is now (SDK 3.1). For a call
   * the platform turned down with `401` and `sign_in_again`, because what it does needs a fresh sign-in,
   * such as going back to an earlier release. The page leaves the app to sign in, so keep what the person
   * typed in the address (`navigate`) if they should find it again. From a card, only just after the
   * person pressed something in it.
   */
  signInAgain(): void;
  /** Present when the app was opened to handle an intent. */
  intent?: Intent;
  /** Present when the app was opened to answer a request: give the answer, or cancel. */
  reply?: { respond(result: unknown): void; cancel(): void };
  /** Whether one of the manifest's `previews` is on for this person. */
  previewOn(id: string): boolean;
}

/** What the app's entry module default-exports: called once when the worker starts; the returned function, if any, runs when the app is stopped. */
export type Start = (ctx: AppContext) => void | (() => void) | Promise<void | (() => void)>;

/** Identity helper so an app's entry gets type checking: `export default defineApp((ctx) => { … })`. */
export const defineApp = (start: Start): Start => start;
