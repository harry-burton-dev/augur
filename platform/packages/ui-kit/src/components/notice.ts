import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';
import './button.js';

export type NoticeTone = 'needs' | 'warning' | 'refused' | 'info';

/**
 * One sentence inside a page that needs attention, with at most one thing to
 * do: a back-brief that's waiting for you, two floors that disagree, a choice
 * that was turned down, a view of the past. One per region; if there are more,
 * say so with `more` ("2 more need you") instead of stacking them.
 *
 * Not for things that happened elsewhere: those go to the stream (`ctx.notify`).
 *
 * The mark's shape says the tone as well as its colour: a green dot needs you,
 * an amber dot is a warning, a red diamond was refused, an info ring is neutral.
 *
 * @slot - the rest of the sentence, after the heading
 * @fires ui-action - its action was pressed
 */
export class UiNotice extends LitElement {
  static override properties = {
    tone: { type: String, reflect: true },
    heading: { type: String },
    action: { type: String },
    more: { type: Number },
  };

  declare tone: NoticeTone;
  /** The part that matters, in bold: "Waiting for your back-brief." */
  declare heading: string;
  /** The one thing to do, as a word or two. */
  declare action: string;
  /** How many more notices there are in this region, said at the end. */
  declare more: number;

  constructor() {
    super();
    this.tone = 'info';
    this.heading = '';
    this.action = '';
    this.more = 0;
  }

  static override styles = [
    base,
    css`
      :host { display: block; }
      .notice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
        padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
        border-radius: var(--radius-inset);
        background: var(--surface-raised);
        border: 1px solid var(--hairline-strong);
        font-size: var(--type-meta);
        line-height: var(--leading-meta);
      }
      :host([tone='info']) .notice { background: none; border-color: var(--hairline); }
      .mark { flex: none; width: 8px; height: 8px; border-radius: 50%; }
      :host([tone='needs']) .mark { background: var(--green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 22%, transparent); }
      :host([tone='warning']) .mark { background: var(--warning); }
      :host([tone='refused']) .mark { width: 7px; height: 7px; border-radius: 1px; transform: rotate(45deg); background: var(--danger); }
      :host([tone='info']) .mark { width: auto; height: auto; color: var(--info); display: inline-flex; }
      p { flex: 1 1 220px; min-width: 0; margin: 0; }
      b { font-weight: 500; }
      .more { color: var(--ink-muted); }
    `,
  ];

  override render() {
    const actionKind = this.tone === 'info' ? 'tertiary' : 'secondary';
    return html`<div class="notice" part="notice">
      ${this.tone === 'info'
        ? html`<span class="mark" aria-hidden="true"><ui-icon name="info" size="14"></ui-icon></span>`
        : html`<span class="mark" aria-hidden="true"></span>`}
      <p>${this.heading ? html`<b>${this.heading}</b> ` : nothing}<slot></slot>${this.more
          ? html` <span class="more">${this.more} more ${this.tone === 'needs' ? (this.more === 1 ? 'needs' : 'need') + ' you' : 'here'}.</span>`
          : nothing}</p>
      ${this.action
        ? html`<ui-button kind=${actionKind} size="sm" @click=${() => this.dispatchEvent(new CustomEvent('ui-action', { bubbles: true, composed: true }))}>${this.action}</ui-button>`
        : nothing}
    </div>`;
  }
}

if (!customElements.get('ui-notice')) customElements.define('ui-notice', UiNotice);

declare global {
  interface HTMLElementTagNameMap {
    'ui-notice': UiNotice;
  }
}
