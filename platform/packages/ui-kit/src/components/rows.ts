import { LitElement, css, html } from 'lit';
import { base } from '../shared.js';

export type Row = { label: string; value: string };

/**
 * Up to five lines of simple information: a label, and its value quiet on the
 * right, divided by hairlines. Rows are for looking; a row that needs its own
 * action means the primary action is wrong.
 */
export class UiRows extends LitElement {
  static override properties = {
    items: { type: Array },
    loading: { type: Boolean, reflect: true },
    count: { type: Number },
    empty: { type: String },
    error: { type: String },
  };

  declare items: Row[];
  declare loading: boolean;
  /** How many skeleton rows to show while loading, 1–5. */
  declare count: number;
  /** Said in place of the rows when there are none ("No sources yet."). */
  declare empty: string;
  /** Said as a red line in place of the rows when they couldn't load. */
  declare error: string;

  constructor() {
    super();
    this.items = [];
    this.loading = false;
    this.count = 3;
    this.empty = '';
    this.error = '';
  }

  static override styles = [
    base,
    css`
      :host { display: block; }
      ul { list-style: none; margin: 0; padding: 0; }
      li {
        display: flex;
        justify-content: space-between;
        gap: var(--space-5);
        padding: var(--space-3) 0;
        font-size: var(--type-meta);
        line-height: var(--leading-meta);
        border-bottom: 1px solid var(--hairline);
      }
      li:last-child { border-bottom: 0; }
      li span:last-child { color: var(--ink-muted); white-space: nowrap; }
      li.state { justify-content: flex-start; align-items: center; gap: var(--space-2); color: var(--ink-muted); border-bottom: 0; }
      li.error { color: var(--danger); }
      li.error::before {
        content: '';
        width: 8px;
        height: 8px;
        flex: none;
        border: 1.5px solid currentColor;
        border-radius: 1px;
        transform: rotate(45deg);
      }
      .bar {
        display: block;
        height: 10px;
        margin: 5px 0;
        border-radius: var(--radius-pill);
        background: linear-gradient(90deg, color-mix(in srgb, var(--ink) 6%, transparent), color-mix(in srgb, var(--ink) 14%, transparent), color-mix(in srgb, var(--ink) 6%, transparent));
        background-size: 200% 100%;
        animation: skel var(--motion-shimmer) var(--ease-standard) infinite;
      }
      li .bar:first-child { width: 40%; }
      li .bar:last-child { width: 18%; }
      @keyframes skel { from { background-position: 100% 0; } to { background-position: -100% 0; } }
    `,
  ];

  override render() {
    if (this.loading) {
      const n = Math.min(5, Math.max(1, this.count || 3));
      return html`<ul aria-busy="true">${Array.from({ length: n }, () => html`<li><span class="bar"></span><span class="bar"></span></li>`)}</ul>`;
    }
    if (this.error) return html`<ul><li class="state error" role="alert">${this.error}</li></ul>`;
    const items = (this.items ?? []).slice(0, 5);
    if (!items.length && this.empty) return html`<ul><li class="state">${this.empty}</li></ul>`;
    return html`<ul>${items.map((r) => html`<li part="row"><span>${r.label}</span><span>${r.value}</span></li>`)}</ul>`;
  }
}

if (!customElements.get('ui-rows')) customElements.define('ui-rows', UiRows);

declare global {
  interface HTMLElementTagNameMap {
    'ui-rows': UiRows;
  }
}
