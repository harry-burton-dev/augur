import { LitElement, css, html } from 'lit';
import { base } from '../shared.js';

export type FrameMeasure = 'wide' | 'read' | 'full';

/**
 * An app's page: the one still slate ground every app stands on, an optional
 * rail of its sections, the main column and an optional aside beside it. The
 * shell's bar stays the only bar, so the frame has no header of its own; put
 * a `ui-page-head` first in the main column.
 *
 * With a rail, the main column sits beside it; without one, it's centred.
 * Below 960px the aside drops under the main column.
 *
 * @slot rail - the app's sections (a `ui-tree`, a list of links) and at most one action
 * @slot - the main column
 * @slot aside - what sits beside the main column: line of sight, references, details
 */
export class UiAppFrame extends LitElement {
  static override properties = {
    measure: { type: String, reflect: true },
    busy: { type: Boolean, reflect: true },
    railLabel: { type: String, attribute: 'rail-label' },
    hasRail: { type: Boolean, reflect: true, attribute: 'has-rail' },
    hasAside: { type: Boolean, reflect: true, attribute: 'has-aside' },
  };

  /** How wide the main column (with its aside) may get: `wide` (default), `read`, or `full` for a graph or map. */
  declare measure: FrameMeasure;
  /** The page is loading or saving: the main column is marked busy and dims a little. */
  declare busy: boolean;
  /** What the rail is, for screen readers: "Libraries". */
  declare railLabel: string;
  declare hasRail: boolean;
  declare hasAside: boolean;

  constructor() {
    super();
    this.measure = 'wide';
    this.busy = false;
    this.railLabel = '';
    this.hasRail = false;
    this.hasAside = false;
  }

  static override styles = [
    base,
    css`
      :host { display: grid; grid-template-columns: minmax(0, 1fr); min-height: 100%; background: var(--slate); color: var(--ink); font-size: var(--type-body); line-height: var(--leading-body); }
      :host([has-rail]) { grid-template-columns: var(--measure-rail) minmax(0, 1fr); }
      nav { display: none; flex-direction: column; gap: var(--space-5); padding: var(--space-6) var(--space-3); border-right: 1px solid var(--hairline); overflow-y: auto; min-width: 0; }
      :host([has-rail]) nav { display: flex; }
      main { min-width: 0; padding: var(--space-6) var(--edge) var(--space-8); }
      .page { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-7); align-items: start; max-width: var(--measure-wide); margin: 0 auto; transition: opacity var(--motion-base) var(--ease-standard); }
      :host([has-rail]) .page { margin: 0; }
      :host([has-aside]) .page { grid-template-columns: minmax(0, 1.6fr) minmax(240px, 1fr); }
      :host([measure='read']) .page { max-width: var(--measure-read); }
      :host([measure='read'][has-aside]) .page { max-width: calc(var(--measure-read) + var(--space-7) + 320px); }
      :host([measure='full']) .page { max-width: none; }
      :host([busy]) .page { opacity: 0.7; }
      .main, aside { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
      aside { gap: var(--space-6); }
      aside:not(.on) { display: none; }
      @media (max-width: 960px) {
        :host([has-aside]) .page { grid-template-columns: minmax(0, 1fr); }
      }
      @media (max-width: 720px) {
        :host([has-rail]) { grid-template-columns: minmax(0, 1fr); }
        nav { border-right: 0; border-bottom: 1px solid var(--hairline); padding: var(--space-4) var(--edge-tight); }
        main { padding-inline: var(--edge-tight); }
      }
    `,
  ];

  private onSlot() {
    const slots = [...this.children].map((c) => c.getAttribute('slot'));
    this.hasRail = slots.includes('rail');
    this.hasAside = slots.includes('aside');
  }

  override firstUpdated() {
    this.onSlot();
  }

  override render() {
    return html`<nav aria-label=${this.railLabel || 'Sections'} part="rail"><slot name="rail" @slotchange=${this.onSlot}></slot></nav>
      <main part="main" aria-busy=${this.busy ? 'true' : 'false'}>
        <div class="page">
          <div class="main"><slot></slot></div>
          <aside class=${this.hasAside ? 'on' : ''} part="aside"><slot name="aside" @slotchange=${this.onSlot}></slot></aside>
        </div>
      </main>`;
  }
}

if (!customElements.get('ui-app-frame')) customElements.define('ui-app-frame', UiAppFrame);

declare global {
  interface HTMLElementTagNameMap {
    'ui-app-frame': UiAppFrame;
  }
}
