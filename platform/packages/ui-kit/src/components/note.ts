import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';

/**
 * A quiet line that explains, in one sentence. The longer reason waits behind
 * it: with `why`, pressing the line opens up to two more sentences in place,
 * so a page doesn't open with paragraphs above its form.
 *
 * With `live`, it's the line that says what an action did ("Saved.",
 * "Couldn't save. Nothing was changed."), read out when it changes.
 *
 * @slot - the line
 */
export class UiNote extends LitElement {
  static override properties = {
    why: { type: String },
    live: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
  };

  /** The longer reason, up to two sentences, shown when the line is pressed. */
  declare why: string;
  /** Announce changes to the line (an action's result). */
  declare live: boolean;
  /** Whether the reason is showing. */
  declare open: boolean;

  constructor() {
    super();
    this.why = '';
    this.live = false;
    this.open = false;
  }

  static override styles = [
    base,
    css`
      :host { display: block; max-width: var(--measure-prose); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }
      :host([live]) { min-height: var(--leading-meta); }
      p { margin: 0; }
      button {
        all: unset;
        cursor: pointer;
        color: var(--ink);
        text-decoration: underline;
        text-decoration-color: var(--hairline-strong);
        text-underline-offset: 3px;
        border-radius: var(--radius-key);
      }
      button:hover, :host([open]) button { text-decoration-color: var(--ink-muted); }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .why {
        margin-top: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-inset);
        background: var(--surface-inset);
        color: var(--ink);
      }
    `,
  ];

  override render() {
    if (!this.why) return html`<p role=${this.live ? 'status' : nothing}><slot></slot></p>`;
    return html`<p role=${this.live ? 'status' : nothing}><button aria-expanded=${this.open ? 'true' : 'false'} aria-controls="why" @click=${() => (this.open = !this.open)}><slot></slot></button></p>
      <p class="why" id="why" ?hidden=${!this.open}>${this.why}</p>`;
  }
}

if (!customElements.get('ui-note')) customElements.define('ui-note', UiNote);

declare global {
  interface HTMLElementTagNameMap {
    'ui-note': UiNote;
  }
}
