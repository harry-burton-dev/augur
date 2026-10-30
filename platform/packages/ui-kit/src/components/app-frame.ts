import { LitElement, css, html } from 'lit';
import { base } from '../shared.js';
import './icon.js';

export type FrameMeasure = 'wide' | 'read' | 'full';

/** Where the person's choice to keep the rail or the drawer closed is remembered, on this device. */
const KEPT = { rail: 'ui-app-frame:rail-closed', drawer: 'ui-app-frame:drawer-closed' };

const remembered = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

const remember = (key: string, closed: boolean) => {
  try {
    localStorage.setItem(key, closed ? '1' : '0');
  } catch {
    // Private windows and blocked storage: the choice lasts until the page closes.
  }
};

/**
 * An app's page: the one still slate ground every app stands on, an optional
 * rail of its sections, the main column, an optional aside beside it, and an
 * optional drawer at the right edge. The shell's bar stays the only bar, so
 * the frame has no header of its own.
 *
 * Three columns, each with one job: the rail says where you can go, the main
 * column shows what's here (little text: what needs you, what's new, the
 * things themselves), and the drawer says more about what's here. Set
 * `screen` to the screen's id: when it changes, the main column fades in and
 * the drawer closes and opens again with the new screen's content, so the
 * person sees both change together.
 *
 * The rail and the drawer each fold away to a thin strip with a button to
 * open them again; the frame remembers that on this device. Whenever the
 * drawer opens, closes or goes, the frame fires `ui-drawer` on the window with
 * the width it takes, so the shell keeps its floor gauge just left of it.
 *
 * Below 960px the aside drops under the main column and the drawer under both.
 *
 * @slot rail - the app's sections (a `ui-tree`, a list of links) and at most one action
 * @slot - the main column
 * @slot aside - what sits beside the main column: line of sight, references, details
 * @slot drawer - more about what's on screen: its details, what's inside it
 * @fires ui-drawer - on the window, detail `{ inset }`: how many pixels of the right edge the drawer takes, 0 when there's none
 */
export class UiAppFrame extends LitElement {
  static override properties = {
    measure: { type: String, reflect: true },
    busy: { type: Boolean, reflect: true },
    railLabel: { type: String, attribute: 'rail-label' },
    drawerLabel: { type: String, attribute: 'drawer-label' },
    screen: { type: String },
    hasRail: { type: Boolean, reflect: true, attribute: 'has-rail' },
    hasAside: { type: Boolean, reflect: true, attribute: 'has-aside' },
    hasDrawer: { type: Boolean, reflect: true, attribute: 'has-drawer' },
    railClosed: { type: Boolean, reflect: true, attribute: 'rail-closed' },
    drawerClosed: { type: Boolean, reflect: true, attribute: 'drawer-closed' },
    turning: { type: Boolean, reflect: true },
  };

  /** How wide the main column (with its aside) may get: `wide` (default), `read`, or `full` for a graph or map. */
  declare measure: FrameMeasure;
  /** The page is loading or saving: the main column is marked busy and dims a little. */
  declare busy: boolean;
  /** What the rail is, for screen readers: "Libraries". */
  declare railLabel: string;
  /** What the drawer is, for screen readers: "Details". */
  declare drawerLabel: string;
  /** Which screen is showing. A new value fades the main column in and closes and reopens the drawer. */
  declare screen: string;
  declare hasRail: boolean;
  declare hasAside: boolean;
  declare hasDrawer: boolean;
  /** The rail is folded away to a strip. */
  declare railClosed: boolean;
  /** The drawer is folded away to a strip. */
  declare drawerClosed: boolean;
  /** Between screens: the drawer is closed and the main column is about to fade in. */
  declare turning: boolean;

  private turn?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this.measure = 'wide';
    this.busy = false;
    this.railLabel = '';
    this.drawerLabel = '';
    this.screen = '';
    this.hasRail = false;
    this.hasAside = false;
    this.hasDrawer = false;
    this.railClosed = remembered(KEPT.rail);
    this.drawerClosed = remembered(KEPT.drawer);
    this.turning = false;
  }

  static override styles = [
    base,
    css`
      :host {
        --rail: var(--measure-rail);
        --drawer: var(--measure-drawer);
        --strip: 44px;
        display: grid; grid-template-columns: minmax(0, 1fr); min-height: 100%; background: var(--slate); color: var(--ink); font-size: var(--type-body); line-height: var(--leading-body);
        transition: grid-template-columns var(--motion-slow) var(--ease-out);
      }
      :host([rail-closed]) { --rail: var(--strip); }
      :host([drawer-closed]) { --drawer: var(--strip); }
      :host([has-rail]) { grid-template-columns: var(--rail) minmax(0, 1fr); }
      :host([has-drawer]) { grid-template-columns: minmax(0, 1fr) var(--drawer); }
      :host([has-rail][has-drawer]) { grid-template-columns: var(--rail) minmax(0, 1fr) var(--drawer); }
      nav { display: none; position: relative; flex-direction: column; gap: var(--space-5); padding: var(--space-6) var(--space-3); border-right: 1px solid var(--hairline); overflow: hidden auto; min-width: 0; }
      :host([has-rail]) nav { display: flex; }
      .rail-body, .drawer-body { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; transition: opacity var(--motion-base) var(--ease-out); }
      :host([rail-closed]) .rail-body, :host([drawer-closed]) .drawer-body { opacity: 0; visibility: hidden; pointer-events: none; }
      .fold {
        all: unset; box-sizing: border-box; display: grid; place-items: center; width: 28px; height: 28px; flex: none; cursor: pointer;
        border-radius: var(--radius-key); color: var(--ink-muted); transition: color var(--motion-instant) var(--ease-standard), background var(--motion-instant) var(--ease-standard);
      }
      .fold:hover { color: var(--ink); background: var(--surface-pane); }
      .fold:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      nav .fold { position: absolute; top: var(--space-4); right: var(--space-2); z-index: 1; }
      :host([rail-closed]) nav { padding-inline: 0; }
      :host([rail-closed]) nav .fold { right: 8px; }
      main { min-width: 0; padding: var(--space-6) var(--edge) var(--space-8); }
      .page { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-7); align-items: start; max-width: var(--measure-wide); margin: 0 auto; transition: opacity var(--motion-slow) var(--ease-out); }
      :host([has-rail]) .page { margin: 0; }
      :host([has-aside]) .page { grid-template-columns: minmax(0, 1.6fr) minmax(240px, 1fr); }
      :host([measure='read']) .page { max-width: var(--measure-read); }
      :host([measure='read'][has-aside]) .page { max-width: calc(var(--measure-read) + var(--space-7) + 320px); }
      :host([measure='full']) .page { max-width: none; }
      :host([busy]) .page { opacity: 0.7; }
      :host([turning]) .page { opacity: 0; transition: none; }
      .main, aside { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
      aside { gap: var(--space-6); }
      aside:not(.on) { display: none; }
      .drawer { display: none; position: relative; min-width: 0; overflow: hidden; border-left: 1px solid var(--hairline); }
      :host([has-drawer]) .drawer { display: block; }
      .drawer .fold { position: absolute; top: var(--space-4); left: 8px; z-index: 1; }
      .drawer-inner {
        position: sticky; top: 0; max-height: 100vh; overflow-y: auto; padding: calc(var(--space-6) + 28px) var(--space-5) var(--space-8);
        transition: opacity var(--motion-slow) var(--ease-out), transform var(--motion-slow) var(--ease-out);
      }
      :host([turning]) .drawer-inner { opacity: 0; transform: translateX(var(--travel-near)); transition: none; }
      @media (prefers-reduced-motion: reduce) {
        :host { transition: none; }
        :host([turning]) .drawer-inner { transform: none; }
      }
      @media (max-width: 960px) {
        :host([has-aside]) .page { grid-template-columns: minmax(0, 1fr); }
        :host([has-drawer]) { grid-template-columns: minmax(0, 1fr); }
        :host([has-rail][has-drawer]) { grid-template-columns: var(--rail) minmax(0, 1fr); }
        .drawer { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--hairline); }
        .drawer-inner { position: static; max-height: none; }
      }
      @media (max-width: 720px) {
        :host([has-rail]), :host([has-rail][has-drawer]) { grid-template-columns: minmax(0, 1fr); }
        nav { border-right: 0; border-bottom: 1px solid var(--hairline); padding: var(--space-4) var(--edge-tight); }
        main { padding-inline: var(--edge-tight); }
      }
    `,
  ];

  private onSlot() {
    const slots = [...this.children].map((c) => c.getAttribute('slot'));
    this.hasRail = slots.includes('rail');
    this.hasAside = slots.includes('aside');
    this.hasDrawer = slots.includes('drawer');
  }

  override firstUpdated() {
    this.onSlot();
  }

  override willUpdate(changed: Map<string, unknown>) {
    // The first screen just appears; each one after it turns: out at once, then back in on the next frame.
    if (changed.has('screen') && this.hasUpdated && changed.get('screen') !== this.screen) {
      this.turning = true;
      clearTimeout(this.turn);
      this.turn = setTimeout(() => (this.turning = false), 40);
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('hasDrawer') || changed.has('drawerClosed')) this.tellDrawer();
  }

  /** Says, on the window, how much of the right edge the drawer takes, for the shell to keep its floor gauge clear of. */
  private tellDrawer(inset = this.drawerInset()) {
    window.dispatchEvent(new CustomEvent('ui-drawer', { detail: { inset } }));
  }

  private drawerInset() {
    if (!this.hasDrawer || !window.matchMedia('(min-width: 961px)').matches) return 0;
    const css = getComputedStyle(this);
    return parseFloat(css.getPropertyValue(this.drawerClosed ? '--strip' : '--measure-drawer')) || (this.drawerClosed ? 44 : 320);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.turn);
    // Gone with the app: the shell has the whole edge back.
    this.tellDrawer(0);
  }

  private fold(which: 'rail' | 'drawer') {
    if (which === 'rail') remember(KEPT.rail, (this.railClosed = !this.railClosed));
    else remember(KEPT.drawer, (this.drawerClosed = !this.drawerClosed));
  }

  override render() {
    const rail = this.railLabel || 'Sections';
    const drawer = this.drawerLabel || 'Details';
    return html`<nav aria-label=${rail} part="rail">
        <button class="fold" aria-expanded=${this.railClosed ? 'false' : 'true'} aria-label=${this.railClosed ? `Show ${rail}` : `Hide ${rail}`} title=${this.railClosed ? `Show ${rail}` : `Hide ${rail}`} @click=${() => this.fold('rail')}>
          <ui-icon name=${this.railClosed ? 'rail-open' : 'rail-close'} size="16" aria-hidden="true"></ui-icon>
        </button>
        <div class="rail-body"><slot name="rail" @slotchange=${this.onSlot}></slot></div>
      </nav>
      <main part="main" aria-busy=${this.busy ? 'true' : 'false'}>
        <div class="page">
          <div class="main"><slot></slot></div>
          <aside class=${this.hasAside ? 'on' : ''} part="aside"><slot name="aside" @slotchange=${this.onSlot}></slot></aside>
        </div>
      </main>
      <div class="drawer" role="complementary" aria-label=${drawer} part="drawer">
        <button class="fold" aria-expanded=${this.drawerClosed ? 'false' : 'true'} aria-label=${this.drawerClosed ? `Show ${drawer}` : `Hide ${drawer}`} title=${this.drawerClosed ? `Show ${drawer}` : `Hide ${drawer}`} @click=${() => this.fold('drawer')}>
          <ui-icon name=${this.drawerClosed ? 'drawer-open' : 'drawer-close'} size="16" aria-hidden="true"></ui-icon>
        </button>
        <div class="drawer-inner"><div class="drawer-body"><slot name="drawer" @slotchange=${this.onSlot}></slot></div></div>
      </div>`;
  }
}

if (!customElements.get('ui-app-frame')) customElements.define('ui-app-frame', UiAppFrame);

declare global {
  interface HTMLElementTagNameMap {
    'ui-app-frame': UiAppFrame;
  }
}
