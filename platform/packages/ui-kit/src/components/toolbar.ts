import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';

/**
 * The one row above a grid or list: search on the left, then the filters and
 * sort (a `ui-filter-bar` in the default slot), then the screen's one way to
 * add something at the end. Nothing else goes in it; an object's own actions
 * are in its `ui-radial-menu`.
 *
 * The search narrows as the person types. The add button shows only when
 * `add` names what it adds ("Add files", "New collection").
 *
 * @slot - the filters and sort: a `ui-filter-bar`
 * @fires ui-search - detail `{ query }`, as the person types
 * @fires ui-add - the add button was pressed
 */
export class UiToolbar extends LitElement {
  static override properties = {
    label: { type: String },
    query: { type: String },
    add: { type: String },
  };

  /** What the search looks through, for screen readers and the placeholder: "Search Policy & Guidance". */
  declare label: string;
  declare query: string;
  /** The add button's words; without them there's no add button. */
  declare add: string;

  constructor() {
    super();
    this.label = 'Search';
    this.query = '';
    this.add = '';
  }

  static override styles = [
    base,
    css`
      :host { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); min-width: 0; }
      .search { position: relative; flex: 0 1 280px; min-width: 180px; }
      .search ui-icon { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--ink-muted); pointer-events: none; }
      input {
        all: unset; box-sizing: border-box; width: 100%; height: 36px; padding: 0 var(--space-3) 0 calc(var(--space-3) + 22px);
        border: 1px solid var(--hairline); border-radius: var(--radius-pill, 999px); background: var(--surface-pane); color: var(--ink); font-size: var(--type-small);
        transition: border-color var(--motion-instant) var(--ease-standard);
      }
      input::placeholder { color: var(--ink-muted); }
      input:hover { border-color: var(--hairline-strong); }
      input:focus-visible { border-color: var(--focus); outline: none; }
      .filters { flex: 1 1 auto; min-width: 0; }
      .add {
        all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: var(--space-2); height: 36px; padding: 0 var(--space-4); cursor: pointer;
        border-radius: var(--radius-pill, 999px); background: var(--green); color: var(--slate-deep); font-size: var(--type-small); font-weight: 500;
        transition: filter var(--motion-instant) var(--ease-standard);
      }
      .add:hover { filter: brightness(1.08); }
      .add:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
    `,
  ];

  override render() {
    return html`<div class="search" role="search">
        <ui-icon name="find" size="14" aria-hidden="true"></ui-icon>
        <input type="search" aria-label=${this.label} placeholder=${this.label} .value=${this.query}
          @input=${(e: Event) => {
            this.query = (e.target as HTMLInputElement).value;
            this.dispatchEvent(new CustomEvent('ui-search', { detail: { query: this.query.trim() }, bubbles: true, composed: true }));
          }} />
      </div>
      <div class="filters"><slot></slot></div>
      ${this.add
        ? html`<button class="add" @click=${() => this.dispatchEvent(new CustomEvent('ui-add', { bubbles: true, composed: true }))}><ui-icon name="plus" size="14" aria-hidden="true"></ui-icon>${this.add}</button>`
        : nothing}`;
  }
}

if (!customElements.get('ui-toolbar')) customElements.define('ui-toolbar', UiToolbar);

declare global {
  interface HTMLElementTagNameMap {
    'ui-toolbar': UiToolbar;
  }
}
