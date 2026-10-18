import { LitElement, css, html } from 'lit';
import { base, label } from '../shared.js';

export type Fact = { value: string | number; label: string };

/**
 * At most three values worth a glance: the value large and light, the label in
 * tracked capitals beneath. Extras are dropped. If it isn't worth a glance, it
 * isn't a fact; keep values short ("12", "2 hours", "92%").
 */
export class UiFacts extends LitElement {
  static override properties = {
    items: { type: Array },
    loading: { type: Boolean, reflect: true },
    count: { type: Number },
  };

  declare items: Fact[];
  declare loading: boolean;
  /** How many skeleton facts to show while loading, 1–3. */
  declare count: number;

  constructor() {
    super();
    this.items = [];
    this.loading = false;
    this.count = 3;
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; }
      dl { display: flex; flex-wrap: wrap; gap: var(--space-5) var(--space-7); margin: 0; }
      .fact { display: flex; flex-direction: column-reverse; }
      dd {
        margin: 0;
        font-size: var(--type-title-s);
        line-height: var(--leading-title-s);
        font-weight: 300;
        color: var(--ink);
        font-variant-numeric: tabular-nums;
      }
      dt { white-space: nowrap; margin-top: var(--space-1); }
      .bar {
        display: block;
        border-radius: var(--radius-pill);
        background: linear-gradient(90deg, color-mix(in srgb, var(--ink) 6%, transparent), color-mix(in srgb, var(--ink) 14%, transparent), color-mix(in srgb, var(--ink) 6%, transparent));
        background-size: 200% 100%;
        animation: skel var(--motion-shimmer) var(--ease-standard) infinite;
      }
      dd .bar { width: 56px; height: 20px; margin: 10px 0; }
      dt .bar { width: 40px; height: 8px; margin: 4px 0; }
      @keyframes skel { from { background-position: 100% 0; } to { background-position: -100% 0; } }
    `,
  ];

  override render() {
    if (this.loading) {
      const n = Math.min(3, Math.max(1, this.count || 3));
      return html`<dl aria-busy="true">${Array.from({ length: n }, () =>
        html`<div class="fact"><dt><span class="bar"></span></dt><dd><span class="bar"></span></dd></div>`)}</dl>`;
    }
    return html`<dl>${(this.items ?? []).slice(0, 3).map((f) =>
      html`<div class="fact" part="fact"><dt class="label">${f.label}</dt><dd>${f.value}</dd></div>`)}</dl>`;
  }
}

if (!customElements.get('ui-facts')) customElements.define('ui-facts', UiFacts);

declare global {
  interface HTMLElementTagNameMap {
    'ui-facts': UiFacts;
  }
}
