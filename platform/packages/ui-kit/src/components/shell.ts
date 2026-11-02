import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { base, label } from '../shared.js';
import { animate, motionMode, tokenEasing, tokenValue } from '../motion.js';
import { settleSurfaces } from './surface.js';
import { floorBeside, floorDirection, floorIconOf, floorKindOf, floorLevel, floorMeaning, floorStack, floorTone, type FloorDirection, type ShellFloor } from './floors.js';
import { statusUrgency, type StatusName } from './status.js';
import './icon.js';
import './menu.js';
import './status.js';
import './wave.js';
import type { UiWaveBackground } from './wave.js';
import type { MenuAction, UiMenu } from './menu.js';

export type NotificationLevel = 'needs' | 'info' | 'running' | 'done' | 'failed';

export interface ShellNotification {
  id: string;
  /** The app id that raised it. */
  app: string;
  level: NotificationLevel;
  title: string;
  detail?: string;
  /** When it happened: a Date, epoch ms or an ISO string. */
  time: Date | number | string;
  /** The floor it's from, by id: tagged with that floor's name, and a dot on the gauge until it's dealt with. */
  floor?: string;
  /** Up to two things to do about it right from the stream ("Approve", "Open"); the host does them. Extras are dropped. */
  actions?: ShellNotificationAction[];
}

export interface ShellNotificationAction {
  label: string;
}

export interface ShellApp {
  id: string;
  name: string;
  /** One line about it, shown under the name in Apps. */
  line?: string;
  icon?: string;
  /** AI apps carry the bubble. */
  ai?: boolean;
  /** It shows the same on every floor, so the gauge rests while it's open and says why. */
  sameOnEveryFloor?: boolean;
}

export interface ShellAgent {
  id: string;
  name: string;
  detail?: string;
  status: StatusName;
  /** The app that opens when the agent is chosen. */
  app?: string;
}

export interface ShellFunction {
  id: string;
  label: string;
  icon: string;
}

/**
 * A way to go that works from every screen, drawn as a round button top left
 * beside the floor: Home, Title. The one you're on is marked, and one that
 * can't be used stays and says why.
 */
export interface ShellNav {
  id: string;
  label: string;
  icon: string;
  /** You're here already. */
  current?: boolean;
  /** Why it can't be used now, said instead of hiding it. */
  unavailable?: string;
}

export interface ShellFindResult {
  id: string;
  title: string;
  detail?: string;
  kind: 'app' | 'notification' | 'agent' | string;
  /** The name of the group it's listed under, such as the app it came from; ungrouped ones come first. */
  group?: string;
}

/**
 * A group of Find results the host is still gathering, such as one app's
 * content: `looking` says "Still looking…" until its results arrive, `late`
 * and `failed` say it didn't answer. A group that's `done` with no results isn't shown.
 */
export interface ShellFindGroup {
  name: string;
  state: 'looking' | 'done' | 'late' | 'failed';
}

export type ShellView = 'stream' | 'apps' | 'find' | 'agents' | 'account' | 'settings';

/** A host's own view for a function: return what goes under the dome. */
export type ShellViewRenderer = (shell: UiShell, back: () => void) => TemplateResult | HTMLElement;

export const defaultFunctions: ShellFunction[] = [
  { id: 'apps', label: 'Apps', icon: 'apps' },
  { id: 'find', label: 'Find', icon: 'find' },
  { id: 'agents', label: 'Agents', icon: 'agents' },
  { id: 'account', label: 'Account', icon: 'account' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const builtInViews = new Set<string>(['stream', 'apps', 'find', 'agents', 'account', 'settings']);

const toTime = (t: ShellNotification['time']) => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : Date.parse(t));

/** "now", "4 min", "2 h", "3 d": how long ago, in the fewest words. */
export function ago(time: ShellNotification['time'], now = Date.now()): string {
  const s = Math.max(0, (now - toTime(time)) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

/** Status in words, never a point alone: "1 needs you", "3 notifications", "All quiet". */
export function streamWords(list: ShellNotification[]): string {
  const needs = list.filter((n) => n.level === 'needs').length;
  if (needs) return `${needs} need${needs === 1 ? 's' : ''} you`;
  if (list.length) return `${list.length} notification${list.length === 1 ? '' : 's'}`;
  return 'All quiet';
}

const isTyping = (e: Event) => {
  const el = e.composedPath()[0] as HTMLElement | undefined;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/**
 * The frame every app runs inside. It holds who you are, the floor you're on,
 * system status, the apps and the notification stream, and nothing about any
 * app's domain. Apps go in the default slot (the stage).
 *
 * Summoned with ` or Ctrl/⌘ K, the handle or the status, it is like looking up
 * at the sky: the app tips away and darkens, and the sky holds only the stream
 * and the shell functions on a shallow arc. It never opens itself.
 *
 * @slot - the stage, where the current app mounts
 * @fires ui-toggle - detail `{ open }`
 * @fires ui-open-app - detail `{ id }`
 * @fires ui-nav - detail `{ id }` when one of `navs` is pressed; the host goes there from wherever you are
 * @fires ui-back - Back in the band was pressed (only with `backTo`, kept for hosts that still set it)
 * @fires ui-open-notification - detail `{ notification }`
 * @fires ui-notification-action - detail `{ notification, index }` when one of its actions is pressed; the Shell closes and the host does it
 * @fires ui-notifications - detail `{ notifications, muted }` after either changed, however it changed, for a host that shows them elsewhere too
 * @fires ui-mute - detail `{ app, muted }` when an app's group is muted or unmuted; the Shell has updated `muted`
 * @fires ui-dismiss - detail `{ ids }` when notifications are dismissed or cleared; the host may mark them read
 * @fires ui-restore - detail `{ ids }` when Undo brings them back
 * @fires ui-function - detail `{ id }` for functions without a view, and for Switch workspace and Sign out
 * @fires ui-floor - detail `{ id, direction }` when the person asks to go to another floor; the host goes there and sets `floor`
 * @fires ui-find - detail `{ q }`; the host may set `findResults` and `findGroups`
 * @fires ui-pick - detail `{ result }`
 * @fires ui-setting - detail `{ key, value }`
 * @fires ui-retry - detail `{ what: 'stream' | 'agents' }`
 * @fires ui-stream - the stream view opened; a host may refresh it
 */
export class UiShell extends LitElement {
  static override properties = {
    product: { type: String },
    workspace: { type: String },
    user: { attribute: false },
    online: { type: Boolean },
    statusLabel: { type: String, attribute: 'status-label' },
    apps: { attribute: false },
    current: { type: String },
    recent: { attribute: false },
    notifications: { attribute: false },
    muted: { attribute: false },
    agents: { attribute: false },
    agentsLoading: { type: Boolean, attribute: 'agents-loading' },
    agentsError: { type: String, attribute: 'agents-error' },
    functions: { attribute: false },
    views: { attribute: false },
    streamLoading: { type: Boolean, attribute: 'stream-loading' },
    streamError: { type: String, attribute: 'stream-error' },
    findResults: { attribute: false },
    findGroups: { attribute: false },
    settings: { attribute: false },
    away: { type: Boolean },
    canSwitchWorkspace: { attribute: false },
    navs: { attribute: false },
    backTo: { type: String, attribute: 'back-to' },
    area: { type: String },
    floors: { attribute: false },
    floor: { type: String },
    card: { state: true },
    said: { state: true },
    version: { type: String },
    background: { type: String, reflect: true },
    isOpen: { type: Boolean, reflect: true, attribute: 'open' },
    view: { type: String, reflect: true },
    focusIndex: { state: true },
    query: { state: true },
    undo: { state: true },
    now: { state: true },
  };

  /** The platform's name in the band. */
  declare product: string;
  declare workspace: string;
  declare user: { name: string; email?: string } | undefined;
  declare online: boolean;
  /** Overrides the status words in the band. */
  declare statusLabel: string;
  declare apps: ShellApp[];
  declare current: string;
  /** App ids, most recent first. */
  declare recent: string[];
  declare notifications: ShellNotification[];
  /**
   * App ids the person muted. Their notifications still land in the stream,
   * silently: no pulse, and they don't count in the band's words.
   */
  declare muted: string[];
  declare agents: ShellAgent[];
  declare agentsLoading: boolean;
  declare agentsError: string;
  declare functions: ShellFunction[];
  declare views: Partial<Record<string, ShellViewRenderer>>;
  declare streamLoading: boolean;
  declare streamError: string;
  declare findResults: ShellFindResult[];
  /** The groups of `findResults` in the order they're shown, each with whether it's still coming. */
  declare findGroups: ShellFindGroup[];
  /**
   * A person's settings. `areaTitles` (on unless false) shows an area title card on arriving at a floor or opening an app.
   * `toasts` (off unless true) tells the host to say each new notification once as a toast; the Shell itself still only pulses.
   */
  declare settings: { reduceMotion?: boolean; density?: 'comfortable' | 'compact'; areaTitles?: boolean; toasts?: boolean };
  declare away: boolean;
  /** Whether Account offers Switch workspace; a host with one workspace turns it off. Floors replace it. */
  declare canSwitchWorkspace: boolean;
  /**
   * Every floor the person can stand on. With floors, the top left shows the
   * current one's icon and name instead of the product, a gauge at the
   * edge shows the floors above and below, Account lists them all, and each
   * kind of floor gives the water its own colours and height.
   */
  declare floors: ShellFloor[];
  /** The ways to go from anywhere, top left beside the floor (see `ShellNav`). */
  declare navs: ShellNav[];
  /**
   * @deprecated The shell uses `navs` now. Where Back goes, in words ("Admin's menu", "all apps"); empty hides Back.
   * The host works it out from where you are: Back is always up one level.
   */
  declare backTo: string;
  /** The part of the open app you're in, said under its name; empty says only the app. */
  declare area: string;
  /** The id of the floor the person is on. Setting a new one plays the move. */
  declare floor: string;
  /** The area title card showing now, if any: arriving on a floor or opening an app. */
  declare card: AreaCard | null;
  /** Where you just arrived, in words, for screen readers. */
  declare said: string;
  /** What's running, shown in Settings; the host sets it. */
  declare version: string;
  /** The water's preset (Calm Tide unless a screen has a reason), or `none` for the still ground: the flat slate apps sit on. */
  declare background: string;
  declare isOpen: boolean;
  /** The function open under the dome, or '' for the dome itself. */
  declare view: string;
  declare focusIndex: number;
  declare query: string;
  declare undo: { label: string; items: ShellNotification[] } | null;
  declare now: number;

  private returnFocus: HTMLElement | null = null;
  private clock: ReturnType<typeof setInterval> | undefined;
  private arriveTimer: ReturnType<typeof setTimeout> | undefined;
  private cardTimer: ReturnType<typeof setTimeout> | undefined;
  /** The way the last floor move went, until the next screen has come in from the other side. */
  private inbound: FloorDirection | undefined;
  /** The app last arrived in, so its card plays once on opening it, not on every page of it. */
  private arrivedIn = '';
  /** Settles when the card showing now has ended. */
  private cardEnd: Promise<void> = Promise.resolve();
  private cardEnded: (() => void) | undefined;
  /** The team last stood on, so going up from your own floor goes back there. */
  private lastTeam: string | undefined;

  constructor() {
    super();
    this.product = 'AUGUR';
    this.workspace = '';
    this.user = undefined;
    this.online = true;
    this.statusLabel = '';
    this.apps = [];
    this.current = '';
    this.recent = [];
    this.notifications = [];
    this.muted = [];
    this.agents = [];
    this.agentsLoading = false;
    this.agentsError = '';
    this.functions = defaultFunctions;
    this.views = {};
    this.streamLoading = false;
    this.streamError = '';
    this.findResults = [];
    this.findGroups = [];
    this.settings = { reduceMotion: false, density: 'comfortable', areaTitles: true };
    this.away = false;
    this.canSwitchWorkspace = true;
    this.floors = [];
    this.navs = [];
    this.backTo = '';
    this.area = '';
    this.floor = '';
    this.card = null;
    this.said = '';
    this.version = '';
    this.background = 'Calm Tide';
    this.isOpen = false;
    this.view = '';
    this.focusIndex = 0;
    this.query = '';
    this.undo = null;
    this.now = Date.now();
  }

  /* ---- controller ---- */

  open() {
    if (this.isOpen) return;
    const active = document.activeElement;
    this.returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
    this.isOpen = true;
    this.view = '';
    this.focusIndex = this.streamSlot;
    this.emit('ui-toggle', { open: true });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.view = '';
    this.query = '';
    this.emit('ui-toggle', { open: false });
    const back = this.returnFocus;
    this.returnFocus = null;
    if (back?.isConnected) requestAnimationFrame(() => back.focus());
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  openView(id: string) {
    if (!this.isOpen) this.open();
    if (!builtInViews.has(id) && !this.views[id]) {
      this.emit('ui-function', { id });
      return;
    }
    this.view = id;
    if (id === 'stream') this.emit('ui-stream', {});
  }

  closeView() {
    const was = this.view;
    this.view = '';
    this.query = '';
    this.updateComplete.then(() => this.focusDome(Math.max(0, this.order.indexOf(was))));
  }

  /** Add a notification. It changes the status words and pulses the point once; the Shell never opens itself. */
  notify(n: ShellNotification) {
    this.notifications = [n, ...this.notifications.filter((x) => x.id !== n.id)];
    if (this.muted.includes(n.app)) return;
    this.toggleAttribute('arriving', true);
    clearTimeout(this.arriveTimer);
    this.arriveTimer = setTimeout(() => this.removeAttribute('arriving'), 700);
  }

  dismiss(id: string) {
    const gone = this.notifications.filter((n) => n.id === id);
    if (!gone.length) return;
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.undo = { label: 'Dismissed.', items: gone };
    this.emit('ui-dismiss', { ids: [id] });
  }

  /** Clear the quiet ones: leaves only what needs you. */
  clear() {
    const quiet = this.notifications.filter((n) => n.level !== 'needs');
    if (!quiet.length) return;
    this.notifications = this.notifications.filter((n) => n.level === 'needs');
    this.undo = { label: `Cleared ${quiet.length}.`, items: quiet };
    this.emit('ui-dismiss', { ids: quiet.map((n) => n.id) });
  }

  restore() {
    if (!this.undo) return;
    const ids = new Set(this.undo.items.map((n) => n.id));
    this.notifications = [...this.undo.items, ...this.notifications.filter((n) => !ids.has(n.id))].sort((a, b) => toTime(b.time) - toTime(a.time));
    this.undo = null;
    this.emit('ui-restore', { ids: [...ids] });
  }

  /** Mutes an app's notifications, or unmutes them. */
  setMuted(app: string, muted: boolean) {
    const has = this.muted.includes(app);
    if (has === muted) return;
    this.muted = muted ? [...this.muted, app] : this.muted.filter((a) => a !== app);
    this.emit('ui-mute', { app, muted });
  }

  setCurrent(id: string) {
    this.current = id;
    this.recent = [id, ...this.recent.filter((r) => r !== id)].slice(0, 6);
  }

  setStream({ loading = false, error = '' }: { loading?: boolean; error?: string }) {
    this.streamLoading = loading;
    this.streamError = error;
  }

  setAgents(list: ShellAgent[], { loading = false, error = '' }: { loading?: boolean; error?: string } = {}) {
    this.agents = list;
    this.agentsLoading = loading;
    this.agentsError = error;
  }

  viewing() {
    return this.view;
  }

  /** The floor the person is on, when floors are set. */
  get currentFloor(): ShellFloor | undefined {
    return this.floors.find((f) => f.id === this.floor);
  }

  /**
   * Why the gauge rests, when it does: the open app shows the same on every
   * floor, so moving would change nothing. It stays in view and says so.
   */
  get floorsRest(): string {
    const app = this.openNow;
    return app?.sameOnEveryFloor ? `${app.name} is the same on every floor` : '';
  }

  /** Asks the host to go one floor up or down the gauge. False when there is no floor that way, or the gauge rests. */
  moveFloor(direction: 'up' | 'down'): boolean {
    if (this.floorsRest) return false;
    const to = floorBeside(this.floors, this.floor, direction, this.lastTeam);
    if (!to) return false;
    this.goToFloor(to.id);
    return true;
  }

  private goToFloor(id: string) {
    const to = this.floors.find((f) => f.id === id);
    if (!to || id === this.floor) return;
    this.emit('ui-floor', { id, direction: floorDirection(this.currentFloor, to) });
  }

  /** The water under the stage, for menus to swell as you move; null when it is turned off. */
  get waves(): UiWaveBackground | null {
    return this.renderRoot?.querySelector('ui-wave-background') ?? null;
  }

  /** The element apps mount into. */
  get stage(): HTMLElement {
    return this;
  }

  /** The open app's name under the handle: where a chosen icon lands when the app opens. */
  get placeTitle(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.place b') ?? null;
  }

  private get stageBox(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.stage') ?? null;
  }

  /**
   * The app arrives: it rises a short way into place as it fades in, and the
   * kit's surfaces in it settle in one after another. Under reduced motion it
   * only fades. Jumped to its end by any key or press (`finishMotion`).
   * Opening an app, rather than another page of the one open, plays its title
   * card: the app's name, under the floor it opened on. While a card shows,
   * the app waits behind it unseen, and comes in once the card has faded.
   */
  arrive(): Promise<void> {
    const box = this.stageBox;
    if (!box) return Promise.resolve();
    const app = this.openNow;
    if (app && this.arrivedIn !== app.id) {
      this.arrivedIn = app.id;
      if (!this.inbound) this.showCard({ kind: 'app', kick: this.currentFloor?.name ?? this.product, name: app.name });
    }
    box.getAnimations().forEach((a) => a.cancel());
    return this.afterCard(box, () => {
      settleSurfaces(tokenValue('motion-calm', 600));
      if (this.inbound) return this.enterFloor(box);
      const rise = motionMode() === 'reduce' ? 'none' : `translateY(${tokenValue('travel-near', 24)}px)`;
      return animate(box, [{ transform: rise, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: tokenValue('motion-slow', 320), easing: tokenEasing('ease-out') });
    });
  }

  /**
   * A title card plays alone: what's behind it stays unseen until the card has
   * faded, then comes in. Without a card it comes in at once.
   */
  private afterCard(box: HTMLElement, comeIn: () => Promise<void>): Promise<void> {
    if (!this.card) {
      this.behindCard(box, false);
      return comeIn();
    }
    this.behindCard(box, true);
    return this.cardGone().then(() => {
      this.behindCard(box, false);
      return comeIn();
    });
  }

  /** Whether the stage waits unseen behind a title card. Nothing unseen can be pressed, so it is inert until it comes in. */
  private hiddenByCard = false;
  private behindCard(box: HTMLElement, hidden: boolean) {
    this.hiddenByCard = hidden;
    if (hidden) box.style.opacity = '0';
    else box.style.removeProperty('opacity');
    box.inert = this.isOpen || hidden;
  }

  /** Resolves once no card is showing: a card that replaces another waits for that one too. */
  private async cardGone() {
    while (this.card) await this.cardEnd;
  }

  /**
   * The leaving half of a move between floors: what you're looking at goes
   * the way you're going. Going up, it sinks away; going down, it rises away;
   * across, it slides aside. The host waits for this before it takes the app
   * down, so nothing goes blank partway through. Under reduced motion it fades.
   */
  leaveFloor(direction: FloorDirection): Promise<void> {
    const box = this.stageBox;
    if (!box) return Promise.resolve();
    box.getAnimations().forEach((a) => a.cancel());
    return animate(box, [{ transform: 'none', opacity: 1 }, { transform: travel(direction, 1), opacity: 0 }], {
      duration: tokenValue('motion-slow', 320),
      easing: tokenEasing('ease-in'),
      fill: 'forwards',
    });
  }

  /** The arriving half: the new floor comes in from the other side. */
  private enterFloor(box: HTMLElement): Promise<void> {
    const direction = this.inbound!;
    this.inbound = undefined;
    return animate(box, [{ transform: travel(direction, -1), opacity: 0 }, { transform: 'none', opacity: 1 }], {
      duration: tokenValue('motion-calm', 600),
      easing: tokenEasing('ease-out'),
    });
  }

  /** The app leaves on Back: it sinks a short way as it fades, in about four fifths of the time it took to arrive. */
  sink(): Promise<void> {
    const box = this.stageBox;
    if (!box) return Promise.resolve();
    const fall = motionMode() === 'reduce' ? 'none' : `translateY(${tokenValue('travel-near', 24)}px)`;
    return animate(box, [{ transform: 'none', opacity: 1 }, { transform: fall, opacity: 0 }], {
      duration: tokenValue('motion-slow', 320) * 0.8,
      easing: tokenEasing('ease-in'),
      fill: 'forwards',
    });
  }

  /** Put the stage back as it rests, after a move that left it hidden. */
  settleStage() {
    const box = this.stageBox;
    box?.getAnimations().forEach((a) => a.cancel());
    if (box && this.inbound) void this.afterCard(box, () => this.enterFloor(box));
  }

  /**
   * Show an area title card for a moment. Cards are generated from the floor
   * or app arrived at (docs/shell-principles.md, "Arrivals are generated"),
   * never written by hand; the Area titles setting turns them off.
   */
  private showCard(card: AreaCard) {
    clearTimeout(this.cardTimer);
    if (this.settings.areaTitles === false) return this.endCard();
    // the card it replaces has ended, and what waited on that one now waits on this
    this.cardEnded?.();
    this.cardEnd = new Promise((resolve) => (this.cardEnded = resolve));
    // Nothing repeats its parent: a kicker that only says the name again goes.
    this.card = card.kick.toLowerCase() === card.name.toLowerCase() ? { ...card, kick: '' } : card;
    this.cardTimer = setTimeout(this.endCard, tokenValue('motion-title', 2400));
  }

  /** Any key, press or scroll ends the card at once: it never keeps anyone waiting. */
  private endCard = () => {
    if (!this.card) return;
    clearTimeout(this.cardTimer);
    this.card = null;
    this.cardEnded?.();
    this.cardEnded = undefined;
  };

  /* ---- lifecycle and keys ---- */

  private onWindowKey = (e: KeyboardEvent) => {
    const summon = (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k');
    if (summon) {
      e.preventDefault();
      this.toggle();
      return;
    }
    // Page Up and Page Down scroll the app first; at its top or bottom they go up or down a floor. With Alt they always do.
    if ((e.key === 'PageUp' || e.key === 'PageDown') && this.floors.length && !this.isOpen && !e.defaultPrevented && !isTyping(e)) {
      const up = e.key === 'PageUp';
      const stage = this.renderRoot.querySelector<HTMLElement>('.stage');
      const atEnd = !stage || (up ? stage.scrollTop <= 0 : stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 1);
      if ((e.altKey || atEnd) && this.moveFloor(up ? 'up' : 'down')) e.preventDefault();
    }
  };

  /** An app's drawer took (or gave back) the right edge: the floor gauge moves to stay just left of it. */
  private onDrawer = (e: Event) => {
    const inset = (e as CustomEvent<{ inset?: number }>).detail?.inset ?? 0;
    this.style.setProperty('--app-drawer-inset', `${Math.max(0, inset)}px`);
  };

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('ui-drawer', this.onDrawer);
    window.addEventListener('keydown', this.onWindowKey);
    for (const type of ['keydown', 'pointerdown', 'wheel'] as const) window.addEventListener(type, this.endCard, { capture: true, passive: true });
    this.clock = setInterval(() => (this.now = Date.now()), 30_000);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('ui-drawer', this.onDrawer);
    window.removeEventListener('keydown', this.onWindowKey);
    for (const type of ['keydown', 'pointerdown', 'wheel'] as const) window.removeEventListener(type, this.endCard, { capture: true });
    clearInterval(this.clock);
    clearTimeout(this.arriveTimer);
    clearTimeout(this.cardTimer);
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('current') && this.current !== this.arrivedIn) this.arrivedIn = '';
    if (!changed.has('floor')) return;
    const here = this.currentFloor;
    // Remember the deepest team on your way, so going up and back down retraces it.
    const last = this.floors.find((f) => f.id === this.lastTeam);
    if (here?.kind === 'team' && !last?.path.some((p) => p.id === here.id)) this.lastTeam = here.id;
    const before = changed.get('floor') as string | undefined;
    const from = this.floors.find((f) => f.id === before);
    if (!here || !before || !from) return;
    // A move between floors: the water travels, the next screen comes in from the other side, and the floor's card plays.
    const direction = floorDirection(from, here);
    this.said = direction === 'up' ? `Up to ${here.name}` : direction === 'down' ? (here.kind === 'personal' ? 'Down to you' : `Down to ${here.name}`) : here.name;
    this.inbound = direction;
    this.showCard({ kind: 'floor', kick: floorKindOf(here), name: here.name, line: floorMeaning(here) });
    void this.updateComplete.then(() => this.waves?.move(direction));
  }

  override async updated(changed: Map<string, unknown>) {
    if (changed.has('notifications') || changed.has('muted')) this.emit('ui-notifications', { notifications: this.notifications, muted: this.muted });
    const stage = this.renderRoot.querySelector<HTMLElement>('.stage');
    if (stage) stage.inert = this.isOpen || this.hiddenByCard;
    if (changed.has('isOpen') && this.isOpen && !this.view) {
      await this.updateComplete;
      this.focusDome(this.focusIndex);
    } else if (changed.has('view') && this.view) {
      await this.updateComplete;
      const view = this.renderRoot.querySelector('.view');
      (view?.querySelector<HTMLElement>('[data-first]') ?? view?.querySelector<HTMLElement>('button, input, [tabindex="0"]'))?.focus();
    }
  }

  /** Dome order, left to right: the stream sits at the top of the arc. */
  private get order(): string[] {
    const ids = this.functions.map((f) => f.id);
    const left = Math.floor(ids.length / 2);
    return [...ids.slice(0, left), 'stream', ...ids.slice(left)];
  }

  private get streamSlot() {
    return this.order.indexOf('stream');
  }

  /** Where item i sits on the arc: both sides reach the same width, so an odd number of functions stays balanced. */
  private arcSlot(i: number) {
    const left = this.streamSlot;
    const right = this.order.length - 1 - left;
    const reach = Math.max(left, right);
    if (i < left) return -(left - i) * (reach / left);
    if (i > left) return (i - left) * (reach / right);
    return 0;
  }

  private focusDome(i: number) {
    const buttons = [...this.renderRoot.querySelectorAll<HTMLElement>('.dome > button')];
    if (!buttons.length) return;
    this.focusIndex = (i + buttons.length) % buttons.length;
    buttons[this.focusIndex].focus();
  }

  private onSkyKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.view === 'find' && this.query) this.query = '';
      else if (this.view) this.closeView();
      else this.close();
      return;
    }
    if (e.key === 'Tab') return this.trapTab(e);
    if (this.view) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.focusDome(this.focusIndex + (e.key === 'ArrowRight' ? 1 : -1));
    }
  }

  private trapTab(e: KeyboardEvent) {
    const sky = this.renderRoot.querySelector('.sky');
    if (!sky) return;
    const items = [...sky.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')].filter((el) => !el.closest('[inert]'));
    if (!items.length) return;
    const active = (this.renderRoot as ShadowRoot).activeElement;
    const at = items.indexOf(active as HTMLElement);
    const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === items.length - 1 ? 0 : at + 1;
    if (at === -1 || (e.shiftKey && at === 0) || (!e.shiftKey && at === items.length - 1)) {
      e.preventDefault();
      items[next].focus();
    }
  }

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private openApp(id: string) {
    this.setCurrent(id);
    this.emit('ui-open-app', { id });
    this.close();
  }

  private openNotification(n: ShellNotification) {
    this.emit('ui-open-notification', { notification: n });
    this.close();
  }

  private actOn(n: ShellNotification, index: number) {
    this.emit('ui-notification-action', { notification: n, index });
    this.close();
  }

  /** What the band and the dome count: everything but what the person muted. */
  private get heard() {
    return this.muted.length ? this.notifications.filter((n) => !this.muted.includes(n.app)) : this.notifications;
  }

  /* ---- what the sky says ---- */

  private get mood(): 'quiet' | 'some' | 'needs' | 'offline' {
    if (!this.online) return 'offline';
    const heard = this.heard;
    if (heard.some((n) => n.level === 'needs')) return 'needs';
    return heard.length ? 'some' : 'quiet';
  }

  private caption(): { title: string; line: string } {
    const id = this.view || this.order[this.focusIndex] || 'stream';
    if (id === 'stream') {
      const heard = this.heard;
      const latest = heard.find((n) => n.level === 'needs') ?? heard[0];
      const title = this.online ? streamWords(heard) : 'Offline';
      const line = !this.online ? 'These are from before you went offline.' : latest ? latest.title : 'Nothing needs you.';
      return { title, line };
    }
    return { title: this.functions.find((f) => f.id === id)?.label ?? id, line: '' };
  }

  static override styles = [
    base,
    label,
    css`
      :host {
        position: relative;
        display: block;
        min-height: 100%;
        height: 100%;
        overflow: hidden;
        color: var(--ink);
        --dome: calc(var(--band-top) + 18%);
        --s-ease: var(--ease-out);
      }
      button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 3px; border-radius: var(--radius-key); }
      .ground { position: absolute; inset: 0; z-index: 0; background: radial-gradient(120% 90% at 50% 40%, var(--slate), var(--slate-deep)); transition: transform var(--motion-calm) var(--s-ease), filter var(--motion-calm) var(--s-ease); }
      /* the still ground apps sit on: the flat slate of an app's own page, so where an app ends and the shell begins never shows */
      :host([background='none']) .ground, :host([background='']) .ground { background: var(--slate); }
      /* The stage starts below the band, as apps expect, and its top edge fades in so there's no hard line where it begins. */
      .stage { position: absolute; inset: var(--band-top) 0 0; z-index: 1; isolation: isolate; overflow: auto; -webkit-mask-image: linear-gradient(to bottom, transparent, #000 var(--space-4)); mask-image: linear-gradient(to bottom, transparent, #000 var(--space-4)); transform-origin: 50% 100%; transition: transform var(--motion-calm) var(--s-ease), filter var(--motion-calm) var(--s-ease); }
      /* looking up: the water and the app tip away below you and go dark */
      :host([open]) .ground { transform: translateY(14%) scale(1.04); filter: brightness(0.5) saturate(0.7); }
      :host([open]) .stage { transform: perspective(1400px) translateY(12%) rotateX(9deg) scale(0.96); filter: brightness(0.38) saturate(0.6) blur(2px); }
      .live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

      /* the band */
      /* The band is chrome, never a surface: on every screen it rests on a fade from the scrim, so it reads over bright water or an app. */
      .band { position: absolute; z-index: 4; top: 0; left: 0; right: 0; height: var(--band-top); padding: 0 var(--edge); display: flex; align-items: center; justify-content: space-between; transition: opacity var(--motion-slow) var(--ease-standard); }
      .band::before { content: ''; position: absolute; z-index: -1; inset: 0 0 calc(var(--space-5) * -1); pointer-events: none; background: linear-gradient(to bottom, var(--scrim), transparent); }
      :host([open]) .band { opacity: 0; pointer-events: none; }
      .mark { display: flex; align-items: baseline; gap: var(--space-3); }
      .mark b { font-weight: 600; font-size: var(--type-small); line-height: var(--leading-small); letter-spacing: var(--tracking-mark); text-transform: uppercase; }
      .mark span, .clock { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .clock { font-size: var(--type-meta); line-height: var(--leading-meta); font-variant-numeric: tabular-nums; }
      .right { display: flex; align-items: center; gap: var(--space-5); }
      .status { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0; font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }
      .status:hover { color: var(--ink); }
      .point { position: relative; width: 6px; height: 6px; border-radius: 50%; border: 1px solid var(--ink-muted); }
      .status.some .point { background: var(--ink); border-color: var(--ink); }
      .status.needs { color: var(--green); }
      .status.needs .point { background: var(--green); border-color: var(--green); }
      .status.needs .point::after, .orb.needs::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; border: 1px solid var(--green); animation: ui-ping var(--motion-ping) var(--ease-ping) infinite; }
      .status.offline { color: var(--warning); }
      .status.offline .point { border-color: var(--warning); }
      :host([arriving]) .point { animation: arrive var(--motion-calm) var(--s-ease); }
      @keyframes arrive { 30% { transform: scale(2.2); } }
      .handle { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 96px; height: 28px; display: flex; justify-content: center; padding-top: var(--space-2); }
      .handle i { display: block; width: 40px; height: 4px; border-radius: 2px; background: var(--hairline-strong); transition: width var(--motion-slow) var(--s-ease); }
      .handle:hover i, .handle:focus-visible i { width: 56px; background: color-mix(in srgb, var(--ink) 50%, transparent); }
      /* On a floor the handle takes the floor's colour on every screen, so the level is always in view. */
      :host([floor-kind]) .handle i { background: color-mix(in srgb, var(--floor-mark) 70%, transparent); box-shadow: 0 0 var(--space-3) color-mix(in srgb, var(--floor-mark) 40%, transparent); }
      :host([floor-kind]) .handle:hover i, :host([floor-kind]) .handle:focus-visible i { background: var(--floor-mark); }
      /* Under the handle: the open app's name, and the part of it you're in. Nothing on Title. */
      .place { position: absolute; left: 50%; top: calc(var(--space-2) + var(--space-4)); transform: translateX(-50%); max-width: min(var(--measure-card), 40vw); margin: 0; text-align: center; pointer-events: none; }
      .place b { display: block; font-weight: 400; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .place span { display: block; font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      /* the sky */
      .sky { position: absolute; inset: 0; z-index: 3; visibility: hidden; pointer-events: none; transition: visibility 0s var(--motion-calm); }
      :host([open]) .sky { visibility: visible; pointer-events: auto; transition: visibility 0s; }
      .fade { position: absolute; inset: 0; opacity: 0; transform: translateY(-24%); transition: opacity var(--motion-calm) var(--s-ease), transform var(--motion-calm) var(--s-ease);
        background: linear-gradient(to bottom,
          color-mix(in srgb, color-mix(in srgb, var(--slate-deep), var(--shade) 70%) 97%, transparent) 0%,
          color-mix(in srgb, color-mix(in srgb, var(--slate-deep), var(--shade) 55%) 90%, transparent) 28%,
          color-mix(in srgb, color-mix(in srgb, var(--slate-deep), var(--shade) 45%) 55%, transparent) 55%,
          transparent 82%); }
      :host([open]) .fade { opacity: 1; transform: none; }
      :host([view]:not([view=''])) .fade { background: linear-gradient(to bottom, color-mix(in srgb, var(--slate-deep), var(--shade) 70%) 0%, color-mix(in srgb, color-mix(in srgb, var(--slate-deep), var(--shade) 50%) 94%, transparent) 60%, color-mix(in srgb, var(--slate-deep) 70%, transparent) 100%); }
      .stars { position: absolute; left: 0; right: 0; top: 0; height: 55%; opacity: 0; pointer-events: none; transition: opacity var(--motion-shimmer) var(--ease-standard) var(--motion-slow);
        -webkit-mask-image: linear-gradient(to bottom, #000 40%, transparent); mask-image: linear-gradient(to bottom, #000 40%, transparent);
        background-image:
          radial-gradient(1px 1px at 12% 22%, color-mix(in srgb, var(--ink) 70%, transparent), transparent 60%), radial-gradient(1px 1px at 27% 61%, color-mix(in srgb, var(--ink) 45%, transparent), transparent 60%),
          radial-gradient(1px 1px at 38% 14%, color-mix(in srgb, var(--ink) 55%, transparent), transparent 60%), radial-gradient(1.5px 1.5px at 63% 30%, color-mix(in srgb, var(--ink) 50%, transparent), transparent 60%),
          radial-gradient(1px 1px at 71% 9%, color-mix(in srgb, var(--ink) 60%, transparent), transparent 60%), radial-gradient(1px 1px at 84% 47%, color-mix(in srgb, var(--ink) 40%, transparent), transparent 60%),
          radial-gradient(1px 1px at 92% 18%, color-mix(in srgb, var(--ink) 55%, transparent), transparent 60%), radial-gradient(1px 1px at 6% 52%, color-mix(in srgb, var(--ink) 35%, transparent), transparent 60%); }
      :host([open]) .stars { opacity: 0.8; }

      /* the dome: functions on a shallow arc, the stream at its top */
      .dome > button { position: absolute; left: calc(50% + var(--x)); top: calc(var(--dome) + var(--y)); transform: translate(-50%, calc(-50% - 12px)); opacity: 0; transition: opacity var(--motion-calm) var(--ease-standard), transform var(--motion-calm) var(--s-ease); }
      :host([open]) .dome > button { opacity: 1; transform: translate(-50%, -50%); transition-delay: calc(var(--motion-base) + var(--i) * var(--motion-instant)); }
      :host([open][view]:not([view=''])) .dome > button:not(.lit) { opacity: 0.3; }
      .fn { width: 48px; height: 48px; border-radius: 50% !important; display: flex; align-items: center; justify-content: center; color: var(--ink-muted); }
      .fn::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--ink) 12%, transparent), transparent 70%); opacity: 0; transition: opacity var(--motion-slow); }
      .fn:hover, .fn:focus-visible, .fn.lit { color: var(--ink); }
      .fn:hover::before, .fn:focus-visible::before, .fn.lit::before { opacity: 1; }
      .fn:focus-visible, .stream:focus-visible { outline-offset: 2px; border-radius: 50%; }
      .stream { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      .thread { position: absolute; left: 50%; bottom: calc(100% - 4px); width: 1px; height: 60vh; transform: translateX(-50%); pointer-events: none; background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--ink) 18%, transparent) 60%, color-mix(in srgb, var(--ink) 40%, transparent)); }
      .thread::after { content: ''; position: absolute; inset: 0; opacity: 0;
        background: repeating-linear-gradient(to bottom, transparent 0 46px, color-mix(in srgb, var(--ink) 90%, transparent) 46px 52px, transparent 52px 120px); background-size: 1px 120px;
        -webkit-mask-image: linear-gradient(to bottom, transparent, #000 50%); mask-image: linear-gradient(to bottom, transparent, #000 50%); animation: fall var(--motion-ping) linear infinite; }
      .sky.some .thread::after { opacity: 0.5; }
      .sky.needs .thread::after { opacity: 0.9; animation-duration: var(--motion-shimmer); background-image: repeating-linear-gradient(to bottom, transparent 0 46px, color-mix(in srgb, var(--green) 95%, transparent) 46px 52px, transparent 52px 120px); }
      @keyframes fall { to { background-position: 0 120px; } }
      .orb { position: relative; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--hairline-strong); display: flex; align-items: center; justify-content: center; }
      .orb i { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--ink-muted); transition: all var(--motion-slow); }
      .orb.some i { background: var(--ink); border-color: var(--ink); }
      .orb.needs { border-color: color-mix(in srgb, var(--green) 50%, transparent); }
      .orb.needs::after { inset: -1px; border-color: color-mix(in srgb, var(--green) 50%, transparent); }
      .orb.needs i { width: 10px; height: 10px; background: var(--green); border-color: var(--green); box-shadow: 0 0 16px color-mix(in srgb, var(--green) 70%, transparent); }
      .orb.offline { border-color: color-mix(in srgb, var(--warning) 50%, transparent); }
      .orb.offline i { border-color: var(--warning); }

      /* the one line that names what is focused */
      .caption { position: absolute; left: 50%; top: calc(var(--dome) + var(--space-7)); transform: translateX(-50%); margin: 0; width: min(var(--measure-glance), calc(100% - 2 * var(--edge))); text-align: center; opacity: 0; transition: opacity var(--motion-calm) var(--ease-standard) var(--motion-slow); }
      :host([open]) .caption { opacity: 1; }
      .caption b { display: block; font-weight: 300; font-size: var(--type-lead); line-height: var(--leading-lead); }
      .caption.needs b { color: var(--green); }
      .caption.offline b { color: var(--warning); }
      .caption span { display: block; margin-top: var(--space-1); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .esc { position: absolute; left: 50%; bottom: var(--anchor-back); transform: translateX(-50%); font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); opacity: 0; transition: opacity var(--motion-slow) var(--ease-standard) var(--motion-calm); }
      :host([open]) .esc { opacity: 1; }
      kbd { font: inherit; font-size: var(--type-label); line-height: var(--leading-label); border: 1px solid color-mix(in srgb, var(--ink-muted) 40%, transparent); border-radius: var(--radius-key); padding: 0 var(--space-1); margin-right: var(--space-2); }

      /* a view, opened under the dome at the read measure */
      .view { position: absolute; left: 50%; transform: translateX(-50%); top: calc(var(--dome) + var(--space-8) + var(--space-4)); bottom: calc(var(--anchor-back) + var(--space-6)); width: min(var(--measure-read), calc(100% - 2 * var(--edge))); padding: 3px; overflow: auto; animation: view-in var(--motion-slow) var(--s-ease); }
      @keyframes view-in { from { opacity: 0; transform: translate(-50%, 8px); } }
      .group { display: flex; align-items: baseline; gap: var(--space-2); padding: var(--space-5) var(--space-4) var(--space-2); }
      .group b { font-weight: 500; font-variant-numeric: tabular-nums; }
      .group .name { flex: 1; display: flex; align-items: baseline; gap: var(--space-2); }
      .group .quiet { color: var(--ink-muted); }
      .group .more { flex: none; align-self: center; display: flex; width: 28px; height: 28px; align-items: center; justify-content: center; color: var(--ink-muted); border-radius: 50% !important; opacity: 0.6; }
      .group .more:hover, .group .more:focus-visible { opacity: 1; color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
      .item.muted .row { opacity: 0.7; }
      .act { flex: none; padding: var(--space-1) var(--space-3); margin-left: var(--space-2); border-radius: var(--radius-pill); border: 1px solid var(--hairline-strong); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink); white-space: nowrap; }
      .act:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
      .act.main { border-color: var(--green); }
      .group.needs, .group.needs b { color: var(--green); }
      ul { list-style: none; margin: 0; padding: 0; }
      .item { display: flex; align-items: center; border-bottom: 1px solid var(--hairline); }
      .item .row { border-bottom: 0; }
      .row { position: relative; display: flex; align-items: center; gap: var(--space-4); width: 100%; min-height: 60px; padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--hairline); text-align: left; transition: background var(--motion-quick) var(--ease-standard); }
      .row:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
      .row:focus-visible { outline: 0; box-shadow: inset 0 0 0 1.5px var(--focus); border-radius: var(--radius-key); }
      .lead { flex: none; position: relative; width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--ink-muted); }
      .row.needs .lead { background: var(--green); border-color: var(--green); }
      .row.needs.first .lead::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; border: 1px solid var(--green); animation: ui-ping var(--motion-ping) var(--ease-ping) infinite; }
      .row.failed .lead { border-color: var(--danger); }
      .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .text b { font-weight: 400; font-size: var(--type-body); line-height: var(--leading-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .text span, .meta { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .meta { flex: none; font-variant-numeric: tabular-nums; }
      .x { flex: none; display: flex; width: 28px; height: 28px; align-items: center; justify-content: center; color: var(--ink-muted); border-radius: 50% !important; }
      .x:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
      .note { margin: 0; padding: var(--space-6) var(--space-4); text-align: center; color: var(--ink-muted); }
      .note.error { color: var(--danger); }
      .note.small { padding: var(--space-2) var(--space-4) var(--space-4); text-align: left; font-size: var(--type-small); line-height: var(--leading-small); }
      .note.small.failed { color: var(--danger); }
      .tools { display: flex; justify-content: flex-end; align-items: center; gap: var(--space-4); padding: var(--space-4) var(--space-4) 0; font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }
      .link { color: var(--ink-muted); text-decoration: underline; text-underline-offset: 4px; text-decoration-color: var(--hairline-strong); }
      .link:hover { color: var(--ink); }
      .retry { display: block; margin: var(--space-3) auto 0; color: var(--ink); text-decoration: underline; text-decoration-color: var(--green); text-underline-offset: 6px; }
      .apps { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-3); padding: var(--space-4) 0; }
      .app { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-4) var(--space-3); border-radius: var(--radius-inset) !important; text-align: center; }
      .app:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
      .app b { font-weight: 400; }
      .app span { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .app em { font-style: normal; font-size: var(--type-label); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--ink); text-decoration: underline; text-underline-offset: 4px; }
      .search { display: flex; align-items: center; gap: var(--space-3); border-bottom: 1px solid var(--hairline-strong); margin: 0 var(--space-4); }
      .search:focus-within { border-bottom-color: var(--focus); box-shadow: 0 1px 0 var(--focus); }
      .search ui-icon { color: var(--ink-muted); }
      .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--ink); font: inherit; font-size: var(--type-lead); line-height: var(--leading-lead); padding: var(--space-3) 0; }
      .search input::placeholder { color: color-mix(in srgb, var(--ink-muted) 75%, transparent); }
      .pair { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); padding: var(--space-4); border-bottom: 1px solid var(--hairline); }
      .pair > span { color: var(--ink-muted); }
      .pair.version b { font-weight: inherit; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
      .who { padding: var(--space-4); }
      .who b { display: block; font-weight: 300; font-size: var(--type-heading); line-height: var(--leading-heading); }
      .who span { color: var(--ink-muted); }
      .switch { position: relative; width: 40px; height: 22px; border-radius: var(--radius-pill) !important; border: 1px solid var(--hairline-strong); transition: background var(--motion-quick); }
      .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--ink-muted); transition: transform var(--motion-quick) var(--ease-standard); }
      .switch[aria-checked='true'] { background: color-mix(in srgb, var(--ink) 20%, transparent); }
      .switch[aria-checked='true']::after { transform: translateX(18px); background: var(--ink); }
      .seg { display: flex; gap: var(--space-1); }
      .seg button { padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); color: var(--ink-muted); font-size: var(--type-meta); }
      .seg button[aria-pressed='true'] { color: var(--ink); background: color-mix(in srgb, var(--ink) 12%, transparent); }
      .keys { display: grid; grid-template-columns: auto 1fr; gap: var(--space-3) var(--space-5); padding: var(--space-4); font-size: var(--type-meta); color: var(--ink-muted); }
      .keys kbd { justify-self: start; color: var(--ink); }
      .toast { position: absolute; left: 50%; bottom: calc(var(--anchor-back) + var(--space-6)); transform: translateX(-50%); display: flex; gap: var(--space-4); align-items: center; padding: var(--space-2) var(--space-4); border-radius: var(--radius-pill); background: var(--surface-overlay); border: 1px solid var(--hairline); font-size: var(--type-meta); color: var(--ink-muted); z-index: 2; }
      .skel { display: block; height: 10px; width: 46%; margin: var(--space-5) var(--space-4); border-radius: var(--radius-pill); background: linear-gradient(90deg, color-mix(in srgb, var(--ink) 6%, transparent), color-mix(in srgb, var(--ink) 14%, transparent), color-mix(in srgb, var(--ink) 6%, transparent)); background-size: 200% 100%; animation: skel var(--motion-shimmer) var(--ease-standard) infinite; }
      @keyframes skel { from { background-position: 100% 0; } to { background-position: -100% 0; } }

      /* floors: where you are, top left; the gauge at the edge; the floor's name as you arrive */
      .where { display: flex; align-items: center; gap: var(--space-2); min-width: 0; margin: 0; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .where ui-icon { color: var(--floor-mark, var(--ink)); flex: none; }
      .where b { color: var(--ink); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      :host { --floor-mark: var(--floor-you-high); }
      :host([floor-kind='team']) { --floor-mark: var(--floor-team-high); }
      :host([floor-tone='department']) { --floor-mark: var(--floor-department-high); }
      :host([floor-kind='org']) { --floor-mark: var(--floor-org-high); }
      .gauge { position: absolute; z-index: 3; right: calc(var(--space-2) + var(--app-drawer-inset, 0px)); top: 50%; transform: translateY(-50%); padding: var(--space-2); border-radius: var(--radius-inset); border: 1px solid transparent; transition: right var(--motion-slow) var(--ease-out), opacity var(--motion-slow) var(--ease-standard), background var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard); }
      .gauge ol { position: relative; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2); }
      .gauge ol::before { content: ''; position: absolute; top: var(--space-4); bottom: var(--space-4); right: 13.5px; width: 1px; background: var(--hairline); }
      :host([open]) .gauge { opacity: 0; pointer-events: none; }
      .gauge button { position: relative; display: flex; align-items: center; justify-content: flex-end; color: var(--ink-muted); text-align: right; }
      .gauge .notch { position: relative; flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--slate-deep); border: 1px solid var(--hairline); transition: color var(--motion-quick), border-color var(--motion-quick); }
      .gauge button:hover .notch, .gauge button:focus-visible .notch { color: var(--ink); border-color: var(--hairline-strong); }
      .gauge button:focus-visible { outline: 0; }
      .gauge button:focus-visible .notch { box-shadow: 0 0 0 2px var(--focus); }
      .gauge .dot { position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; border-radius: 50%; background: var(--floor-mark, var(--green)); border: 2px solid var(--slate-deep); }
      .gauge button[aria-current] .notch { color: var(--floor-mark); border-color: var(--floor-mark); box-shadow: 0 0 12px color-mix(in srgb, var(--floor-mark) 45%, transparent); }
      .gauge .pinned { flex: none; display: grid; place-items: center; width: 22px; height: 22px; margin-right: var(--space-1); overflow: hidden; border-radius: var(--radius-key); color: var(--ink); background: color-mix(in srgb, var(--floor-mark) 22%, var(--slate-deep)); border: 1px solid var(--floor-mark); transition: width var(--motion-base) var(--ease-standard), margin var(--motion-base) var(--ease-standard), opacity var(--motion-quick) var(--ease-standard), border-width var(--motion-base) var(--ease-standard); }
      /* Opening out is one smooth move: each label's box grows from nothing to its size, in both directions, as it fades in, so nothing jumps */
      .gauge .label { display: grid; grid-template: minmax(0, 0fr) / minmax(0, 0fr); overflow: hidden; opacity: 0; font-size: var(--type-small); line-height: var(--leading-small); letter-spacing: normal; text-transform: none;
        transition: grid-template-rows var(--motion-base) var(--ease-standard), grid-template-columns var(--motion-base) var(--ease-standard), opacity var(--motion-quick) var(--ease-standard); }
      .gauge .label > span { box-sizing: border-box; width: calc(240px + var(--space-3)); min-height: 0; padding-right: var(--space-3); display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
      .gauge .label b { display: flex; align-items: baseline; gap: var(--space-2); font-weight: 500; color: var(--ink); }
      .gauge .label em { font-style: normal; font-size: var(--type-label); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--floor-mark); }
      .gauge .label em.waiting { color: var(--ink-muted); }
      .gauge .label .bound { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-1); color: var(--ink); }
      .gauge .label .bound ui-icon { color: var(--floor-mark); }
      .gauge:hover, .gauge:has(:focus-visible) { background: color-mix(in srgb, var(--slate-deep) 94%, transparent); backdrop-filter: blur(12px); border-color: var(--hairline); box-shadow: 0 12px 40px rgb(0 0 0 / 0.35); }
      .gauge ol { transition: gap var(--motion-base) var(--ease-standard); }
      .gauge:hover ol, .gauge:has(:focus-visible) ol { gap: var(--space-4); }
      .gauge:hover .label, .gauge:has(:focus-visible) .label { grid-template: minmax(0, 1fr) / minmax(0, 1fr); opacity: 1; transition-delay: 0s, 0s, var(--motion-instant); }
      .gauge:hover .pinned, .gauge:has(:focus-visible) .pinned { width: 0; margin-right: 0; opacity: 0; border-width: 0; }
      /* resting: the open app is the same on every floor, so the gauge stays in view, dimmed, and says why when you point at it */
      .gauge .why { display: grid; grid-template: minmax(0, 0fr) / minmax(0, 0fr); justify-content: end; overflow: hidden; opacity: 0; margin: 0; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink); text-align: right;
        transition: grid-template-rows var(--motion-base) var(--ease-standard), grid-template-columns var(--motion-base) var(--ease-standard), opacity var(--motion-quick) var(--ease-standard), margin var(--motion-base) var(--ease-standard); }
      .gauge .why > span { box-sizing: border-box; width: calc(240px + var(--space-3) + 28px); min-height: 0; }
      .gauge.rest:hover .why, .gauge.rest:has(:focus-visible) .why { grid-template: minmax(0, 1fr) / minmax(0, 1fr); opacity: 1; margin-bottom: var(--space-4); transition-delay: 0s, 0s, var(--motion-instant), 0s; }
      .gauge.rest button[aria-disabled='true'] { cursor: not-allowed; }
      .gauge.rest button[aria-disabled='true'] .notch, .gauge.rest button[aria-disabled='true'] .label { opacity: 0.5; }
      .gauge.rest button[aria-disabled='true']:hover .notch { color: var(--ink-muted); border-color: var(--hairline); }
      .gauge button:not([aria-current]) .label b { color: var(--ink-muted); font-weight: 400; }
      .gauge button:hover .label b { color: var(--ink); }
      /* The area title card: fades in, holds, and fades out where it is. It ignores the pointer and covers nothing you need. */
      .card { position: absolute; z-index: 5; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-4); text-align: center; pointer-events: none; animation: card-life var(--motion-title) var(--ease-standard) both; }
      .card::before { content: ''; position: absolute; inset: 0; z-index: -1; background: radial-gradient(60% 40% at 50% 50%, color-mix(in srgb, var(--slate-deep) 72%, transparent), transparent); }
      .card .kick { display: flex; align-items: center; gap: var(--space-4); font-size: var(--type-meta); letter-spacing: var(--tracking-mark); text-transform: uppercase; color: var(--floor-mark); margin-right: calc(var(--tracking-mark) * -1); animation: card-in var(--motion-calm) var(--ease-standard) var(--motion-base) both; }
      .card .kick::before, .card .kick::after { content: ''; width: var(--space-7); height: 1px; background: linear-gradient(to right, transparent, var(--floor-mark)); }
      .card .kick::after { transform: scaleX(-1); }
      .card .name { margin: 0; font-size: var(--type-display-fluid); line-height: var(--leading-display-fluid); font-weight: 200; letter-spacing: var(--tracking-title); text-transform: uppercase; color: var(--ink); margin-right: calc(var(--tracking-title) * -1); animation: card-track calc(var(--motion-calm) * 2) var(--ease-out) both; }
      .card .line { font-size: var(--type-small); color: var(--ink-muted); animation: card-in var(--motion-calm) var(--ease-standard) var(--motion-calm) both; }
      @keyframes card-life { 0% { opacity: 0; } 10% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes card-track { from { letter-spacing: calc(var(--tracking-title) * 2); opacity: 0; filter: blur(8px); } }
      @keyframes card-in { from { opacity: 0; } }
      .floors { list-style: none; margin: 0 0 var(--space-4); padding: 0; }
      .floors .row[aria-current] { color: var(--ink); }
      .floors .row ui-icon { color: var(--ink-muted); }
      .floors .row[aria-current] ui-icon { color: var(--floor-mark); }
      .floors .row .text b i { font-style: normal; color: var(--ink-muted); }
      .left { display: flex; align-items: center; gap: var(--space-4); min-width: 0; }
      .back { flex: none; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2); border-radius: var(--radius-pill); border: 1px solid var(--hairline-strong); font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink); transition: background var(--motion-quick); }
      .back:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); }
      .back:focus-visible { outline: 0; box-shadow: 0 0 0 2px var(--focus); }
      .navs { flex: none; display: flex; gap: var(--space-2); }
      .nav { width: var(--space-5); height: var(--space-5); display: grid; place-items: center; border-radius: var(--radius-pill); border: 1px solid var(--hairline-strong); color: var(--ink); transition: background var(--motion-quick), border-color var(--motion-quick); }
      .nav:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); }
      .nav:focus-visible { outline: 0; box-shadow: 0 0 0 2px var(--focus); }
      .nav[aria-current] { border-color: var(--floor-mark, var(--ink)); color: var(--floor-mark, var(--ink)); }
      .nav[aria-disabled="true"] { color: var(--ink-muted); opacity: 0.5; cursor: not-allowed; }
      .nav[aria-disabled="true"]:hover { background: none; }
      @media (max-width: 640px) { .mark span, .back span, .place span { display: none; } .dome > button { left: calc(50% + var(--x) * 0.6); } }
      @media (prefers-reduced-motion: reduce) {
        :host([open]) .stage, :host([open]) .ground, .fade, :host([open]) .fade { transform: none; }
        .dome > button, :host([open]) .dome > button { transform: translate(-50%, -50%); transition: opacity var(--motion-base); }
        .thread::after, .orb.needs::after { animation: none; }
        .view { animation: none; }
        .card .name, .card .kick, .card .line { animation: none; }
      }
    `,
  ];

  /* ---- render ---- */

  private renderBand() {
    const mood = this.mood;
    const words = this.statusLabel || (this.online ? streamWords(this.heard) : 'Offline');
    const time = new Date(this.now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tab = this.isOpen ? '-1' : '0';
    return html`<header class="band" ?inert=${this.isOpen}>
      <div class="left">${this.renderWhere()}${this.renderNavs(tab)}${this.renderBack(tab)}</div>
      <button class="handle" aria-label="Open the shell" tabindex=${tab} @click=${() => this.open()}><i></i></button>
      ${this.renderPlace()}
      <div class="right">
        <button class="status ${mood}" tabindex=${tab} aria-label=${`${words}. Open notifications.`} @click=${() => this.openView('stream')}><i class="point"></i>${words}</button>
        <span class="clock">${time}</span>
      </div>
    </header>`;
  }

  /** The app that's open, when one is: `current` among `apps`. */
  get openNow(): ShellApp | undefined {
    return this.current ? this.apps.find((a) => a.id === this.current) : undefined;
  }

  /** Home and Title, beside where you are: each goes there from any screen. */
  private renderNavs(tab: string) {
    if (!this.navs.length) return nothing;
    return html`<nav class="navs" aria-label="Go to">
      ${this.navs.map((n) => {
        const label = n.unavailable ? `${n.label}. ${n.unavailable}` : n.current ? `${n.label}, you’re here` : n.label;
        return html`<button
          class="nav"
          tabindex=${tab}
          aria-label=${label}
          title=${n.unavailable ?? n.label}
          aria-current=${n.current ? 'page' : nothing}
          aria-disabled=${n.unavailable ? 'true' : nothing}
          @click=${() => !n.unavailable && !n.current && this.emit('ui-nav', { id: n.id })}
        ><ui-icon name=${n.icon} size="16"></ui-icon></button>`;
      })}
    </nav>`;
  }

  /** Back, beside where you are: up one level, the same as Esc. Hidden when there's nowhere up to go. */
  private renderBack(tab: string) {
    if (!this.backTo) return nothing;
    return html`<button class="back" tabindex=${tab} aria-label=${`Back to ${this.backTo}`} @click=${() => this.emit('ui-back', {})}><ui-icon name="back" size="16"></ui-icon><span>Back</span></button>`;
  }

  /** Under the handle: the open app's name, and the part of it you're in. It's the one place the band names an app. */
  private renderPlace() {
    const app = this.openNow;
    if (!app) return nothing;
    return html`<p class="place"><b>${app.name}</b>${this.area ? html`<span>${this.area}</span>` : nothing}</p>`;
  }

  /** Top left: the product, or with floors the floor you're on, its icon in the floor's colour and its name. Never a path. */
  private renderWhere() {
    const here = this.currentFloor;
    if (!here) return html`<div class="mark"><b>${this.product}</b>${this.workspace ? html`<span>${this.workspace}</span>` : nothing}</div>`;
    return html`<p class="where" aria-label=${`You’re on ${here.kind === 'personal' ? 'your own floor' : here.kind === 'team' ? `${here.name}, a ${floorKindOf(here).toLowerCase()}` : here.name}`}>
      <ui-icon name=${floorIconOf(here)} size="16"></ui-icon><b aria-hidden="true">${here.name}</b>
    </p>`;
  }

  /** How many notifications wait on each floor. */
  private waitingByFloor() {
    const counts = new Map<string, number>();
    for (const n of this.notifications) if (n.floor) counts.set(n.floor, (counts.get(n.floor) ?? 0) + 1);
    return counts;
  }

  /** "On Finance" for a notification from another floor; nothing for one from here or from no floor. */
  private floorTag(n: ShellNotification) {
    if (!n.floor || n.floor === this.floor) return '';
    const f = this.floors.find((x) => x.id === n.floor);
    return f ? ` · ${f.kind === 'personal' ? 'On your own floor' : `On ${f.name}`}` : '';
  }

  /**
   * The edge gauge: one notch per floor from yours to the org, the one you're
   * on lit in its colour, with a dot where something waits and the open app
   * pinned beside it. Pointing at it or tabbing into it opens it out: each
   * floor's name and who sees what's on it, and which floor the app is showing.
   */
  private renderGauge() {
    if (!this.currentFloor) return nothing;
    const stack = floorStack(this.floors, this.floor, this.lastTeam).reverse();
    const tab = this.isOpen ? '-1' : '0';
    const waiting = this.waitingByFloor();
    const app = this.openNow;
    const rest = this.floorsRest;
    return html`<nav class="gauge ${rest ? 'rest' : ''}" aria-label="Floors" ?inert=${this.isOpen}>
      ${rest ? html`<p class="why" id="floors-rest"><span>${rest}, so moving floors wouldn’t change it.</span></p>` : nothing}
      <ol>
        ${stack.map((f) => {
          const count = waiting.get(f.id) ?? 0;
          const name = f.kind === 'personal' ? 'Your own floor' : f.name;
          const here = f.id === this.floor;
          return html`<li><button tabindex=${tab} aria-label=${[name, here ? 'you’re here' : '', count ? `${count} waiting` : ''].filter(Boolean).join(', ')}
            aria-describedby=${rest ? `floors-rest floor-${f.id}` : `floor-${f.id}`} aria-current=${here ? 'location' : nothing} aria-disabled=${rest && !here ? 'true' : nothing}
            ?data-waiting=${count > 0} @click=${() => !rest && this.goToFloor(f.id)}>
            <span class="label" id=${`floor-${f.id}`}><span>
              <b>${name} ${here ? html`<em>You’re here</em>` : count ? html`<em class="waiting">${count} waiting</em>` : nothing}</b>
              <span>${f.kind === 'team' ? `${floorKindOf(f)}. ` : ''}${floorMeaning(f)}</span>
              ${here && app && !rest ? html`<span class="bound"><ui-icon name=${app.icon ?? 'apps'} size="14"></ui-icon>${app.name} is showing this floor</span>` : nothing}
            </span></span>
            ${here && app ? html`<span class="pinned" aria-hidden="true"><ui-icon name=${app.icon ?? 'apps'} size="12"></ui-icon></span>` : nothing}
            <span class="notch"><ui-icon name=${floorIconOf(f)} size="14"></ui-icon>${count ? html`<span class="dot"></span>` : nothing}</span>
          </button></li>`;
        })}
      </ol>
    </nav>`;
  }

  /** The water's colours on this floor: your own keeps the screen's own palette; teams and the org bring theirs. */
  private floorWater(): { colors?: { navy: string; green: string }; level: number } {
    const here = this.currentFloor;
    if (!here) return { level: 0 };
    if (here.kind === 'personal' || !this.isConnected) return { level: floorLevel[here.kind] };
    const cs = getComputedStyle(this);
    const tone = floorTone(here);
    const navy = cs.getPropertyValue(`--floor-${tone}-low`).trim();
    const green = cs.getPropertyValue(`--floor-${tone}-high`).trim();
    return { colors: navy && green ? { navy, green } : undefined, level: floorLevel[here.kind] };
  }

  private renderDome() {
    const mood = this.mood;
    return html`<div class="dome">
      ${this.order.map((id, i) => {
        const slot = this.arcSlot(i);
        const style = `--x: calc(${slot} * min(112px, 15vw)); --y: ${Math.round(slot * slot * 10)}px; --i: ${Math.abs(i - this.streamSlot)}`;
        const lit = this.view === id;
        const tabindex = i === this.focusIndex ? '0' : '-1';
        if (id === 'stream') {
          return html`<button class="stream ${lit ? 'lit' : ''}" style=${style} tabindex=${tabindex} aria-label=${`Notifications: ${this.online ? streamWords(this.heard) : 'offline'}`}
            @focus=${() => (this.focusIndex = i)} @click=${() => this.openView('stream')}>
            <span class="thread"></span><span class="orb ${mood}"><i></i></span>
          </button>`;
        }
        const fn = this.functions.find((f) => f.id === id)!;
        return html`<button class="fn ${lit ? 'lit' : ''}" style=${style} tabindex=${tabindex} aria-label=${fn.label}
          @focus=${() => (this.focusIndex = i)} @click=${() => this.openView(fn.id)}>
          <ui-icon name=${fn.icon}></ui-icon>
        </button>`;
      })}
    </div>`;
  }

  private appName(id: string) {
    return this.apps.find((a) => a.id === id)?.name ?? id;
  }

  /**
   * The stream's groups, one per app, newest first inside each: apps with
   * something that needs you first, then by their newest, muted apps last.
   */
  private streamGroups() {
    const byApp = new Map<string, ShellNotification[]>();
    for (const n of [...this.notifications].sort((a, b) => toTime(b.time) - toTime(a.time))) byApp.set(n.app, [...(byApp.get(n.app) ?? []), n]);
    return [...byApp]
      .map(([app, list]) => ({ app, list, muted: this.muted.includes(app), needs: list.some((n) => n.level === 'needs') }))
      .sort((a, b) => Number(a.muted) - Number(b.muted) || Number(b.needs) - Number(a.needs) || toTime(b.list[0].time) - toTime(a.list[0].time));
  }

  private menuFor = '';

  private openGroupMenu(e: Event, app: string) {
    const menu = this.renderRoot.querySelector<UiMenu>('ui-menu.stream-menu');
    if (!menu) return;
    const muted = this.muted.includes(app);
    const name = this.appName(app);
    this.menuFor = app;
    const items: MenuAction[] = [muted ? { id: 'unmute', label: `Unmute ${name}`, icon: 'bell' } : { id: 'mute', label: `Mute ${name}`, icon: 'mute' }];
    if (menu.isOpen) menu.close(false);
    void menu.show(e.currentTarget as HTMLElement, items);
  }

  private onGroupMenu(e: Event) {
    const { item } = (e as CustomEvent<{ item: MenuAction }>).detail;
    if (this.menuFor) this.setMuted(this.menuFor, item.id === 'mute');
  }

  private renderStream() {
    if (this.streamLoading) return html`<p class="note" aria-busy="true">Catching up…</p><span class="skel"></span><span class="skel"></span>`;
    if (this.streamError) {
      return html`<p class="note error" role="alert">${this.streamError || "Can't reach notifications. Nothing was lost."}</p>
        <button class="retry" data-first @click=${() => this.emit('ui-retry', { what: 'stream' })}>Try again</button>`;
    }
    const list = this.notifications;
    if (!list.length) return html`<p class="note" tabindex="0" data-first>All quiet. Nothing needs you.</p>`;
    const groups = this.streamGroups();
    // The first thing that needs you pings; the rest are a still green. Muted apps never ping.
    const pinging = groups.find((g) => !g.muted && g.needs)?.list.find((n) => n.level === 'needs')?.id;
    let first = true;
    return html`
      ${list.some((n) => n.level !== 'needs') ? html`<div class="tools"><button class="link" @click=${() => this.clear()}>Clear the quiet ones</button></div>` : nothing}
      ${groups.map(
        ({ app, list: g, muted, needs }) => html`<div class="group label ${needs && !muted ? 'needs' : ''}">
            <span class="name">${this.appName(app)} <b>${g.length}</b>${muted ? html`<span class="quiet">Muted</span>` : nothing}</span>
            <button class="more" aria-label=${`${this.appName(app)}: more`} aria-haspopup="menu" @click=${(e: Event) => this.openGroupMenu(e, app)}><ui-icon name="more" size="16"></ui-icon></button>
          </div>
          <ul aria-label=${this.appName(app)}>${g.map((n) => {
            const attrs = first;
            first = false;
            const actions = (n.actions ?? []).slice(0, 2);
            return html`<li class="item ${muted ? 'muted' : ''}">
              <button class="row ${n.level} ${n.id === pinging ? 'first' : ''}" ?data-first=${attrs}
                @click=${() => this.openNotification(n)}
                @keydown=${(e: KeyboardEvent) => e.key.toLowerCase() === 'x' && (e.preventDefault(), this.dismiss(n.id))}>
                <span class="lead"></span>
                <span class="text"><b>${n.title}</b><span>${[this.floorTag(n).replace(/^ · /, ''), n.detail].filter(Boolean).join(' · ')}</span></span>
                <span class="meta">${ago(n.time, this.now)}</span>
              </button>
              ${actions.map((a, i) => html`<button class="act ${i === 0 && n.level === 'needs' ? 'main' : ''}" @click=${() => this.actOn(n, i)}>${a.label}</button>`)}
              <button class="x" aria-label=${`Dismiss ${n.title}`} @click=${() => this.dismiss(n.id)}><ui-icon name="close" size="16"></ui-icon></button>
            </li>`;
          })}</ul>`,
      )}
      <ui-menu class="stream-menu" label="App notifications" @ui-select=${this.onGroupMenu}></ui-menu>`;
  }

  private renderApps() {
    const byId = new Map(this.apps.map((a) => [a.id, a]));
    const ordered = [
      ...(this.current && byId.has(this.current) ? [this.current] : []),
      ...this.recent.filter((id) => id !== this.current && byId.has(id)),
      ...this.apps.map((a) => a.id).filter((id) => id !== this.current && !this.recent.includes(id)),
    ].map((id) => byId.get(id)!);
    if (!ordered.length) return html`<p class="note">No apps yet.</p>`;
    return html`<div class="apps" role="list">
      ${ordered.map(
        (a, i) => html`<button class="app" role="listitem" ?data-first=${i === 0} @click=${() => this.openApp(a.id)}
          @keydown=${(e: KeyboardEvent) => this.moveInGrid(e)}>
          <ui-icon name=${a.icon ?? 'apps'} ?bubble=${a.ai} size=${a.ai ? 48 : 32}></ui-icon>
          <b>${a.name}</b>
          ${a.id === this.current ? html`<em>Open now</em>` : a.line ? html`<span>${a.line}</span>` : nothing}
        </button>`,
      )}
    </div>`;
  }

  private moveInGrid(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    const items = [...this.renderRoot.querySelectorAll<HTMLElement>('.app')];
    const at = items.indexOf(e.currentTarget as HTMLElement);
    items[(at + step + items.length) % items.length]?.focus();
  }

  private findLocal(q: string): ShellFindResult[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(needle));
    return [
      ...this.apps.filter((a) => has(a.name, a.line)).map((a) => ({ id: a.id, title: a.name, detail: 'App', kind: 'app' })),
      ...this.notifications.filter((n) => has(n.title, n.detail)).map((n) => ({ id: n.id, title: n.title, detail: this.appName(n.app), kind: 'notification' })),
      ...this.agents.filter((a) => has(a.name, a.detail)).map((a) => ({ id: a.id, title: a.name, detail: 'Agent', kind: 'agent' })),
    ];
  }

  private pick(r: ShellFindResult) {
    this.emit('ui-pick', { result: r });
    if (r.kind === 'app') return this.openApp(r.id);
    const n = this.notifications.find((x) => x.id === r.id);
    if (r.kind === 'notification' && n) return this.openNotification(n);
    const agent = this.agents.find((x) => x.id === r.id);
    if (r.kind === 'agent' && agent?.app) return this.openApp(agent.app);
    this.close();
  }

  private renderFind() {
    const loose = this.query ? [...this.findLocal(this.query), ...this.findResults.filter((r) => !r.group)] : [];
    const grouped = this.query ? this.findGroups : [];
    const inGroup = (name: string) => this.findResults.filter((r) => r.group === name);
    const results = [...loose, ...grouped.flatMap((g) => inGroup(g.name))];
    const waiting = grouped.some((g) => g.state === 'looking');
    const row = (r: ShellFindResult) =>
      html`<li><button class="row" @click=${() => this.pick(r)}><span class="text"><b>${r.title}</b><span>${r.detail ?? r.kind}</span></span></button></li>`;
    const said = { looking: 'Still looking…', late: 'Didn’t answer in time.', failed: 'Couldn’t search right now.' } as const;
    return html`<div class="search">
        <ui-icon name="find" size="20"></ui-icon>
        <input type="search" aria-label="Find across apps, notifications and agents" placeholder="Find apps, notifications, agents…" .value=${this.query}
          @input=${(e: InputEvent) => {
            this.query = (e.target as HTMLInputElement).value;
            this.emit('ui-find', { q: this.query });
          }}
          @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && results[0] && this.pick(results[0])} />
      </div>
      ${this.query && !results.length && !waiting ? html`<p class="note">Nothing matches "${this.query}".</p>` : nothing}
      <ul>${loose.map(row)}</ul>
      ${grouped.map((g) => {
        const found = inGroup(g.name);
        if (!found.length && g.state === 'done') return nothing;
        return html`<div class="group label">${g.name}${found.length ? html` <b>${found.length}</b>` : nothing}</div>
          ${found.length
            ? html`<ul aria-label=${g.name}>${found.map(row)}</ul>`
            : html`<p class="note small ${g.state}" aria-busy=${g.state === 'looking' ? 'true' : nothing}>${said[g.state as keyof typeof said]}</p>`}`;
      })}
      <div class="live" aria-live="polite">${this.query && !waiting ? `${results.length} found` : ''}</div>`;
  }

  private renderAgents() {
    if (this.agentsLoading) return html`<p class="note" aria-busy="true">Catching up…</p><span class="skel"></span>`;
    if (this.agentsError) return html`<p class="note error" role="alert">${this.agentsError}</p><button class="retry" @click=${() => this.emit('ui-retry', { what: 'agents' })}>Try again</button>`;
    if (!this.agents.length) return html`<p class="note" tabindex="0">No agents are running.</p>`;
    const sorted = [...this.agents].sort((a, b) => statusUrgency.indexOf(a.status) - statusUrgency.indexOf(b.status));
    const firstNeeds = sorted.findIndex((a) => a.status === 'needs');
    return html`<ul>${sorted.map(
      (a, i) => html`<li><button class="row" @click=${() => (a.app ? this.openApp(a.app) : this.emit('ui-function', { id: `agent:${a.id}` }))}>
        <span class="text"><b>${a.name}</b>${a.detail ? html`<span>${a.detail}</span>` : nothing}</span>
        <ui-status status=${a.status} ?next=${i === firstNeeds}></ui-status>
      </button></li>`,
    )}</ul>`;
  }

  private renderAccount() {
    const here = this.currentFloor;
    const waiting = this.waitingByFloor();
    return html`<div class="who"><b>${this.user?.name ?? 'Signed in'}</b>${this.user?.email ? html`<span>${this.user.email}</span>` : nothing}</div>
      ${here
        ? html`<div class="group label">Floors</div>
            <ul class="floors">
              ${this.floors.map(
                (f) => html`<li><button class="row" aria-current=${f.id === this.floor ? 'location' : nothing} @click=${() => (this.goToFloor(f.id), this.close())}>
                  <ui-icon name=${floorIconOf(f)}></ui-icon>
                  <span class="text"><b>${f.kind === 'personal' ? 'Your own floor' : f.name}${f.path.length > 1 ? html`<i> in ${f.path.slice(0, -1).map((p) => p.name).join(' / ')}</i>` : nothing}</b><span>${f.kind === 'team' ? `${floorKindOf(f)}. ` : ''}${floorMeaning(f)}</span></span>
                  ${f.id === this.floor ? html`<span class="meta">You’re here</span>` : waiting.get(f.id) ? html`<span class="meta">${waiting.get(f.id)} waiting</span>` : nothing}
                </button></li>`,
              )}
            </ul>`
        : html`<div class="pair"><span>Workspace</span><b>${this.workspace || '—'}</b></div>`}
      <div class="pair"><span id="away">Show me as away</span>
        <button class="switch" role="switch" aria-labelledby="away" aria-checked=${this.away ? 'true' : 'false'} @click=${() => {
          this.away = !this.away;
          this.emit('ui-setting', { key: 'away', value: this.away });
        }}></button>
      </div>
      <div class="pair">${this.canSwitchWorkspace && !here
          ? html`<button class="link" @click=${() => this.emit('ui-function', { id: 'switch-workspace' })}>Switch workspace</button>`
          : html`<span></span>`}
        <button class="link" @click=${() => this.emit('ui-function', { id: 'sign-out' })}>Sign out</button></div>`;
  }

  private setSetting(key: 'reduceMotion' | 'density' | 'areaTitles' | 'toasts', value: unknown) {
    this.settings = { ...this.settings, [key]: value };
    this.emit('ui-setting', { key, value });
  }

  private renderSettings() {
    const s = this.settings;
    return html`<div class="pair"><span id="rm">Reduce motion</span>
        <button class="switch" role="switch" aria-labelledby="rm" aria-checked=${s.reduceMotion ? 'true' : 'false'} @click=${() => this.setSetting('reduceMotion', !s.reduceMotion)}></button></div>
      <div class="pair"><span id="at">Area titles</span>
        <button class="switch" role="switch" aria-labelledby="at" aria-checked=${s.areaTitles === false ? 'false' : 'true'} @click=${() => this.setSetting('areaTitles', s.areaTitles === false)}></button></div>
      <div class="pair"><span id="ts">Toasts for new notifications</span>
        <button class="switch" role="switch" aria-labelledby="ts" aria-checked=${s.toasts ? 'true' : 'false'} @click=${() => this.setSetting('toasts', !s.toasts)}></button></div>
      <div class="pair"><span>Density</span>
        <div class="seg" role="group" aria-label="Density">
          ${(['comfortable', 'compact'] as const).map(
            (d) => html`<button aria-pressed=${(s.density ?? 'comfortable') === d ? 'true' : 'false'} @click=${() => this.setSetting('density', d)}>${d[0].toUpperCase() + d.slice(1)}</button>`,
          )}
        </div></div>
      ${this.version ? html`<div class="pair version"><span>Version</span><b>${this.version}</b></div>` : nothing}
      <div class="group label">Keys</div>
      <div class="keys">
        <kbd>\`</kbd><span>Open or close the shell (also Ctrl or ⌘ K)</span>
        <kbd>← →</kbd><span>Move along the arc</span>
        <kbd>Enter</kbd><span>Open</span>
        <kbd>x</kbd><span>Dismiss a notification</span>
        <kbd>Esc</kbd><span>Back, then close</span>
        ${this.floors.length ? html`<kbd>PgUp PgDn</kbd><span>Up or down a floor, once the page is at its top or bottom (with Alt, at once)</span>` : nothing}
      </div>`;
  }

  private renderView() {
    if (!this.view) return nothing;
    const custom = this.views[this.view];
    const back = () => this.closeView();
    const body = custom
      ? custom(this, back)
      : {
          stream: () => this.renderStream(),
          apps: () => this.renderApps(),
          find: () => this.renderFind(),
          agents: () => this.renderAgents(),
          account: () => this.renderAccount(),
          settings: () => this.renderSettings(),
        }[this.view as ShellView]?.();
    return html`<section class="view" aria-label=${this.caption().title}>${body}</section>`;
  }

  override render() {
    const mood = this.mood;
    const cap = this.caption();
    const capMood = !this.view || this.view === 'stream' ? mood : 'quiet';
    const water = this.floorWater();
    const kind = this.currentFloor?.kind;
    if (kind) this.setAttribute('floor-kind', kind);
    else this.removeAttribute('floor-kind');
    if (this.currentFloor) this.setAttribute('floor-tone', floorTone(this.currentFloor));
    else this.removeAttribute('floor-tone');
    return html`
      <div class="ground" part="ground">${this.background && this.background !== 'none'
        ? html`<ui-wave-background preset=${this.background} .colors=${water.colors} .level=${water.level}></ui-wave-background>`
        : nothing}</div>
      ${this.renderBand()}
      ${this.renderGauge()}
      ${this.card
        ? html`<div class="card ${this.card.kind}" aria-hidden="true">${this.card.kick ? html`<span class="kick">${this.card.kick}</span>` : nothing}<p class="name">${this.card.name}</p>${this.card.line ? html`<span class="line">${this.card.line}</span>` : nothing}</div>`
        : nothing}
      <div class="stage" part="stage"><slot></slot></div>
      <div class="sky ${mood}" role="dialog" aria-modal="true" aria-label="Shell" aria-hidden=${this.isOpen ? 'false' : 'true'} ?inert=${!this.isOpen}
        @keydown=${this.onSkyKey}
        @click=${(e: MouseEvent) => (e.target as HTMLElement).classList?.contains('fade') && (this.view ? this.closeView() : this.close())}>
        <div class="fade"></div>
        <div class="stars"></div>
        ${this.renderDome()}
        ${this.view && this.view !== 'stream' ? nothing : html`<p class="caption ${capMood}"><b>${cap.title}</b>${cap.line ? html`<span>${cap.line}</span>` : nothing}</p>`}
        ${this.view && this.view !== 'stream' ? html`<p class="caption"><b>${cap.title}</b></p>` : nothing}
        ${this.renderView()}
        ${this.undo
          ? html`<div class="toast" role="status">${this.undo.label}<button class="link" @click=${() => this.restore()}>Undo</button></div>`
          : nothing}
        <button class="esc" tabindex="-1" @click=${() => (this.view ? this.closeView() : this.close())}><kbd>Esc</kbd>${this.view ? 'Back' : 'Close'}</button>
      </div>
      <div class="live" aria-live="polite">${this.isOpen ? `${cap.title}. ${cap.line}` : this.said}</div>
    `;
  }
}

/** An area title card: the kind of place or the floor above, its name large, and who sees it. */
export interface AreaCard {
  kind: 'floor' | 'app';
  kick: string;
  name: string;
  line?: string;
}

/** Where the stage sits as it leaves (1) or before it comes in (-1) on a move between floors. */
function travel(direction: FloorDirection, way: 1 | -1): string {
  if (motionMode() === 'reduce') return 'none';
  const far = tokenValue('travel-floor', 96) * way;
  return direction === 'up' ? `translateY(${far}px)` : direction === 'down' ? `translateY(${-far}px)` : `translateX(${-far}px)`;
}

if (!customElements.get('ui-shell')) customElements.define('ui-shell', UiShell);

declare global {
  interface HTMLElementTagNameMap {
    'ui-shell': UiShell;
  }
}
