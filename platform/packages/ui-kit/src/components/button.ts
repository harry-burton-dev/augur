import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';

export type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';

/**
 * A labelled action, set in tracked capitals. One primary per screen; name it for
 * what it does ("Publish", never "OK").
 *
 * Danger asks twice: the first press arms it ("Press again to…"), a second press
 * within `armFor` ms acts. Esc, blur or the timeout disarm it. `once` skips the
 * second ask, for a danger button inside a Confirm.
 *
 * `ai` marks an action that asks the AI (Bubble). Only primary and secondary take it.
 *
 * @slot - the label
 * @fires click - only when the press acts (not while armed, busy or disabled)
 */
export class UiButton extends LitElement {
  static override properties = {
    kind: { type: String, reflect: true },
    size: { type: String, reflect: true },
    ai: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    busyLabel: { type: String, attribute: 'busy-label' },
    once: { type: Boolean },
    armFor: { type: Number, attribute: 'arm-for' },
    type: { type: String },
    armed: { type: Boolean, reflect: true, state: true },
  };

  declare kind: ButtonKind;
  declare size: 'md' | 'sm';
  declare ai: boolean;
  declare disabled: boolean;
  declare busy: boolean;
  declare busyLabel: string;
  declare once: boolean;
  declare armFor: number;
  declare type: 'button' | 'submit' | 'reset';
  declare armed: boolean;

  private disarmTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this.kind = 'secondary';
    this.size = 'md';
    this.ai = false;
    this.disabled = false;
    this.busy = false;
    this.busyLabel = '';
    this.once = false;
    this.armFor = 3000;
    this.type = 'button';
    this.armed = false;
    // Registered before any consumer listener, so it can swallow presses that shouldn't act.
    this.addEventListener('click', this.guard, { capture: true });
    // Esc that disarms is used up here, so the shell doesn't also treat it as "go back".
    this.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.armed) return;
      e.preventDefault();
      this.disarm();
    });
    this.addEventListener('focusout', () => this.disarm());
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.disarmTimer);
  }

  private guard = (e: MouseEvent) => {
    if (this.disabled || this.busy) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    if (this.kind !== 'danger' || this.once) return;
    if (!this.armed) {
      e.stopImmediatePropagation();
      this.armed = true;
      this.disarmTimer = setTimeout(() => this.disarm(), this.armFor);
      return;
    }
    this.disarm();
  };

  /** Return an armed danger button to rest. */
  disarm() {
    clearTimeout(this.disarmTimer);
    this.armed = false;
  }

  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector('button')?.focus(options);
  }

  static override styles = [
    base,
    css`
      :host { display: inline-block; }
      :host([hidden]) { display: none; }
      button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        min-height: 48px;
        border: 0;
        border-radius: var(--radius-pill);
        background: none;
        color: inherit;
        font: inherit;
        font-family: var(--font-sans);
        font-size: var(--type-meta);
        line-height: var(--leading-meta);
        letter-spacing: var(--tracking-caps);
        text-transform: uppercase;
        white-space: nowrap;
        cursor: pointer;
        transition: background var(--motion-instant) var(--ease-standard),
          box-shadow var(--motion-instant) var(--ease-standard),
          color var(--motion-instant) var(--ease-standard),
          transform var(--motion-quick) var(--ease-standard);
      }
      button:active { transform: scale(0.97); }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 3px; }
      :host([disabled]) button { opacity: 0.4; cursor: default; pointer-events: none; }
      :host([busy]) button { cursor: progress; }
      :host([size='sm']) button { min-height: 36px; font-size: var(--type-small); line-height: var(--leading-small); }

      .primary { font-weight: 600; padding: var(--space-3) var(--space-5); background: var(--green); color: var(--slate-deep); }
      .primary:hover { box-shadow: 0 0 24px color-mix(in srgb, var(--green) 35%, transparent); }

      .secondary { padding: calc(var(--space-3) - 1px) calc(var(--space-5) - 1px); border: 1px solid var(--hairline-strong); color: var(--ink); }
      .secondary:hover {
        border-color: color-mix(in srgb, var(--ink) 55%, transparent);
        background: color-mix(in srgb, var(--ink) 5%, transparent);
      }

      .tertiary {
        min-height: auto;
        padding: var(--space-2) 2px;
        border-radius: var(--radius-key);
        font-size: var(--type-body);
        line-height: var(--leading-body);
        letter-spacing: normal;
        text-transform: none;
        color: var(--ink-muted);
      }
      .tertiary:hover { color: var(--ink); }

      .ghost { padding: var(--space-3) var(--space-5); color: var(--ink); }
      .ghost:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); backdrop-filter: blur(12px); }

      .danger { padding: calc(var(--space-3) - 1px) calc(var(--space-5) - 1px); border: 1px dashed var(--danger); color: var(--danger); }
      .danger::before {
        content: '';
        width: 10px;
        height: 10px;
        flex: none;
        border: 1.5px solid currentColor;
        border-radius: 2px;
        transform: rotate(45deg);
      }
      .danger:hover { border-style: solid; background: color-mix(in srgb, var(--danger) 8%, transparent); }
      .danger.armed { --ping-scale: 1.14; background: var(--danger); color: var(--slate-deep); border-style: solid; }
      .danger.armed::after {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: inherit;
        border: 1px solid var(--danger);
        animation: ui-ping var(--motion-ping) var(--ease-ping) infinite;
        pointer-events: none;
      }
      .count {
        position: absolute;
        left: 18%;
        right: 18%;
        bottom: 5px;
        height: 1px;
        background: currentColor;
        opacity: 0.5;
        transform-origin: left;
        animation: count var(--arm) linear forwards;
      }
      @keyframes count { from { transform: scaleX(1); } to { transform: scaleX(0); } }

      /* Bubble marks AI: light from above, a green rim light from below. */
      .ai {
        font-family: var(--font-rounded);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--light) 25%, transparent),
          inset 0 -6px 12px color-mix(in srgb, var(--green) 30%, transparent),
          0 0 0 1px color-mix(in srgb, var(--green) 45%, transparent);
      }
      .secondary.ai { background: radial-gradient(120% 140% at 50% 0%, color-mix(in srgb, var(--light) 10%, transparent), transparent 60%); }

      .spinner {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1.5px solid color-mix(in srgb, currentColor 30%, transparent);
        border-top-color: currentColor;
        animation: ui-spin var(--motion-spin) linear infinite;
      }
    `,
  ];

  override render() {
    const ai = this.ai && (this.kind === 'primary' || this.kind === 'secondary');
    const classes = [this.kind, ai ? 'ai' : '', this.armed ? 'armed' : ''].join(' ');
    const showBusy = this.busy && this.busyLabel;
    return html`<button
      part="button"
      class=${classes}
      type=${this.type}
      ?disabled=${this.disabled}
      aria-busy=${this.busy ? 'true' : 'false'}
      aria-live=${this.kind === 'danger' ? 'polite' : nothing}
    >
      ${this.busy ? html`<span class="spinner" aria-hidden="true"></span>` : nothing}
      ${this.armed
        ? html`<span>Press again to confirm</span><span class="count" style="--arm:${this.armFor}ms"></span>`
        : showBusy
          ? html`<span>${this.busyLabel}</span>`
          : html`<slot></slot>`}
    </button>`;
  }
}

if (!customElements.get('ui-button')) customElements.define('ui-button', UiButton);

declare global {
  interface HTMLElementTagNameMap {
    'ui-button': UiButton;
  }
}
