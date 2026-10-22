import { LitElement, css, html, nothing } from 'lit';
import { base, fieldParts, uid } from '../shared.js';
import type { FieldState } from './text-field.js';
import './icon.js';

export interface SelectOption {
  value: string;
  label: string;
  /** A quiet fact on the right ("12 people"), or why it can't be picked. */
  detail?: string;
  /** Stays in the list, at 40%, so people know it exists. */
  disabled?: boolean;
}

const normalise = (options: (SelectOption | string)[]): SelectOption[] =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

/**
 * Choose one from a short list (up to about 12). It looks like a TextField with
 * a chevron; opened, a raised glass list appears under the line. The chosen
 * option carries an ink tick: being chosen is a state, not a need.
 *
 * ↓ ↑ open and move, Enter or Space picks, Esc closes, Home and End jump, and
 * typing letters jumps to the first match. The list opens in the top layer, so
 * a dialog never clips it.
 *
 * @fires ui-change - a different option was picked, detail `{ value }`
 */
export class UiSelect extends LitElement {
  static formAssociated = true;

  static override properties = {
    label: { type: String },
    hint: { type: String },
    placeholder: { type: String },
    value: { type: String },
    name: { type: String, reflect: true },
    options: { attribute: false },
    required: { type: Boolean, reflect: true },
    optional: { type: Boolean },
    readonly: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    state: { type: String, reflect: true },
    message: { type: String },
    open: { type: Boolean, reflect: true },
    active: { state: true },
  };

  declare label: string;
  declare hint: string;
  declare placeholder: string;
  declare value: string;
  declare name: string;
  declare options: (SelectOption | string)[];
  declare required: boolean;
  declare optional: boolean;
  declare readonly: boolean;
  declare disabled: boolean;
  /** The choices are still loading: a hairline runs and it won't open. */
  declare busy: boolean;
  declare state: FieldState;
  declare message: string;
  declare open: boolean;
  declare active: number;

  private internals?: ElementInternals;
  private ids = { trigger: uid('select'), list: uid('list'), label: uid('label'), hint: uid('hint'), msg: uid('msg') };
  private typed = '';
  private typedAt = 0;

  constructor() {
    super();
    this.label = '';
    this.hint = '';
    this.placeholder = 'Choose one';
    this.value = '';
    this.name = '';
    this.options = [];
    this.required = false;
    this.optional = false;
    this.readonly = false;
    this.disabled = false;
    this.busy = false;
    this.state = 'idle';
    this.message = '';
    this.open = false;
    this.active = -1;
    try {
      this.internals = this.attachInternals();
    } catch {
      // Not supported (some test DOMs): it still works, just not as a form control.
    }
  }

  get choices(): SelectOption[] {
    return normalise(this.options);
  }

  get selected(): SelectOption | undefined {
    return this.choices.find((o) => o.value === this.value);
  }

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('scroll', this.onViewportChange, true);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('scroll', this.onViewportChange, true);
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('value')) this.internals?.setFormValue(this.value);
    if (changed.has('open')) this.placeList();
  }

  private get trigger(): HTMLButtonElement | null {
    return this.renderRoot.querySelector('.box');
  }

  private get list(): HTMLElement | null {
    return this.renderRoot.querySelector('.list');
  }

  override focus(options?: FocusOptions) {
    this.trigger?.focus(options);
  }

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

  /** Check it now, as a form's primary does. Returns true when nothing needs fixing. */
  check(): boolean {
    if (this.required && !this.value) {
      this.setState('attention', 'Needs you.');
      return false;
    }
    if (this.state === 'attention') this.setState('idle');
    return this.state !== 'error';
  }

  private get canOpen() {
    return !this.readonly && !this.disabled && !this.busy && this.choices.length > 0;
  }

  show() {
    if (!this.canOpen || this.open) return;
    const chosen = this.choices.findIndex((o) => o.value === this.value);
    this.active = chosen >= 0 ? chosen : this.step(-1, 1);
    this.open = true;
  }

  hide() {
    this.open = false;
  }

  private pick(index: number) {
    const option = this.choices[index];
    if (!option || option.disabled) return;
    this.hide();
    this.trigger?.focus();
    if (option.value === this.value) return;
    this.value = option.value;
    if (this.state === 'attention' || this.state === 'error') this.setState('idle');
    this.dispatchEvent(new CustomEvent('ui-change', { detail: { value: this.value }, bubbles: true, composed: true }));
  }

  /** The next option that can be picked from `from`, going `dir`; stays put at the ends. */
  private step(from: number, dir: 1 | -1): number {
    const all = this.choices;
    for (let i = from + dir; i >= 0 && i < all.length; i += dir) if (!all[i].disabled) return i;
    return from;
  }

  private typeAhead(key: string) {
    const now = Date.now();
    this.typed = now - this.typedAt > 700 ? key : this.typed + key;
    this.typedAt = now;
    const match = this.choices.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(this.typed.toLowerCase()));
    if (match < 0) return;
    if (this.open) this.active = match;
    else this.pick(match);
  }

  private onKey(e: KeyboardEvent) {
    const last = this.choices.length;
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (!this.open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && this.canOpen) {
        stop();
        this.show();
      } else if (e.key.length === 1 && /\S/.test(e.key) && this.canOpen) {
        this.typeAhead(e.key);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        stop();
        this.active = this.step(this.active, 1);
        break;
      case 'ArrowUp':
        stop();
        this.active = this.step(this.active, -1);
        break;
      case 'Home':
        stop();
        this.active = this.step(-1, 1);
        break;
      case 'End':
        stop();
        this.active = this.step(last, -1);
        break;
      case 'Enter':
      case ' ':
        stop();
        this.pick(this.active);
        break;
      case 'Escape':
        // Used up here, so a dialog stays open and the shell doesn't go back.
        stop();
        this.hide();
        break;
      case 'Tab':
        this.hide();
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) this.typeAhead(e.key);
    }
  }

  private onOutside = (e: Event) => {
    if (this.open && !e.composedPath().includes(this)) this.hide();
  };

  private onViewportChange = (e: Event) => {
    if (!this.open) return;
    if (e.type === 'scroll' && e.composedPath().includes(this.list as EventTarget)) return;
    this.placeList();
  };

  /** In the top layer when the browser has popovers, placed under the line. */
  private placeList() {
    const list = this.list;
    const box = this.trigger;
    if (!list || !box) return;
    const popover = typeof list.showPopover === 'function';
    if (!this.open) {
      if (popover && list.matches(':popover-open')) list.hidePopover();
      return;
    }
    if (!popover) return;
    const r = box.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    list.style.left = `${r.left}px`;
    list.style.width = `${r.width}px`;
    if (below < 220 && r.top > below) {
      list.style.top = 'auto';
      list.style.bottom = `${window.innerHeight - r.top + 8}px`;
    } else {
      list.style.bottom = 'auto';
      list.style.top = `${r.bottom + 8}px`;
    }
    if (!list.matches(':popover-open')) list.showPopover();
    list.querySelector('[aria-selected="true"], .active')?.scrollIntoView?.({ block: 'nearest' });
  }

  static override styles = [
    base,
    fieldParts,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; position: relative; }
      :host([disabled]) { opacity: 0.4; pointer-events: none; }
      .box {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        width: 100%;
        min-height: 44px;
        padding: 0;
        border: 0;
        border-bottom: 1px solid var(--hairline-strong);
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: border-color var(--motion-base) var(--ease-standard), box-shadow var(--motion-base) var(--ease-standard);
      }
      .box:hover { border-bottom-color: color-mix(in srgb, var(--ink) 50%, transparent); }
      .box:focus-visible, :host([open]) .box { outline: none; border-bottom-color: var(--focus) !important; box-shadow: 0 1px 0 var(--focus) !important; }
      .value {
        flex: 1;
        min-width: 0;
        padding: var(--space-3) 0;
        font-size: var(--type-body);
        line-height: var(--leading-body);
        color: color-mix(in srgb, var(--ink-muted) 75%, transparent);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .value.filled { color: var(--ink); }
      .chev { flex: none; display: flex; color: var(--ink-muted); transition: transform var(--motion-base) var(--ease-standard); }
      :host([open]) .chev { transform: rotate(180deg); color: var(--ink); }
      .none .chev { opacity: 0.3; }
      :host([state='attention']) .box { border-bottom-color: var(--green); box-shadow: 0 1px 0 var(--green); }
      :host([state='error']) .box { border-bottom-color: var(--danger); box-shadow: 0 1px 0 var(--danger); }
      :host([state='warning']) .box { border-bottom-color: var(--warning); }
      :host([readonly]) .box { border-bottom-style: dashed; box-shadow: none; cursor: default; }
      :host([readonly]) .value { color: var(--ink-muted); }
      :host([busy]) .box { cursor: default; }
      :host([busy]) .box::after {
        content: '';
        position: absolute;
        bottom: -1px;
        height: 1px;
        background: var(--ink);
        animation: ui-run var(--motion-run) var(--ease-standard) infinite;
      }
      .list {
        position: absolute;
        z-index: 3;
        left: 0;
        right: 0;
        top: calc(100% + var(--space-2));
        margin: 0;
        padding: var(--space-2) 0;
        list-style: none;
        max-height: 280px;
        overflow: auto;
        background: color-mix(in srgb, var(--slate) 94%, transparent);
        backdrop-filter: blur(var(--surface-blur)) saturate(1.25);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-inset);
        box-shadow: var(--shadow-raised);
        color: var(--ink);
        font-family: var(--font-sans);
      }
      .list[popover] { position: fixed; right: auto; inset-inline: auto; }
      .list[hidden] { display: none; }
      .opt { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); cursor: pointer; font-size: var(--type-body); line-height: var(--leading-body); }
      .opt.active { background: color-mix(in srgb, var(--ink) 8%, transparent); }
      .opt[aria-disabled='true'] { opacity: 0.4; cursor: default; }
      .tick { flex: none; display: flex; color: var(--ink); visibility: hidden; }
      .opt[aria-selected='true'] .tick { visibility: visible; }
      .text { display: flex; flex: 1; min-width: 0; justify-content: space-between; align-items: baseline; gap: var(--space-4); }
      .text em { font-style: normal; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
    `,
  ];

  override render() {
    const choices = this.choices;
    const none = !this.busy && choices.length === 0;
    const shown = this.busy ? 'Loading the choices…' : none ? 'Nothing to choose yet' : (this.selected?.label ?? this.placeholder);
    const describedBy = [this.hint ? this.ids.hint : '', this.message ? this.ids.msg : ''].filter(Boolean).join(' ');
    const activeId = this.open && this.active >= 0 ? `${this.ids.list}-${this.active}` : '';
    return html`
      <div class="head">
        <span class="name" id=${this.ids.label}>${this.label}</span>
        ${this.required
          ? html`<span class="flag"><i class="dot" aria-hidden="true"></i>Required</span>`
          : this.optional
            ? html`<span class="flag">Optional</span>`
            : nothing}
      </div>
      ${this.hint ? html`<p class="hint" id=${this.ids.hint}>${this.hint}</p>` : nothing}
      <div class=${none ? 'none' : ''} style="position:relative">
        <button
          id=${this.ids.trigger}
          class="box"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded=${String(this.open)}
          aria-controls=${this.ids.list}
          aria-labelledby="${this.ids.label} ${this.ids.trigger}"
          aria-describedby=${describedBy || nothing}
          aria-invalid=${this.state === 'error' || this.state === 'attention' ? 'true' : 'false'}
          aria-activedescendant=${activeId || nothing}
          aria-readonly=${this.readonly ? 'true' : nothing}
          ?disabled=${this.disabled}
          @click=${() => (this.open ? this.hide() : this.show())}
          @keydown=${this.onKey}
          @blur=${() => this.required && !this.value && !this.open && this.check()}
        >
          <span class="value ${this.selected ? 'filled' : ''}">${shown}</span>
          <span class="chev" aria-hidden="true"><ui-icon name="chevron-down" size="20"></ui-icon></span>
        </button>
        <ul class="list" id=${this.ids.list} role="listbox" aria-labelledby=${this.ids.label} popover="manual" ?hidden=${!this.open}>
          ${choices.map(
            (o, i) => html`<li
              id="${this.ids.list}-${i}"
              class="opt ${i === this.active ? 'active' : ''}"
              role="option"
              aria-selected=${String(o.value === this.value)}
              aria-disabled=${o.disabled ? 'true' : nothing}
              @pointerenter=${() => !o.disabled && (this.active = i)}
              @click=${() => this.pick(i)}
            >
              <span class="tick" aria-hidden="true"><ui-icon name="check" size="16"></ui-icon></span>
              <span class="text"><span>${o.label}</span>${o.detail ? html`<em>${o.detail}</em>` : nothing}</span>
            </li>`,
          )}
        </ul>
      </div>
      <p class="msg" id=${this.ids.msg} aria-live="polite">${this.message}</p>
    `;
  }
}

if (!customElements.get('ui-select')) customElements.define('ui-select', UiSelect);

declare global {
  interface HTMLElementTagNameMap {
    'ui-select': UiSelect;
  }
}
