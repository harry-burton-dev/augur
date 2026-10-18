import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';

export type StatusName = 'needs' | 'running' | 'queued' | 'paused' | 'done' | 'failed' | 'warning';

export const statusWords: Record<StatusName, string> = {
  needs: 'Needs you',
  running: 'Running',
  queued: 'Queued',
  paused: 'Paused',
  done: 'Done',
  failed: 'Failed',
  warning: 'Check',
};

/** Urgency order used when sorting by status: what needs you first, finished last. */
export const statusUrgency: StatusName[] = ['needs', 'failed', 'running', 'queued', 'paused', 'warning', 'done'];

/**
 * One mark and a word for where a thing is. Only `needs` is green, because only
 * it asks for you; every mark keeps its shape without colour. Set `next` on the
 * first one on screen that needs you to make it ping.
 */
export class UiStatus extends LitElement {
  static override properties = {
    status: { type: String, reflect: true },
    label: { type: String },
    markOnly: { type: Boolean, attribute: 'mark-only' },
    next: { type: Boolean, reflect: true },
  };

  declare status: StatusName;
  /** Overrides the default word. */
  declare label: string;
  declare markOnly: boolean;
  declare next: boolean;

  constructor() {
    super();
    this.status = 'queued';
    this.label = '';
    this.markOnly = false;
    this.next = false;
  }

  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--type-meta);
        line-height: var(--leading-meta);
        white-space: nowrap;
      }
      .mark { position: relative; flex: none; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; }
      .word { color: var(--ink); }

      :host([status='needs']) .mark::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--green); }
      :host([status='needs']) .word { color: var(--green); }
      :host([status='needs'][next]) .mark::after {
        content: '';
        position: absolute;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        border: 1px solid var(--green);
        animation: ui-ping var(--motion-ping) var(--ease-ping) infinite;
      }
      :host([status='running']) .mark::before {
        content: '';
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1.5px solid color-mix(in srgb, var(--ink) 30%, transparent);
        border-top-color: var(--ink);
        animation: ui-spin var(--motion-spin) linear infinite;
      }
      :host([status='queued']) .mark::before { content: ''; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--ink-muted); }
      :host([status='paused']) .mark::before { content: ''; width: 8px; height: 8px; border-left: 2px solid var(--ink-muted); border-right: 2px solid var(--ink-muted); }
      :host([status='queued']) .word,
      :host([status='paused']) .word,
      :host([status='done']) .word { color: var(--ink-muted); }
      :host([status='done']) .mark { color: var(--success); }
      :host([status='failed']) .mark,
      :host([status='failed']) .word { color: var(--danger); }
      :host([status='warning']) .mark,
      :host([status='warning']) .word { color: var(--warning); }
    `,
  ];

  private glyph() {
    switch (this.status) {
      case 'done':
        return html`<ui-icon name="check" size="14"></ui-icon>`;
      case 'failed':
        return html`<ui-icon name="error" size="14"></ui-icon>`;
      case 'warning':
        return html`<ui-icon name="warning" size="14"></ui-icon>`;
      default:
        return nothing;
    }
  }

  override render() {
    const word = this.label || statusWords[this.status] || this.status;
    return html`
      <span class="mark" part="mark" aria-hidden=${this.markOnly ? 'false' : 'true'} role=${this.markOnly ? 'img' : nothing}
        aria-label=${this.markOnly ? word : nothing}>${this.glyph()}</span>
      ${this.markOnly ? nothing : html`<span class="word" part="word">${word}</span>`}
    `;
  }
}

if (!customElements.get('ui-status')) customElements.define('ui-status', UiStatus);

declare global {
  interface HTMLElementTagNameMap {
    'ui-status': UiStatus;
  }
}
