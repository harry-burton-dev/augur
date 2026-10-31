import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import './button.js';

/**
 * A part of a page: a label in tracked capitals with its count, one quiet
 * action, and an optional "Why?". It shows the first few of its children and
 * folds the rest behind "8 more", so a page never opens on a wall of rows.
 *
 * The count is the number of children unless `count` says otherwise (a list
 * inside it, or a total the app knows).
 *
 * @slot - the things in it, one element each; or one element (a `ui-list`, `ui-cards`) that does its own counting
 * @fires ui-action - its action was pressed
 */
export class UiSection extends LitElement {
  static override properties = {
    label: { type: String },
    count: { type: Number },
    limit: { type: Number },
    action: { type: String },
    why: { type: String },
    level: { type: Number },
    children$: { state: true },
    open: { state: true },
    whyOpen: { state: true },
  };

  declare label: string;
  /** How many there are; left out, the children are counted. Set to -1 to show no count. */
  declare count: number | undefined;
  /** How many children show before the rest fold away; 0 shows them all. */
  declare limit: number;
  /** One quiet action, as a word or two: "Bind", "Sort by risk". */
  declare action: string;
  /** Why this section is as it is, up to two sentences, behind a "Why?". */
  declare why: string;
  declare level: number;
  declare children$: number;
  declare open: boolean;
  declare whyOpen: boolean;

  private fold = document.createElement('style');

  constructor() {
    super();
    this.label = '';
    this.count = undefined;
    this.limit = 5;
    this.action = '';
    this.why = '';
    this.level = 2;
    this.children$ = 0;
    this.open = false;
    this.whyOpen = false;
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
      .head { display: flex; align-items: baseline; gap: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--hairline); }
      .head .label { margin: 0; flex: 1; min-width: 0; }
      .head b { color: var(--ink); font-weight: 400; margin-right: 0.5em; font-variant-numeric: tabular-nums; }
      .why { margin: 0; max-width: var(--measure-prose); padding: var(--space-3) var(--space-4); border-radius: var(--radius-inset); background: var(--surface-inset); font-size: var(--type-meta); line-height: var(--leading-meta); }
      .more { all: unset; align-self: flex-start; cursor: pointer; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); border-radius: var(--radius-key); padding: 2px 0; }
      .more:hover { color: var(--ink); }
      .more:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .body { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
    `,
  ];

  override firstUpdated() {
    this.shadowRoot!.appendChild(this.fold);
    this.counted();
  }

  private counted() {
    this.children$ = [...this.children].filter((c) => !c.hasAttribute('slot')).length;
  }

  override updated() {
    const folding = this.limit > 0 && !this.open && this.children$ > this.limit;
    this.fold.textContent = folding ? `::slotted(:nth-child(n+${this.limit + 1})) { display: none !important; }` : '';
  }

  override render() {
    const n = this.count ?? (this.children$ > 1 ? this.children$ : undefined);
    const hidden = this.limit > 0 && this.children$ > this.limit ? this.children$ - this.limit : 0;
    const level = Math.min(6, Math.max(1, this.level || 2));
    const emit = () => this.dispatchEvent(new CustomEvent('ui-action', { bubbles: true, composed: true }));
    return html`<div class="head">
        <div class="label" role="heading" aria-level=${level}>${n !== undefined && n >= 0 ? html`<b>${n}</b>` : nothing}${this.label}</div>
        ${this.why ? html`<ui-button kind="tertiary" size="sm" aria-expanded=${this.whyOpen ? 'true' : 'false'} @click=${() => (this.whyOpen = !this.whyOpen)}>Why?</ui-button>` : nothing}
        ${this.action ? html`<ui-button kind="tertiary" size="sm" @click=${emit}>${this.action}</ui-button>` : nothing}
      </div>
      ${this.why && this.whyOpen ? html`<p class="why">${this.why}</p>` : nothing}
      <div class="body"><slot @slotchange=${this.counted}></slot></div>
      ${hidden ? html`<button class="more" aria-expanded=${this.open ? 'true' : 'false'} @click=${() => (this.open = !this.open)}>${this.open ? 'Show fewer' : `${hidden} more`}</button>` : nothing}`;
  }
}

if (!customElements.get('ui-section')) customElements.define('ui-section', UiSection);

declare global {
  interface HTMLElementTagNameMap {
    'ui-section': UiSection;
  }
}
