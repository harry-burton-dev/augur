import { LitElement, css, html } from 'lit';
import { base } from '../shared.js';
import { animate, motionMode, tokenEasing, tokenValue } from '../motion.js';

export type SurfaceKind = 'pane' | 'raised' | 'inset' | 'overlay' | 'bar' | 'veil';

/** Surfaces on the page, and when each arrived, so an arriving screen's can settle in. */
const live = new Map<UiSurface, number>();
let settleUntil = 0;
let settled = 0;

/**
 * An app is arriving: its surfaces fade up one after another, a step of
 * `motion-instant` apart, those already drawn in the last `within` ms and any
 * drawn over the next `within` ms. Apps built on the kit get this without
 * doing anything. The shell calls it as an app arrives.
 */
export function settleSurfaces(within: number) {
  const now = performance.now();
  settleUntil = now + within;
  settled = 0;
  for (const [surface, at] of live) if (now - at <= within) surface.settleIn();
}

/**
 * The flat planes things sit on, stacked in one order only:
 * ground → pane → raised or inset → overlay. Elevation is translucency and blur,
 * not colour; panes are flat and shadows start at raised.
 *
 * @slot - the content
 */
export class UiSurface extends LitElement {
  static override properties = {
    kind: { type: String, reflect: true },
    pad: { type: Boolean, reflect: true },
  };

  declare kind: SurfaceKind;
  declare pad: boolean;

  constructor() {
    super();
    this.kind = 'pane';
    this.pad = false;
  }

  override connectedCallback() {
    super.connectedCallback();
    live.set(this, performance.now());
    if (performance.now() < settleUntil) this.settleIn();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    live.delete(this);
  }

  /** Fade up into place, in turn with the arriving screen's other surfaces. Bars and veils are chrome and stay put. */
  settleIn() {
    if (this.kind === 'bar' || this.kind === 'veil') return;
    const step = tokenValue('motion-instant', 80);
    const rise = motionMode() === 'reduce' ? 'none' : `translateY(${tokenValue('travel-near', 24) / 3}px)`;
    void animate(this, [{ opacity: 0, transform: rise }, { opacity: 1, transform: 'none' }], {
      duration: tokenValue('motion-slow', 320),
      delay: Math.min(settled++, 8) * step,
      easing: tokenEasing('ease-out'),
      fill: 'backwards',
    });
  }

  static override styles = [
    base,
    css`
      :host { display: block; position: relative; color: var(--ink); }
      :host([pad]) { padding: var(--space-6); }
      :host([kind='pane']) {
        background: var(--surface-pane);
        backdrop-filter: blur(var(--surface-blur)) saturate(1.2);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-card);
      }
      :host([kind='raised']),
      :host([kind='overlay']) {
        backdrop-filter: blur(22px) saturate(1.25);
        border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
        border-radius: var(--radius-card);
      }
      :host([kind='raised']) {
        background: var(--surface-raised);
        box-shadow: var(--shadow-raised), inset 0 1px 0 color-mix(in srgb, var(--light) 6%, transparent);
      }
      :host([kind='overlay']) {
        background: var(--surface-overlay);
        box-shadow: var(--shadow-overlay), inset 0 1px 0 color-mix(in srgb, var(--light) 6%, transparent);
      }
      :host([kind='inset']) { background: var(--surface-inset); border-radius: var(--radius-inset); }
      :host([kind='bar']) { background: var(--surface-bar); }
      :host([kind='veil']) {
        background: radial-gradient(
          ellipse 60% 60% at 50% 50%,
          color-mix(in srgb, var(--slate-deep) 35%, transparent),
          var(--veil)
        );
      }
    `,
  ];

  override render() {
    return html`<slot></slot>`;
  }
}

if (!customElements.get('ui-surface')) customElements.define('ui-surface', UiSurface);

declare global {
  interface HTMLElementTagNameMap {
    'ui-surface': UiSurface;
  }
}
