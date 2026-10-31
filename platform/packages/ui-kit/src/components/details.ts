import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { base } from '../shared.js';

/** One property of the thing that's open. */
export interface Detail {
  label: string;
  /** Left empty, it says the `missing` words instead of leaving a gap. */
  value?: string | number | TemplateResult;
  /** One quiet word after the value: "identity key", "disputed". */
  note?: string;
  /** The one someone asked about (why it shows here): marked so it's found. */
  explained?: boolean;
}

/**
 * The properties of one thing you've opened, as label and value. A value
 * that isn't known says so rather than leaving a gap. Eight show; the rest
 * fold behind "4 more details". For a five-line glance with values on the
 * right, use `ui-rows`.
 */
export class UiDetails extends LitElement {
  static override properties = {
    items: { attribute: false },
    limit: { type: Number },
    missing: { type: String },
    open: { state: true },
  };

  declare items: Detail[];
  /** How many show before the rest fold; 0 shows them all. */
  declare limit: number;
  declare missing: string;
  declare open: boolean;

  constructor() {
    super();
    this.items = [];
    this.limit = 8;
    this.missing = 'Not known';
    this.open = false;
  }

  static override styles = [
    base,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-3); }
      dl { margin: 0; display: grid; grid-template-columns: minmax(7rem, max-content) minmax(0, 1fr); gap: var(--space-2) var(--space-5); font-size: var(--type-meta); line-height: var(--leading-meta); }
      dt { color: var(--ink-muted); }
      dd { margin: 0; min-width: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      dd small { margin-left: var(--space-2); font-size: var(--type-small); color: var(--ink-muted); }
      dd.missing { color: var(--ink-muted); }
      dd.explained { box-shadow: inset 2px 0 0 var(--green); padding-left: var(--space-3); }
      @media (max-width: 480px) { dl { grid-template-columns: minmax(0, 1fr); gap: 0; } dd { margin-bottom: var(--space-2); } }
      button { all: unset; align-self: flex-start; cursor: pointer; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); border-radius: var(--radius-key); }
      button:hover { color: var(--ink); }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
    `,
  ];

  override render() {
    const folds = this.limit > 0 && this.items.length > this.limit;
    const shown = folds && !this.open ? this.items.slice(0, this.limit) : this.items;
    const empty = (v: Detail['value']) => v === undefined || v === null || v === '';
    return html`<dl>
        ${shown.map(
          (d) => html`<dt>${d.label}</dt>
            <dd class=${[empty(d.value) ? 'missing' : '', d.explained ? 'explained' : ''].join(' ')}>${empty(d.value) ? this.missing : d.value}${d.note ? html`<small>${d.note}</small>` : nothing}</dd>`,
        )}
      </dl>
      ${folds
        ? html`<button aria-expanded=${this.open ? 'true' : 'false'} @click=${() => (this.open = !this.open)}>${this.open ? 'Fewer details' : `${this.items.length - this.limit} more ${this.items.length - this.limit === 1 ? 'detail' : 'details'}`}</button>`
        : nothing}`;
  }
}

if (!customElements.get('ui-details')) customElements.define('ui-details', UiDetails);

declare global {
  interface HTMLElementTagNameMap {
    'ui-details': UiDetails;
  }
}
