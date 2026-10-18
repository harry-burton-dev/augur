import { LitElement, css, html } from 'lit';
import { base } from '../shared.js';

const cap = css`
  .key {
    display: inline-block;
    padding: 0 var(--space-1);
    border: 1px solid color-mix(in srgb, var(--ink-muted) 40%, transparent);
    border-radius: var(--radius-key);
    font-size: var(--type-label);
    line-height: var(--leading-label);
    color: var(--ink-muted);
    white-space: nowrap;
  }
`;

/**
 * A key shown as a small outlined cap, for hints ("Esc", "Enter", "/"). Show
 * keys only where they teach something.
 *
 * @slot - the key, when `label` isn't set
 */
export class UiKeycap extends LitElement {
  static override properties = { label: { type: String } };

  declare label: string;

  constructor() {
    super();
    this.label = '';
  }

  static override styles = [base, cap, css`:host { display: inline-block; }`];

  override render() {
    return html`<kbd class="key" part="key">${this.label || html`<slot></slot>`}</kbd>`;
  }
}

/**
 * The way back: "Esc Back", bottom centre. It always means the same as Esc, so
 * whoever places it also closes on Esc.
 *
 * @fires click - when pressed
 */
export class UiBack extends LitElement {
  static override properties = { label: { type: String } };

  declare label: string;

  constructor() {
    super();
    this.label = 'Back';
  }

  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector('button')?.focus(options);
  }

  static override styles = [
    base,
    cap,
    css`
      :host { display: inline-block; }
      button {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) 2px;
        border: 0;
        border-radius: var(--radius-key);
        background: none;
        font: inherit;
        font-size: var(--type-small);
        line-height: var(--leading-small);
        color: var(--ink-muted);
        cursor: pointer;
      }
      button:hover { color: var(--ink); }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 4px; }
    `,
  ];

  override render() {
    return html`<button part="button" type="button" aria-keyshortcuts="Escape"><kbd class="key" aria-hidden="true">Esc</kbd>${this.label}</button>`;
  }
}

if (!customElements.get('ui-keycap')) customElements.define('ui-keycap', UiKeycap);
if (!customElements.get('ui-back')) customElements.define('ui-back', UiBack);

declare global {
  interface HTMLElementTagNameMap {
    'ui-keycap': UiKeycap;
    'ui-back': UiBack;
  }
}
