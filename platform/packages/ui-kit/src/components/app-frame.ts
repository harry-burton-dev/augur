import { LitElement, css, html } from 'lit';
import { base } from '../shared.js';

export type FrameMeasure = 'wide' | 'read' | 'full';

/**
 * An app's page: the one still slate ground every app stands on, an optional
 * rail of its sections, the main column, an optional aside beside it, and an
 * optional drawer at the right edge. The shell's bar stays the only bar, so
 * the frame has no header of its own; put a `ui-page-head` first in the main
 * column.
 *
 * Three columns, each with one job: the rail says where you can go, the main
 * column shows what's here (little text: what needs you, what's new, the
 * things themselves), and the drawer holds what you can do with it (actions,
 * filters, tags, settings). Set `screen` to the screen's id: when it changes,
 * the main column fades in and the drawer closes and opens again with the
 * new screen's actions, so the person sees both change together.
 *
 * With a rail, the main column sits beside it; without one, it's centred.
 * Below 960px the aside drops under the main column and the drawer under both.
 *
 * @slot rail - the app's sections (a `ui-tree`, a list of links) and at most one action
 * @slot - the main column
 * @slot aside - what sits beside the main column: line of sight, references, details
 * @slot drawer - what can be done with what's on screen: actions, filters, tags, settings
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
    turning: { type: Boolean, reflect: true },
  };

  /** How wide the main column (with its aside) may get: `wide` (default), `read`, or `full` for a graph or map. */
  declare measure: FrameMeasure;
  /** The page is loading or saving: the main column is marked busy and dims a little. */
  declare busy: boolean;
  /** What the rail is, for screen readers: "Libraries". */
  declare railLabel: string;
  /** What the drawer is, for screen readers: "Actions". */
  declare drawerLabel: string;
  /** Which screen is showing. A new value fades the main column in and closes and reopens the drawer. */
  declare screen: string;
  declare hasRail: boolean;
  declare hasAside: boolean;
  declare hasDrawer: boolean;
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
    this.turning = false;
  }

  static override styles = [
    base,
    css`
      :host { display: grid; grid-template-columns: minmax(0, 1fr); min-height: 100%; background: var(--slate); color: var(--ink); font-size: var(--type-body); line-height: var(--leading-body); }
      :host([has-rail]) { grid-template-columns: var(--measure-rail) minmax(0, 1fr); }
      :host([has-drawer]) { grid-template-columns: minmax(0, 1fr) var(--measure-drawer); }
      :host([has-rail][has-drawer]) { grid-template-columns: var(--measure-rail) minmax(0, 1fr) var(--measure-drawer); }
      nav { display: none; flex-direction: column; gap: var(--space-5); padding: var(--space-6) var(--space-3); border-right: 1px solid var(--hairline); overflow-y: auto; min-width: 0; }
      :host([has-rail]) nav { display: flex; }
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
      .drawer { display: none; min-width: 0; overflow: hidden; border-left: 1px solid var(--hairline); }
      :host([has-drawer]) .drawer { display: block; }
      .drawer-inner {
        display: flex; flex-direction: column; gap: var(--space-6); padding: var(--space-6) var(--space-5) var(--space-8);
        position: sticky; top: 0; max-height: 100vh; overflow-y: auto;
        transition: opacity var(--motion-slow) var(--ease-out), transform var(--motion-slow) var(--ease-out);
      }
      :host([turning]) .drawer-inner { opacity: 0; transform: translateX(var(--travel-near)); transition: none; }
      @media (prefers-reduced-motion: reduce) {
        :host([turning]) .drawer-inner { transform: none; }
      }
      @media (max-width: 960px) {
        :host([has-aside]) .page { grid-template-columns: minmax(0, 1fr); }
        :host([has-drawer]) { grid-template-columns: minmax(0, 1fr); }
        :host([has-rail][has-drawer]) { grid-template-columns: var(--measure-rail) minmax(0, 1fr); }
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

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.turn);
  }

  override render() {
    return html`<nav aria-label=${this.railLabel || 'Sections'} part="rail"><slot name="rail" @slotchange=${this.onSlot}></slot></nav>
      <main part="main" aria-busy=${this.busy ? 'true' : 'false'}>
        <div class="page">
          <div class="main"><slot></slot></div>
          <aside class=${this.hasAside ? 'on' : ''} part="aside"><slot name="aside" @slotchange=${this.onSlot}></slot></aside>
        </div>
      </main>
      <div class="drawer" role="complementary" aria-label=${this.drawerLabel || 'Actions'} part="drawer">
        <div class="drawer-inner"><slot name="drawer" @slotchange=${this.onSlot}></slot></div>
      </div>`;
  }
}

if (!customElements.get('ui-app-frame')) customElements.define('ui-app-frame', UiAppFrame);

declare global {
  interface HTMLElementTagNameMap {
    'ui-app-frame': UiAppFrame;
  }
}
