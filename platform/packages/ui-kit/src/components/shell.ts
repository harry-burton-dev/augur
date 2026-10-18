import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { base, label } from '../shared.js';
import { statusUrgency, type StatusName } from './status.js';
import './icon.js';
import './status.js';
import './wave.js';
import type { UiWaveBackground } from './wave.js';

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
}

export interface ShellApp {
  id: string;
  name: string;
  /** One line about it, shown under the name in Apps. */
  line?: string;
  icon?: string;
  /** AI apps carry the bubble. */
  ai?: boolean;
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

export interface ShellFindResult {
  id: string;
  title: string;
  detail?: string;
  kind: 'app' | 'notification' | 'agent' | string;
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
 * The frame every app runs inside. It holds who you are, the workspace,
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
 * @fires ui-open-notification - detail `{ notification }`
 * @fires ui-dismiss - detail `{ ids }` when notifications are dismissed or cleared; the host may mark them read
 * @fires ui-restore - detail `{ ids }` when Undo brings them back
 * @fires ui-function - detail `{ id }` for functions without a view, and for Switch workspace and Sign out
 * @fires ui-find - detail `{ q }`; the host may set `findResults`
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
    agents: { attribute: false },
    agentsLoading: { type: Boolean, attribute: 'agents-loading' },
    agentsError: { type: String, attribute: 'agents-error' },
    functions: { attribute: false },
    views: { attribute: false },
    streamLoading: { type: Boolean, attribute: 'stream-loading' },
    streamError: { type: String, attribute: 'stream-error' },
    findResults: { attribute: false },
    settings: { attribute: false },
    away: { type: Boolean },
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
  declare agents: ShellAgent[];
  declare agentsLoading: boolean;
  declare agentsError: string;
  declare functions: ShellFunction[];
  declare views: Partial<Record<string, ShellViewRenderer>>;
  declare streamLoading: boolean;
  declare streamError: string;
  declare findResults: ShellFindResult[];
  declare settings: { reduceMotion?: boolean; density?: 'comfortable' | 'compact' };
  declare away: boolean;
  /** The water's preset (Calm Tide unless a screen has a reason), or `none` for the still ground. */
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

  constructor() {
    super();
    this.product = 'Platform';
    this.workspace = '';
    this.user = undefined;
    this.online = true;
    this.statusLabel = '';
    this.apps = [];
    this.current = '';
    this.recent = [];
    this.notifications = [];
    this.agents = [];
    this.agentsLoading = false;
    this.agentsError = '';
    this.functions = defaultFunctions;
    this.views = {};
    this.streamLoading = false;
    this.streamError = '';
    this.findResults = [];
    this.settings = { reduceMotion: false, density: 'comfortable' };
    this.away = false;
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

  /** The water under the stage, for menus to swell as you move; null when it is turned off. */
  get waves(): UiWaveBackground | null {
    return this.renderRoot?.querySelector('ui-wave-background') ?? null;
  }

  /** The element apps mount into. */
  get stage(): HTMLElement {
    return this;
  }

  /* ---- lifecycle and keys ---- */

  private onWindowKey = (e: KeyboardEvent) => {
    const summon = (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k');
    if (summon) {
      e.preventDefault();
      this.toggle();
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onWindowKey);
    this.clock = setInterval(() => (this.now = Date.now()), 30_000);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onWindowKey);
    clearInterval(this.clock);
    clearTimeout(this.arriveTimer);
  }

  override async updated(changed: Map<string, unknown>) {
    const stage = this.renderRoot.querySelector<HTMLElement>('.stage');
    if (stage) stage.inert = this.isOpen;
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

  /* ---- what the sky says ---- */

  private get mood(): 'quiet' | 'some' | 'needs' | 'offline' {
    if (!this.online) return 'offline';
    if (this.notifications.some((n) => n.level === 'needs')) return 'needs';
    return this.notifications.length ? 'some' : 'quiet';
  }

  private caption(): { title: string; line: string } {
    const id = this.view || this.order[this.focusIndex] || 'stream';
    if (id === 'stream') {
      const latest = this.notifications.find((n) => n.level === 'needs') ?? this.notifications[0];
      const title = this.online ? streamWords(this.notifications) : 'Offline';
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
      .stage { position: absolute; inset: var(--band-top) 0 0; z-index: 1; isolation: isolate; overflow: auto; transform-origin: 50% 100%; transition: transform var(--motion-calm) var(--s-ease), filter var(--motion-calm) var(--s-ease); }
      /* looking up: the water and the app tip away below you and go dark */
      :host([open]) .ground { transform: translateY(14%) scale(1.04); filter: brightness(0.5) saturate(0.7); }
      :host([open]) .stage { transform: perspective(1400px) translateY(12%) rotateX(9deg) scale(0.96); filter: brightness(0.38) saturate(0.6) blur(2px); }
      .live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

      /* the band */
      .band { position: absolute; z-index: 4; top: 0; left: 0; right: 0; height: var(--band-top); padding: 0 var(--edge); display: flex; align-items: center; justify-content: space-between; transition: opacity var(--motion-slow) var(--ease-standard); }
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

      @media (max-width: 640px) { .mark span { display: none; } .dome > button { left: calc(50% + var(--x) * 0.6); } }
      @media (prefers-reduced-motion: reduce) {
        :host([open]) .stage, :host([open]) .ground, .fade, :host([open]) .fade { transform: none; }
        .dome > button, :host([open]) .dome > button { transform: translate(-50%, -50%); transition: opacity var(--motion-base); }
        .thread::after, .orb.needs::after { animation: none; }
        .view { animation: none; }
      }
    `,
  ];

  /* ---- render ---- */

  private renderBand() {
    const mood = this.mood;
    const words = this.statusLabel || (this.online ? streamWords(this.notifications) : 'Offline');
    const time = new Date(this.now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tab = this.isOpen ? '-1' : '0';
    return html`<header class="band" ?inert=${this.isOpen}>
      <div class="mark"><b>${this.product}</b>${this.workspace ? html`<span>${this.workspace}</span>` : nothing}</div>
      <button class="handle" aria-label="Open the shell" tabindex=${tab} @click=${() => this.open()}><i></i></button>
      <div class="right">
        <button class="status ${mood}" tabindex=${tab} aria-label=${`${words}. Open notifications.`} @click=${() => this.openView('stream')}><i class="point"></i>${words}</button>
        <span class="clock">${time}</span>
      </div>
    </header>`;
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
          return html`<button class="stream ${lit ? 'lit' : ''}" style=${style} tabindex=${tabindex} aria-label=${`Notifications: ${this.online ? streamWords(this.notifications) : 'offline'}`}
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

  private renderStream() {
    if (this.streamLoading) return html`<p class="note" aria-busy="true">Catching up…</p><span class="skel"></span><span class="skel"></span>`;
    if (this.streamError) {
      return html`<p class="note error" role="alert">${this.streamError || "Can't reach notifications. Nothing was lost."}</p>
        <button class="retry" data-first @click=${() => this.emit('ui-retry', { what: 'stream' })}>Try again</button>`;
    }
    const list = this.notifications;
    if (!list.length) return html`<p class="note" tabindex="0" data-first>All quiet. Nothing needs you.</p>`;
    const startOfDay = new Date(this.now).setHours(0, 0, 0, 0);
    const groups: [string, ShellNotification[], boolean][] = [
      ['Needs you', list.filter((n) => n.level === 'needs'), true],
      ['Today', list.filter((n) => n.level !== 'needs' && toTime(n.time) >= startOfDay), false],
      ['Earlier', list.filter((n) => n.level !== 'needs' && toTime(n.time) < startOfDay), false],
    ];
    let first = true;
    return html`
      ${list.some((n) => n.level !== 'needs') ? html`<div class="tools"><button class="link" @click=${() => this.clear()}>Clear the quiet ones</button></div>` : nothing}
      ${groups.filter(([, g]) => g.length).map(
        ([name, g, needs]) => html`<div class="group label ${needs ? 'needs' : ''}">${name} <b>${g.length}</b></div>
          <ul>${g.map((n, i) => {
            const attrs = first;
            first = false;
            return html`<li class="item">
              <button class="row ${n.level} ${needs && i === 0 ? 'first' : ''}" ?data-first=${attrs}
                @click=${() => this.openNotification(n)}
                @keydown=${(e: KeyboardEvent) => e.key.toLowerCase() === 'x' && (e.preventDefault(), this.dismiss(n.id))}>
                <span class="lead"></span>
                <span class="text"><b>${n.title}</b><span>${this.appName(n.app)}${n.detail ? ` · ${n.detail}` : ''}</span></span>
                <span class="meta">${ago(n.time, this.now)}</span>
              </button>
              <button class="x" aria-label=${`Dismiss ${n.title}`} @click=${() => this.dismiss(n.id)}><ui-icon name="close" size="16"></ui-icon></button>
            </li>`;
          })}</ul>`,
      )}`;
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
    const results = this.query ? [...this.findLocal(this.query), ...this.findResults] : [];
    return html`<div class="search">
        <ui-icon name="find" size="20"></ui-icon>
        <input type="search" aria-label="Find across apps, notifications and agents" placeholder="Find apps, notifications, agents…" .value=${this.query}
          @input=${(e: InputEvent) => {
            this.query = (e.target as HTMLInputElement).value;
            this.emit('ui-find', { q: this.query });
          }}
          @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && results[0] && this.pick(results[0])} />
      </div>
      ${this.query && !results.length ? html`<p class="note">Nothing matches "${this.query}".</p>` : nothing}
      <ul>${results.map(
        (r) => html`<li><button class="row" @click=${() => this.pick(r)}><span class="text"><b>${r.title}</b><span>${r.detail ?? r.kind}</span></span></button></li>`,
      )}</ul>`;
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
    return html`<div class="who"><b>${this.user?.name ?? 'Signed in'}</b>${this.user?.email ? html`<span>${this.user.email}</span>` : nothing}</div>
      <div class="pair"><span>Workspace</span><b>${this.workspace || '—'}</b></div>
      <div class="pair"><span id="away">Show me as away</span>
        <button class="switch" role="switch" aria-labelledby="away" aria-checked=${this.away ? 'true' : 'false'} @click=${() => {
          this.away = !this.away;
          this.emit('ui-setting', { key: 'away', value: this.away });
        }}></button>
      </div>
      <div class="pair"><button class="link" @click=${() => this.emit('ui-function', { id: 'switch-workspace' })}>Switch workspace</button>
        <button class="link" @click=${() => this.emit('ui-function', { id: 'sign-out' })}>Sign out</button></div>`;
  }

  private setSetting(key: 'reduceMotion' | 'density', value: unknown) {
    this.settings = { ...this.settings, [key]: value };
    this.emit('ui-setting', { key, value });
  }

  private renderSettings() {
    const s = this.settings;
    return html`<div class="pair"><span id="rm">Reduce motion</span>
        <button class="switch" role="switch" aria-labelledby="rm" aria-checked=${s.reduceMotion ? 'true' : 'false'} @click=${() => this.setSetting('reduceMotion', !s.reduceMotion)}></button></div>
      <div class="pair"><span>Density</span>
        <div class="seg" role="group" aria-label="Density">
          ${(['comfortable', 'compact'] as const).map(
            (d) => html`<button aria-pressed=${(s.density ?? 'comfortable') === d ? 'true' : 'false'} @click=${() => this.setSetting('density', d)}>${d[0].toUpperCase() + d.slice(1)}</button>`,
          )}
        </div></div>
      <div class="group label">Keys</div>
      <div class="keys">
        <kbd>\`</kbd><span>Open or close the shell (also Ctrl or ⌘ K)</span>
        <kbd>← →</kbd><span>Move along the arc</span>
        <kbd>Enter</kbd><span>Open</span>
        <kbd>x</kbd><span>Dismiss a notification</span>
        <kbd>Esc</kbd><span>Back, then close</span>
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
    return html`
      <div class="ground" part="ground">${this.background && this.background !== 'none' ? html`<ui-wave-background preset=${this.background}></ui-wave-background>` : nothing}</div>
      ${this.renderBand()}
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
      <div class="live" aria-live="polite">${this.isOpen ? `${cap.title}. ${cap.line}` : ''}</div>
    `;
  }
}

if (!customElements.get('ui-shell')) customElements.define('ui-shell', UiShell);

declare global {
  interface HTMLElementTagNameMap {
    'ui-shell': UiShell;
  }
}
