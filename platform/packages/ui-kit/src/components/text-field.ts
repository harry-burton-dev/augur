import { LitElement, css, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { base, uid } from '../shared.js';

export type FieldState = 'idle' | 'attention' | 'error' | 'warning' | 'valid';
export interface FieldCheck {
  state: Exclude<FieldState, 'idle' | 'attention'>;
  message?: string;
}

/**
 * A line to write on: a label, an optional hint and a hairline that turns the
 * focus blue while you type. Missing is not wrong: a required field left empty
 * asks in green ("Needs you"); only content that is wrong turns red.
 *
 * Takes part in forms through ElementInternals.
 *
 * @fires ui-input - every keystroke, detail `{ value }`
 * @fires ui-change - on commit (blur or Enter), detail `{ value }`
 */
export class UiTextField extends LitElement {
  static formAssociated = true;

  static override properties = {
    label: { type: String },
    hint: { type: String },
    placeholder: { type: String },
    value: { type: String },
    name: { type: String, reflect: true },
    type: { type: String },
    required: { type: Boolean, reflect: true },
    optional: { type: Boolean },
    multiline: { type: Boolean },
    rows: { type: Number },
    maxlength: { type: Number },
    readonly: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    showValid: { type: Boolean, attribute: 'show-valid' },
    state: { type: String, reflect: true },
    message: { type: String },
    validate: { attribute: false },
  };

  declare label: string;
  declare hint: string;
  declare placeholder: string;
  declare value: string;
  declare name: string;
  declare type: string;
  declare required: boolean;
  declare optional: boolean;
  declare multiline: boolean;
  declare rows: number;
  declare maxlength: number | undefined;
  declare readonly: boolean;
  declare disabled: boolean;
  declare busy: boolean;
  declare showValid: boolean;
  declare state: FieldState;
  declare message: string;
  /** Return a check for the current value, or null when it's fine. */
  declare validate: ((value: string) => FieldCheck | null) | undefined;

  private internals?: ElementInternals;
  private ids = { input: uid('field'), hint: uid('hint'), msg: uid('msg') };

  constructor() {
    super();
    this.label = '';
    this.hint = '';
    this.placeholder = '';
    this.value = '';
    this.name = '';
    this.type = 'text';
    this.required = false;
    this.optional = false;
    this.multiline = false;
    this.rows = 3;
    this.readonly = false;
    this.disabled = false;
    this.busy = false;
    this.showValid = false;
    this.state = 'idle';
    this.message = '';
    try {
      this.internals = this.attachInternals();
    } catch {
      // Not supported (some test DOMs): the field still works, just not as a form control.
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('value')) this.internals?.setFormValue(this.value);
  }

  private get control(): HTMLInputElement | HTMLTextAreaElement | null {
    return this.renderRoot.querySelector('.input');
  }

  override focus(options?: FocusOptions) {
    this.control?.focus(options);
  }

  /** Empty the field and its state. */
  clear() {
    this.value = '';
    this.setState('idle');
  }

  setState(state: FieldState, message = '') {
    this.state = state;
    this.message = message;
    const invalid = state === 'error' || state === 'attention';
    this.internals?.setValidity(invalid ? { customError: true } : {}, invalid ? message || 'Needs you.' : '');
  }

  /** Check the field now, as a form's primary does. Returns true when nothing needs fixing. */
  check(): boolean {
    if (this.required && !this.value.trim()) {
      this.setState('attention', 'Needs you.');
      return false;
    }
    const result = this.value ? this.validate?.(this.value) : null;
    if (result) {
      this.setState(result.state, result.message ?? '');
      return result.state !== 'error';
    }
    this.setState(this.showValid && this.value ? 'valid' : 'idle');
    return true;
  }

  private onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
    // Typing clears "needs you" and errors straight away.
    if (this.state === 'attention' || this.state === 'error') this.setState('idle');
    if (this.multiline) this.grow();
    this.dispatchEvent(new CustomEvent('ui-input', { detail: { value: this.value }, bubbles: true, composed: true }));
  }

  private onCommit() {
    this.check();
    this.dispatchEvent(new CustomEvent('ui-change', { detail: { value: this.value }, bubbles: true, composed: true }));
  }

  private grow() {
    const el = this.control;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  static override styles = [
    base,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
      :host([disabled]) { opacity: 0.4; pointer-events: none; }
      .head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); font-size: var(--type-meta); line-height: var(--leading-meta); }
      label { color: var(--ink); font-weight: 500; }
      .flag {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--type-label);
        line-height: var(--leading-label);
        letter-spacing: var(--tracking-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .dot { position: relative; width: 6px; height: 6px; border-radius: 50%; border: 1px solid currentColor; }
      .hint { margin: 0; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .box {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-height: 44px;
        border-bottom: 1px solid var(--hairline-strong);
        transition: border-color var(--motion-base) var(--ease-standard), box-shadow var(--motion-base) var(--ease-standard);
      }
      .box:hover { border-bottom-color: color-mix(in srgb, var(--ink) 50%, transparent); }
      .input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: none;
        color: var(--ink);
        font: inherit;
        font-size: var(--type-body);
        line-height: var(--leading-body);
        padding: var(--space-3) 0;
        resize: none;
      }
      textarea.input { overflow: hidden; }
      .input::placeholder { color: color-mix(in srgb, var(--ink-muted) 75%, transparent); }
      .icon { flex: none; display: flex; width: 16px; height: 16px; }
      .icon svg, .msg svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
      .foot { display: flex; justify-content: space-between; gap: var(--space-3); min-height: var(--leading-small); }
      .msg { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .msg svg { width: 12px; height: 12px; }
      .count { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); font-variant-numeric: tabular-nums; }

      :host([state='attention']) .box { border-bottom-color: var(--green); box-shadow: 0 1px 0 var(--green); }
      :host([state='attention']) .flag,
      :host([state='attention']) .msg { color: var(--green); }
      :host([state='attention']) .dot { background: var(--green); border-color: var(--green); }
      :host([state='attention']) .dot::after {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        border: 1px solid var(--green);
        animation: ui-ping var(--motion-ping) var(--ease-ping) infinite;
      }
      :host([state='error']) .box { border-bottom-color: var(--danger); box-shadow: 0 1px 0 var(--danger); }
      :host([state='error']) .msg, :host([state='error']) .icon { color: var(--danger); }
      :host([state='warning']) .box { border-bottom-color: var(--warning); }
      :host([state='warning']) .msg, :host([state='warning']) .icon { color: var(--warning); }
      :host([state='valid']) .box { border-bottom-color: color-mix(in srgb, var(--success) 60%, transparent); }
      :host([state='valid']) .msg, :host([state='valid']) .icon { color: var(--success); }
      /* Focus wins over every state while typing. */
      .box:focus-within { border-bottom-color: var(--focus) !important; box-shadow: 0 1px 0 var(--focus) !important; }
      :host([readonly]) .box { border-bottom-style: dashed; box-shadow: none; }
      :host([readonly]) .input { color: var(--ink-muted); cursor: default; }
      :host([busy]) .box::after {
        content: '';
        position: absolute;
        bottom: -1px;
        height: 1px;
        background: var(--ink);
        animation: ui-run var(--motion-run) var(--ease-standard) infinite;
      }
    `,
  ];

  private stateIcon() {
    switch (this.state) {
      case 'error':
        return html`<svg viewBox="0 0 16 16"><path d="M8 2l6 6-6 6-6-6z" /></svg>`;
      case 'warning':
        return html`<svg viewBox="0 0 16 16"><path d="M8 2.5l6 11H2z" /></svg>`;
      case 'valid':
        return html`<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" /></svg>`;
      default:
        return nothing;
    }
  }

  override render() {
    const describedBy = [this.hint ? this.ids.hint : '', this.message ? this.ids.msg : ''].filter(Boolean).join(' ');
    const common = {
      invalid: this.state === 'error' || this.state === 'attention' ? 'true' : 'false',
    };
    const control = this.multiline
      ? html`<textarea
          id=${this.ids.input}
          class="input"
          rows=${this.rows}
          .value=${live(this.value)}
          placeholder=${this.placeholder || nothing}
          maxlength=${this.maxlength ?? nothing}
          ?readonly=${this.readonly}
          ?disabled=${this.disabled}
          ?required=${this.required}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${common.invalid}
          @input=${this.onInput}
          @change=${this.onCommit}
        ></textarea>`
      : html`<input
          id=${this.ids.input}
          class="input"
          type=${this.type}
          .value=${live(this.value)}
          placeholder=${this.placeholder || nothing}
          maxlength=${this.maxlength ?? nothing}
          ?readonly=${this.readonly}
          ?disabled=${this.disabled}
          ?required=${this.required}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${common.invalid}
          @input=${this.onInput}
          @change=${this.onCommit}
          @blur=${() => this.required && !this.value && this.check()}
        />`;
    return html`
      <div class="head">
        <label for=${this.ids.input}>${this.label}</label>
        ${this.required
          ? html`<span class="flag"><i class="dot" aria-hidden="true"></i>Required</span>`
          : this.optional
            ? html`<span class="flag">Optional</span>`
            : nothing}
      </div>
      ${this.hint ? html`<p class="hint" id=${this.ids.hint}>${this.hint}</p>` : nothing}
      <div class="box" part="box">
        ${control}
        <span class="icon" aria-hidden="true">${this.stateIcon()}</span>
      </div>
      <div class="foot">
        <p class="msg" id=${this.ids.msg} aria-live="polite">${this.message}</p>
        ${this.maxlength ? html`<span class="count">${this.value.length} / ${this.maxlength}</span>` : nothing}
      </div>
    `;
  }
}

if (!customElements.get('ui-text-field')) customElements.define('ui-text-field', UiTextField);

declare global {
  interface HTMLElementTagNameMap {
    'ui-text-field': UiTextField;
  }
}
