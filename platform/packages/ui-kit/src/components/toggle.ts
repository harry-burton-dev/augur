import { LitElement, css, html, nothing } from 'lit';
import { base, uid } from '../shared.js';
import './icon.js';

/**
 * On or off, and you can always tell which: the track fills with ink, the knob
 * moves, its mark turns from a dash to a tick, and the word changes. A toggle
 * acts at once; a choice that waits for a form's primary is a checkbox.
 *
 * Set `change` to a function returning a Promise and the toggle shows saving
 * until it settles; if it fails, the toggle turns back and says why.
 *
 * @fires ui-change - flipped and kept, detail `{ checked }`
 */
export class UiToggle extends LitElement {
  static override properties = {
    label: { type: String },
    hint: { type: String },
    checked: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    onWord: { type: String, attribute: 'on-word' },
    offWord: { type: String, attribute: 'off-word' },
    change: { attribute: false },
    error: { state: true },
  };

  declare label: string;
  declare hint: string;
  declare checked: boolean;
  declare disabled: boolean;
  declare busy: boolean;
  declare onWord: string;
  declare offWord: string;
  /** Applies the change; reject to turn the toggle back. */
  declare change: ((checked: boolean) => void | Promise<unknown>) | undefined;
  declare error: string;

  private ids = { label: uid('toggle'), hint: uid('hint') };

  constructor() {
    super();
    this.label = '';
    this.hint = '';
    this.checked = false;
    this.disabled = false;
    this.busy = false;
    this.onWord = 'On';
    this.offWord = 'Off';
    this.error = '';
  }

  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector<HTMLButtonElement>('button')?.focus(options);
  }

  /** Flip it, as a press does. */
  async flip() {
    if (this.disabled || this.busy) return;
    const was = this.checked;
    this.checked = !was;
    try {
      const pending = this.change?.(this.checked);
      if (pending instanceof Promise) {
        this.busy = true;
        await pending;
      }
      this.error = '';
      this.dispatchEvent(new CustomEvent('ui-change', { detail: { checked: this.checked }, bubbles: true, composed: true }));
    } catch (err) {
      this.checked = was;
      const message = err instanceof Error && err.message ? err.message : '';
      this.error = message || `Couldn’t change that. It’s still ${(was ? this.onWord : this.offWord).toLowerCase()}.`;
    } finally {
      this.busy = false;
    }
  }

  static override styles = [
    base,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-1); }
      :host([disabled]) { opacity: 0.4; }
      .row { display: flex; align-items: center; gap: var(--space-5); min-height: 44px; }
      .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
      .text label { font-size: var(--type-body); line-height: var(--leading-body); cursor: pointer; }
      .hint { margin: 0; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .control { display: flex; align-items: center; gap: var(--space-3); }
      .switch {
        position: relative;
        flex: none;
        width: 52px;
        height: 30px;
        padding: 0;
        border-radius: var(--radius-pill);
        cursor: pointer;
        border: 1.5px solid color-mix(in srgb, var(--ink) 45%, transparent);
        background: transparent;
        transition: background var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard);
      }
      /* a 44px target around the track */
      .switch::before { content: ''; position: absolute; inset: -8px -4px; }
      .switch:hover { border-color: var(--ink); }
      .switch:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 4px; }
      .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 21px;
        height: 21px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ink-muted);
        transition: transform var(--motion-slow) var(--ease-spring), background var(--motion-base) var(--ease-standard);
      }
      .off { width: 8px; height: 2px; border-radius: 1px; background: var(--slate-deep); }
      .on { display: none; color: var(--ink); }
      :host([checked]) .switch { background: var(--ink); border-color: var(--ink); }
      :host([checked]) .knob { transform: translateX(22px); background: var(--slate-deep); }
      :host([checked]) .on { display: flex; }
      :host([checked]) .off { display: none; }
      .word {
        min-width: 3ch;
        font-size: var(--type-label);
        line-height: var(--leading-label);
        letter-spacing: var(--tracking-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 500;
      }
      :host([checked]) .word { color: var(--ink); }
      :host([disabled]) .switch, :host([disabled]) label, :host([busy]) .switch { cursor: default; pointer-events: none; }
      :host([busy]) .knob::after {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        border: 1.5px solid transparent;
        border-top-color: var(--ink);
        animation: ui-spin var(--motion-spin) linear infinite;
      }
      .msg { margin: 0; font-size: var(--type-small); line-height: var(--leading-small); color: var(--danger); }
    `,
  ];

  override render() {
    return html`
      <div class="row">
        <div class="text">
          <label id=${this.ids.label} @click=${() => this.flip()}>${this.label}</label>
          ${this.hint ? html`<p class="hint" id=${this.ids.hint}>${this.hint}</p>` : nothing}
        </div>
        <div class="control">
          <span class="word" aria-hidden="true">${this.checked ? this.onWord : this.offWord}</span>
          <button
            class="switch"
            type="button"
            role="switch"
            aria-checked=${String(this.checked)}
            aria-labelledby=${this.ids.label}
            aria-describedby=${this.hint ? this.ids.hint : nothing}
            aria-busy=${this.busy ? 'true' : nothing}
            ?disabled=${this.disabled}
            @click=${() => this.flip()}
          >
            <span class="knob"><i class="on"><ui-icon name="check" size="13"></ui-icon></i><i class="off"></i></span>
          </button>
        </div>
      </div>
      ${this.error ? html`<p class="msg" role="alert">${this.error}</p>` : nothing}
    `;
  }
}

if (!customElements.get('ui-toggle')) customElements.define('ui-toggle', UiToggle);

declare global {
  interface HTMLElementTagNameMap {
    'ui-toggle': UiToggle;
  }
}
