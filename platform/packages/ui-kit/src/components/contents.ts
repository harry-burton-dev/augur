import { LitElement, css, html } from 'lit';
import { base, label } from '../shared.js';
import type { OutlineItem } from './reader.js';

/**
 * A document's contents: its headings as links, indented by level, with the
 * one being read marked. Beside a `ui-reader`, from its `ui-outline`.
 *
 * @fires ui-select - a heading was chosen, detail `{ id }`
 */
export class UiContents extends LitElement {
  static override properties = {
    heading: { type: String },
    items: { attribute: false },
    current: { type: String },
  };

  declare heading: string;
  declare items: OutlineItem[];
  /** The heading being read now. */
  declare current: string;

  constructor() {
    super();
    this.heading = 'Contents';
    this.items = [];
    this.current = '';
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; }
      nav { display: flex; flex-direction: column; gap: var(--space-2); }
      ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      a {
        display: block; padding: var(--space-1) var(--space-2); border-left: 2px solid transparent;
        color: var(--ink-muted); text-decoration: none; font-size: var(--type-meta); line-height: var(--leading-meta);
        transition: color var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard);
      }
      a:hover { color: var(--ink); }
      a:focus-visible { outline: 1.5px solid var(--focus); outline-offset: -1.5px; border-radius: 2px; }
      a[aria-current='location'] { color: var(--ink); border-left-color: var(--ink); }
      .l2 a { padding-left: var(--space-4); }
      .l3 a { padding-left: var(--space-5); font-size: var(--type-small); line-height: var(--leading-small); }
    `,
  ];

  override render() {
    if (!this.items.length) return html``;
    // Indented from the highest level there is, so a document without a title heading starts at the left.
    const top = Math.min(...this.items.map((i) => i.level));
    return html`<nav aria-label=${this.heading}>
      <span class="label">${this.heading}</span>
      <ol>
        ${this.items.map(
          (item) => html`<li class="l${item.level - top + 1}">
            <a
              href="#${item.id}"
              aria-current=${item.id === this.current ? 'location' : 'false'}
              @click=${(e: Event) => {
                e.preventDefault();
                this.dispatchEvent(new CustomEvent('ui-select', { detail: { id: item.id }, bubbles: true, composed: true }));
              }}
              >${item.text}</a
            >
          </li>`,
        )}
      </ol>
    </nav>`;
  }
}

if (!customElements.get('ui-contents')) customElements.define('ui-contents', UiContents);

declare global {
  interface HTMLElementTagNameMap {
    'ui-contents': UiContents;
  }
}
