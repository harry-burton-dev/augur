import { LitElement, css, html } from 'lit';
import { base } from '../shared.js';
import './icon.js';

/**
 * A bare line icon in a round target, 48px (36px small). Every one has a name:
 * it is the accessible name, and shows as one line below on hover and focus.
 * Use it where the icon is unmistakable (find, settings, close) or the name
 * shows anyway; otherwise use a button with words.
 *
 * `ai` gives it the Bubble effect, for actions that ask the AI.
 *
 * @fires click - only when enabled
 */
export class UiIconButton extends LitElement {
  static override properties = {
    icon: { type: String },
    label: { type: String },
    size: { type: String, reflect: true },
    ai: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    nameless: { type: Boolean, reflect: true },
  };

  declare icon: string;
  declare label: string;
  declare size: 'md' | 'sm';
  declare ai: boolean;
  declare disabled: boolean;
  /** Hide the name below (it stays the accessible name), for rows where it would sit on the next cell. */
  declare nameless: boolean;

  constructor() {
    super();
    this.icon = '';
    this.label = '';
    this.size = 'md';
    this.ai = false;
    this.disabled = false;
    this.nameless = false;
    this.addEventListener('click', (e) => {
      if (this.disabled) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, { capture: true });
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
        width: 48px;
        height: 48px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: none;
        color: var(--ink-muted);
        font: inherit;
        cursor: pointer;
        transition: color var(--motion-instant) var(--ease-standard), box-shadow var(--motion-instant) var(--ease-standard),
          transform var(--motion-quick) var(--ease-standard);
      }
      button:active { transform: scale(0.97); }
      :host([size='sm']) button { width: 36px; height: 36px; }
      button::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle, color-mix(in srgb, var(--ink) 12%, transparent), transparent 70%);
        opacity: 0;
        transition: opacity var(--motion-base);
      }
      button:hover, button:focus-visible { color: var(--ink); }
      button:hover::before, button:focus-visible::before { opacity: 1; }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 4px; }
      .name {
        position: absolute;
        top: calc(100% + var(--space-1));
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        font-size: var(--type-small);
        line-height: var(--leading-small);
        color: var(--ink);
        opacity: 0;
        transition: opacity var(--motion-base);
        pointer-events: none;
      }
      button:hover .name, button:focus-visible .name { opacity: 1; }
      :host([nameless]) .name { display: none; }
      :host([disabled]) button { opacity: 0.4; cursor: default; pointer-events: none; }

      /* Bubble marks AI: a small glass sphere, a green light from below, an iridescent rim. */
      :host([ai]) button {
        isolation: isolate;
        color: var(--ink);
        background:
          radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--light) 70%, transparent) 0, color-mix(in srgb, var(--light) 12%, transparent) 16%, transparent 36%),
          radial-gradient(circle, color-mix(in srgb, var(--navy) 18%, transparent) 50%, color-mix(in srgb, var(--navy) 40%, transparent) 100%);
        box-shadow: inset 0 -5px 9px color-mix(in srgb, var(--green) 30%, transparent), 0 6px 14px color-mix(in srgb, var(--shade) 30%, transparent);
      }
      :host([ai]) button::before { display: none; }
      :host([ai]) button:hover {
        box-shadow: inset 0 -6px 12px color-mix(in srgb, var(--green) 55%, transparent), 0 0 20px color-mix(in srgb, var(--green) 30%, transparent),
          0 6px 14px color-mix(in srgb, var(--shade) 30%, transparent);
      }
      .rim { display: none; }
      :host([ai]) .rim {
        display: block;
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 1.5px;
        pointer-events: none;
        background: conic-gradient(from 200deg, color-mix(in srgb, var(--green) 95%, transparent), color-mix(in srgb, var(--navy) 95%, transparent),
          color-mix(in srgb, var(--ink) 85%, transparent), color-mix(in srgb, var(--green) 70%, transparent),
          color-mix(in srgb, var(--navy) 95%, transparent), color-mix(in srgb, var(--green) 95%, transparent));
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
      }
    `,
  ];

  override render() {
    return html`<button part="button" type="button" aria-label=${this.label} ?disabled=${this.disabled}>
      <span class="rim"></span>
      <ui-icon name=${this.icon} size=${this.size === 'sm' ? 20 : 24}></ui-icon>
      <span class="name" aria-hidden="true">${this.label}</span>
    </button>`;
  }
}

if (!customElements.get('ui-icon-button')) customElements.define('ui-icon-button', UiIconButton);

declare global {
  interface HTMLElementTagNameMap {
    'ui-icon-button': UiIconButton;
  }
}
