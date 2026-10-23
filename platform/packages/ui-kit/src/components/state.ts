import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';

export type StateKind = 'empty' | 'loading' | 'error' | 'offline';

/**
 * What a region says when it has nothing, is still coming, or failed: one
 * quiet sentence, a line more if it helps, and at most one thing to do.
 *
 * - Empty says what would be here and offers the obvious next step. Never
 *   green, no illustrations.
 * - Loading shows the running hairline, after 300ms, so a quick load doesn't
 *   flash. Never a full-screen spinner.
 * - Error says what failed and whether anything changed; only the diamond and
 *   the title are red. The action is usually Try again.
 * - Offline is amber, and says what you see is from before.
 *
 * `size="line"` sits inside a control or a tile; the default is centred in its region.
 *
 * @fires ui-action - the action was chosen
 */
export class UiState extends LitElement {
  static override properties = {
    kind: { type: String, reflect: true },
    heading: { type: String },
    body: { type: String },
    action: { type: String },
    size: { type: String, reflect: true },
    shown: { state: true },
  };

  declare kind: StateKind;
  declare heading: string;
  declare body: string;
  /** The one thing to do, as a word or two; nothing shows without it. */
  declare action: string;
  declare size: 'region' | 'line';
  declare shown: boolean;

  private wait: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.kind = 'empty';
    this.heading = '';
    this.body = '';
    this.action = '';
    this.size = 'region';
    this.shown = true;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (!changed.has('kind')) return;
    clearTimeout(this.wait);
    if (this.kind === 'loading') {
      this.shown = false;
      this.wait = setTimeout(() => (this.shown = true), 300);
    } else this.shown = true;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.wait);
  }

  static override styles = [
    base,
    css`
      :host { display: block; }
      .state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); text-align: center; color: var(--ink-muted); }
      :host([size='line']) .state { flex-direction: row; flex-wrap: wrap; gap: var(--space-2) var(--space-3); padding: var(--space-3) 0; text-align: left; }
      .title { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: var(--type-body); line-height: var(--leading-body); color: var(--ink-muted); }
      :host([kind='error']) .title { color: var(--danger); }
      :host([kind='offline']) .title { color: var(--warning); }
      .body { margin: 0; font-size: var(--type-small); line-height: var(--leading-small); max-width: var(--measure-read); }
      button { color: var(--ink); font: inherit; font-size: var(--type-meta); background: none; border: 0; padding: var(--space-1) 0; cursor: pointer; text-decoration: underline; text-decoration-color: var(--green); text-underline-offset: 6px; }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; border-radius: var(--radius-key); }
      .run { position: relative; width: min(240px, 60%); height: 1px; background: var(--hairline); overflow: hidden; }
      .run::after { content: ''; position: absolute; top: 0; height: 1px; background: var(--ink-muted); animation: ui-run 1.4s var(--ease-standard) infinite; }
      .hidden { visibility: hidden; }
    `,
  ];

  override render() {
    const role = this.kind === 'error' ? 'alert' : 'status';
    const mark = this.kind === 'error' ? 'error' : this.kind === 'offline' ? 'warning' : '';
    return html`<div class="state ${this.shown ? '' : 'hidden'}" role=${role} aria-busy=${this.kind === 'loading' ? 'true' : nothing}>
      ${this.kind === 'loading' ? html`<span class="run" aria-hidden="true"></span>` : nothing}
      <p class="title">${mark ? html`<ui-icon name=${mark} size="14"></ui-icon>` : nothing}${this.heading}</p>
      ${this.body ? html`<p class="body">${this.body}</p>` : nothing}
      ${this.action && this.kind !== 'loading'
        ? html`<button @click=${() => this.dispatchEvent(new CustomEvent('ui-action', { bubbles: true, composed: true }))}>${this.action}</button>`
        : nothing}
    </div>`;
  }
}

if (!customElements.get('ui-state')) customElements.define('ui-state', UiState);

declare global {
  interface HTMLElementTagNameMap {
    'ui-state': UiState;
  }
}
