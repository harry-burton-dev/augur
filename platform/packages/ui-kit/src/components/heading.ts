import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';

/**
 * The top of anything: an eyebrow (where you are), a title (what this is) and an
 * optional summary, a fact about now ("Three unread."). One heading per surface.
 */
export class UiHeading extends LitElement {
  static override properties = {
    eyebrow: { type: String },
    heading: { type: String },
    summary: { type: String },
    size: { type: String, reflect: true },
    level: { type: Number },
  };

  declare eyebrow: string;
  declare heading: string;
  declare summary: string;
  declare size: 's' | 'm' | 'l';
  /** The heading level for the title element, 1–6. */
  declare level: number;

  constructor() {
    super();
    this.eyebrow = '';
    this.heading = '';
    this.summary = '';
    this.size = 'm';
    this.level = 2;
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; }
      .title {
        margin: var(--space-2) 0 0;
        font-size: var(--type-title);
        line-height: var(--leading-title);
        font-weight: 300;
        letter-spacing: var(--tracking-tight);
        color: var(--ink);
      }
      .title:first-child { margin-top: 0; }
      :host([size='s']) .title { font-size: var(--type-heading); line-height: var(--leading-heading); }
      :host([size='l']) .title { font-size: var(--type-display); line-height: var(--leading-display); font-weight: 200; }
      .summary {
        margin: var(--space-3) 0 0;
        max-width: var(--measure-prose);
        font-size: var(--type-body);
        line-height: var(--leading-body);
        color: var(--ink-muted);
      }
    `,
  ];

  override render() {
    const level = Math.min(6, Math.max(1, this.level || 2));
    return html`
      ${this.eyebrow ? html`<div class="label" part="eyebrow">${this.eyebrow}</div>` : nothing}
      <div class="title" part="title" role="heading" aria-level=${level}>${this.heading}</div>
      ${this.summary ? html`<p class="summary" part="summary">${this.summary}</p>` : nothing}
    `;
  }
}

if (!customElements.get('ui-heading')) customElements.define('ui-heading', UiHeading);

declare global {
  interface HTMLElementTagNameMap {
    'ui-heading': UiHeading;
  }
}
