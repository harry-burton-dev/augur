import { LitElement, css, html, nothing } from 'lit';
import { base, fieldParts, uid } from '../shared.js';
import type { FieldState } from './text-field.js';
import type { SelectOption } from './select.js';
import './icon.js';

/**
 * Any of a short list (up to about seven), every option in view. Ticks are ink:
 * being chosen is a state, not a need. Like a checkbox, the choice waits for
 * the form's primary; a choice that acts at once is a Toggle.
 *
 * `required` means at least one, `min` at least that many; short of it, the
 * group asks in green when checked. At `max` the rest dim and the line says so.
 * Its `value` is the chosen values joined with commas, so a dialog collects it
 * like a field; `values` is the list.
 *
 * @fires ui-change - detail `{ values }`
 */
export class UiCheckboxGroup extends LitElement {
  static override properties = {
    label: { type: String },
    hint: { type: String },
    name: { type: String, reflect: true },
    options: { attribute: false },
    values: { attribute: false },
    required: { type: Boolean, reflect: true },
    optional: { type: Boolean },
    min: { type: Number },
    max: { type: Number },
    disabled: { type: Boolean, reflect: true },
    state: { type: String, reflect: true },
    message: { type: String },
  };

  declare label: string;
  declare hint: string;
  declare name: string;
  declare options: (SelectOption | string)[];
  declare values: string[];
  declare required: boolean;
  declare optional: boolean;
  declare min: number;
  declare max: number;
  declare disabled: boolean;
  declare state: FieldState;
  declare message: string;

  private ids = { label: uid('group'), hint: uid('hint'), msg: uid('msg') };

  constructor() {
    super();
    this.label = '';
    this.hint = '';
    this.name = '';
    this.options = [];
    this.values = [];
    this.required = false;
    this.optional = false;
    this.min = 0;
    this.max = 0;
    this.disabled = false;
    this.state = 'idle';
    this.message = '';
  }

  get choices(): SelectOption[] {
    return this.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  }

  get value(): string {
    return this.values.join(',');
  }

  private get least() {
    return Math.max(this.min, this.required ? 1 : 0);
  }

  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector<HTMLButtonElement>('.box:not([disabled])')?.focus(options);
  }

  clear() {
    this.values = [];
    this.setState('idle');
  }

  setState(state: FieldState, message = '') {
    this.state = state;
    this.message = message;
  }

  /** Check it now, as a form's primary does. Returns true when nothing needs fixing. */
  check(): boolean {
    const least = this.least;
    if (this.values.length < least) {
      this.setState('attention', least === 1 ? 'Needs you.' : `Choose at least ${least}.`);
      return false;
    }
    if (this.state === 'attention') this.setState('idle');
    return this.state !== 'error';
  }

  private capped(value: string) {
    return this.max > 0 && this.values.length >= this.max && !this.values.includes(value);
  }

  private toggle(option: SelectOption) {
    if (this.disabled || option.disabled || this.capped(option.value)) return;
    const on = !this.values.includes(option.value);
    // Kept in the options' order, which is meaningful.
    this.values = this.choices.map((o) => o.value).filter((v) => (v === option.value ? on : this.values.includes(v)));
    if (this.state === 'attention' && this.values.length >= this.least) this.setState('idle');
    this.dispatchEvent(new CustomEvent('ui-change', { detail: { values: this.values }, bubbles: true, composed: true }));
  }

  static override styles = [
    base,
    fieldParts,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
      :host([disabled]) { opacity: 0.4; pointer-events: none; }
      .checks { display: flex; flex-direction: column; gap: var(--space-3); padding-top: var(--space-1); }
      .check { display: flex; align-items: center; gap: var(--space-3); min-height: 28px; cursor: pointer; }
      .check.off { opacity: 0.4; cursor: default; }
      .box {
        position: relative;
        flex: none;
        width: 20px;
        height: 20px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 1.5px solid color-mix(in srgb, var(--ink) 45%, transparent);
        border-radius: var(--radius-key);
        background: transparent;
        color: var(--slate-deep);
        transition: background var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard);
      }
      /* a 44px target */
      .box::before { content: ''; position: absolute; inset: -12px; }
      .box:hover { border-color: var(--ink); }
      .box:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 3px; }
      .box[disabled] { pointer-events: none; }
      .tick { display: none; }
      .box[aria-checked='true'] { background: var(--ink); border-color: var(--ink); }
      .box[aria-checked='true'] .tick { display: flex; }
      :host([state='attention']) .box:not([aria-checked='true']) { border-color: var(--green); }
      :host([state='error']) .box:not([aria-checked='true']) { border-color: var(--danger); }
      .text { flex: 1; min-width: 0; display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-4); font-size: var(--type-body); line-height: var(--leading-body); }
      .text em { font-style: normal; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
    `,
  ];

  override render() {
    const atMost = this.max > 0 && this.values.length >= this.max;
    const message = this.message || (atMost ? `That’s ${this.max}, the most you can choose.` : '');
    return html`
      <div class="head">
        <span class="name" id=${this.ids.label}>${this.label}</span>
        ${this.least > 0
          ? html`<span class="flag"><i class="dot" aria-hidden="true"></i>Required</span>`
          : this.optional
            ? html`<span class="flag">Optional</span>`
            : nothing}
      </div>
      ${this.hint ? html`<p class="hint" id=${this.ids.hint}>${this.hint}</p>` : nothing}
      <div class="checks" role="group" aria-labelledby=${this.ids.label} aria-describedby=${this.hint ? this.ids.hint : nothing}>
        ${this.choices.length
          ? this.choices.map((o) => {
              const off = Boolean(o.disabled) || this.capped(o.value);
              const id = `${this.ids.label}-${o.value}`;
              return html`<div class="check ${off ? 'off' : ''}" @click=${() => this.toggle(o)}>
                <button
                  class="box"
                  type="button"
                  role="checkbox"
                  aria-checked=${String(this.values.includes(o.value))}
                  aria-labelledby=${id}
                  ?disabled=${off}
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this.toggle(o);
                  }}
                >
                  <span class="tick" aria-hidden="true"><ui-icon name="check" size="14"></ui-icon></span>
                </button>
                <span class="text"><span id=${id}>${o.label}</span>${o.detail ? html`<em>${o.detail}</em>` : nothing}</span>
              </div>`;
            })
          : html`<p class="hint">Nothing to choose yet.</p>`}
      </div>
      <p class="msg" id=${this.ids.msg} aria-live="polite">${message}</p>
    `;
  }
}

if (!customElements.get('ui-checkbox-group')) customElements.define('ui-checkbox-group', UiCheckboxGroup);

declare global {
  interface HTMLElementTagNameMap {
    'ui-checkbox-group': UiCheckboxGroup;
  }
}
