import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';

/**
 * A word something is filed under, as a small pill: on a row, in a picker, or
 * as a filter that's on. With `removable` it carries its own ×, which says
 * what it takes away to a screen reader.
 *
 * @fires ui-remove - its × was pressed
 */
export class UiTag extends LitElement {
  static override properties = {
    label: { type: String },
    icon: { type: String },
    removable: { type: Boolean, reflect: true },
    removeLabel: { type: String, attribute: 'remove-label' },
    quiet: { type: Boolean, reflect: true },
  };

  declare label: string;
  /** A kit icon before the word, such as `org` for one of the org's own. */
  declare icon: string;
  declare removable: boolean;
  /** What the × says it removes, when the label alone isn't enough: "Tag: Finance". */
  declare removeLabel: string;
  /** No line round it: for a row's list of tags, where many sit together. */
  declare quiet: boolean;

  constructor() {
    super();
    this.label = '';
    this.icon = '';
    this.removable = false;
    this.removeLabel = '';
    this.quiet = false;
  }

  /** Puts focus on its ×, when it has one. */
  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector<HTMLButtonElement>('button')?.focus(options);
  }

  static override styles = [
    base,
    css`
      :host { display: inline-flex; max-width: 100%; vertical-align: middle; }
      .tag {
        display: inline-flex; align-items: center; gap: var(--space-1); min-width: 0; min-height: 24px;
        padding: 0 var(--space-2); border: 1px solid var(--hairline-strong); border-radius: var(--radius-pill);
        color: var(--ink); font-size: var(--type-small); line-height: var(--leading-small); white-space: nowrap;
      }
      :host([quiet]) .tag { border-color: transparent; background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink-muted); }
      :host([removable]) .tag { padding-right: 2px; }
      .word { overflow: hidden; text-overflow: ellipsis; }
      ui-icon { color: var(--ink-muted); }
      button {
        all: unset; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
        border-radius: 50%; color: var(--ink-muted); cursor: pointer;
      }
      button:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 10%, transparent); }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 1px; }
    `,
  ];

  override render() {
    return html`<span class="tag">
      ${this.icon ? html`<ui-icon name=${this.icon} size="12"></ui-icon>` : nothing}
      <span class="word">${this.label}</span>
      ${this.removable
        ? html`<button type="button" aria-label=${`Remove ${this.removeLabel || this.label}`} @click=${() => this.dispatchEvent(new CustomEvent('ui-remove', { bubbles: true, composed: true }))}>
            <ui-icon name="close" size="12"></ui-icon>
          </button>`
        : nothing}
    </span>`;
  }
}

if (!customElements.get('ui-tag')) customElements.define('ui-tag', UiTag);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tag': UiTag;
  }
}
