import { LitElement, css, html } from 'lit';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'ai';

/**
 * A labelled action. One green primary per view; danger is the only coloured
 * button besides it. Labels are uppercase and tracked, per the design system.
 *
 * @fires click - native click, suppressed while disabled
 */
export class UiButton extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    type: { type: String },
  };

  declare variant: ButtonVariant;
  declare disabled: boolean;
  declare type: 'button' | 'submit' | 'reset';

  constructor() {
    super();
    this.variant = 'secondary';
    this.disabled = false;
    this.type = 'button';
  }

  static override styles = css`
    :host { display: inline-block; }
    button {
      font: inherit;
      font-family: var(--font-sans);
      font-size: var(--type-label);
      line-height: var(--leading-label);
      letter-spacing: var(--tracking-label);
      text-transform: uppercase;
      padding: var(--space-3) var(--space-5);
      border-radius: var(--radius-pill);
      border: 1px solid var(--hairline-strong);
      background: transparent;
      color: var(--ink);
      cursor: pointer;
      transition: background var(--motion-instant) var(--ease-standard),
        border-color var(--motion-instant) var(--ease-standard);
    }
    button:hover { border-color: var(--ink-muted); }
    button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    :host([variant='primary']) button {
      background: var(--green);
      border-color: var(--green);
      color: var(--slate-deep);
    }
    :host([variant='tertiary']) button,
    :host([variant='ghost']) button { border-color: transparent; }
    :host([variant='ghost']) button { padding-inline: var(--space-2); }
    :host([variant='danger']) button { color: var(--danger); border-color: var(--danger); }
    :host([variant='ai']) button {
      font-family: var(--font-rounded);
      border-color: color-mix(in srgb, var(--green) 50%, transparent);
    }
  `;

  override render() {
    return html`<button part="button" type=${this.type} ?disabled=${this.disabled}><slot></slot></button>`;
  }
}

if (!customElements.get('ui-button')) customElements.define('ui-button', UiButton);

declare global {
  interface HTMLElementTagNameMap {
    'ui-button': UiButton;
  }
}
