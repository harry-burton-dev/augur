import { LitElement, css, html, nothing } from 'lit';
import { base, fieldParts, uid } from '../shared.js';
import type { SelectOption } from './select.js';
import './icon.js';
import './tag.js';

/** A tag to pick from. `detail` is a quiet word beside it, such as "Org". */
export type TagOption = SelectOption & { icon?: string };

/**
 * Pick any number of tags from a vocabulary by typing: what's chosen shows as
 * tags in the field, the rest narrow as you type. With `creatable`, a word that
 * isn't there yet can be added: the picker asks the app with `ui-create`, and the
 * app adds the option (and the value) once it exists.
 *
 * Its `value` is the chosen values joined with commas, so a dialog collects it
 * like a field; `values` is the list.
 *
 * Keys: type to narrow, ↓ ↑ move, Enter picks (or adds), Backspace in an empty
 * field takes the last tag off, Esc closes the list.
 *
 * @fires ui-change - detail `{ values }`
 * @fires ui-create - detail `{ name }`, a word to add as a new tag
 */
export class UiTagPicker extends LitElement {
  static override properties = {
    label: { type: String },
    hint: { type: String },
    placeholder: { type: String },
    name: { type: String, reflect: true },
    options: { attribute: false },
    values: { attribute: false },
    creatable: { type: Boolean },
    optional: { type: Boolean },
    max: { type: Number },
    disabled: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    typed: { state: true },
    active: { state: true },
  };

  declare label: string;
  declare hint: string;
  declare placeholder: string;
  declare name: string;
  declare options: TagOption[];
  declare values: string[];
  /** A word that isn't a tag yet can be added. */
  declare creatable: boolean;
  declare optional: boolean;
  /** The most it takes; 0 for no limit. */
  declare max: number;
  declare disabled: boolean;
  declare open: boolean;
  declare typed: string;
  declare active: number;

  private ids = { input: uid('tags'), list: uid('list'), label: uid('label'), hint: uid('hint') };

  constructor() {
    super();
    this.label = '';
    this.hint = '';
    this.placeholder = 'Type to find a tag';
    this.name = '';
    this.options = [];
    this.values = [];
    this.creatable = false;
    this.optional = false;
    this.max = 0;
    this.disabled = false;
    this.open = false;
    this.typed = '';
    this.active = 0;
  }

  get value(): string {
    return this.values.join(',');
  }

  /** Nothing to fix in a choice of tags; a dialog asks every field. */
  check() {
    return true;
  }

  override focus(options?: FocusOptions) {
    this.input?.focus(options);
  }

  private get input() {
    return this.renderRoot.querySelector<HTMLInputElement>('input');
  }

  private get full() {
    return this.max > 0 && this.values.length >= this.max;
  }

  /** What the list offers now: the unchosen options that match what's typed, then "Add …" when it may. */
  get choices(): { option?: TagOption; add?: string }[] {
    const word = this.typed.trim().toLocaleLowerCase();
    const found = this.options.filter((o) => !this.values.includes(o.value) && (!word || o.label.toLocaleLowerCase().includes(word)));
    // Ones that start with the word first, then the rest, each by name.
    found.sort((a, b) => Number(!a.label.toLocaleLowerCase().startsWith(word)) - Number(!b.label.toLocaleLowerCase().startsWith(word)) || a.label.localeCompare(b.label));
    const rows: { option?: TagOption; add?: string }[] = found.map((option) => ({ option }));
    const exact = this.options.some((o) => o.label.toLocaleLowerCase() === word);
    if (this.creatable && word && !exact) rows.push({ add: this.typed.trim() });
    return rows;
  }

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onOutside, true);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onOutside, true);
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('open') || changed.has('typed') || changed.has('values')) this.placeList();
  }

  private onOutside = (e: Event) => {
    if (this.open && !e.composedPath().includes(this)) this.open = false;
  };

  private change(values: string[]) {
    this.values = values;
    this.dispatchEvent(new CustomEvent('ui-change', { detail: { values }, bubbles: true, composed: true }));
  }

  private pick(row: { option?: TagOption; add?: string } | undefined) {
    if (!row || this.full) return;
    if (row.option) this.change([...this.values, row.option.value]);
    else if (row.add) this.dispatchEvent(new CustomEvent('ui-create', { detail: { name: row.add }, bubbles: true, composed: true }));
    this.typed = '';
    this.active = 0;
    this.input?.focus();
  }

  private unpick(value: string) {
    this.change(this.values.filter((v) => v !== value));
    this.input?.focus();
  }

  private onKey(e: KeyboardEvent) {
    const rows = this.choices;
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case 'ArrowDown':
        stop();
        if (!this.open) this.open = true;
        else this.active = Math.min(this.active + 1, rows.length - 1);
        break;
      case 'ArrowUp':
        stop();
        this.active = Math.max(this.active - 1, 0);
        break;
      case 'Enter':
        // Enter in the field picks; it never submits the dialog round it.
        stop();
        if (this.open || this.typed) this.pick(rows[this.active]);
        break;
      case 'Escape':
        if (!this.open) return;
        // Used up here, so a dialog stays open.
        stop();
        this.open = false;
        break;
      case 'Backspace':
        if (!this.typed && this.values.length) this.unpick(this.values[this.values.length - 1]);
        break;
      case 'Tab':
        this.open = false;
        break;
    }
  }

  /** In the top layer when the browser has popovers, under the field. */
  private placeList() {
    const list = this.renderRoot.querySelector<HTMLElement>('.list');
    const box = this.renderRoot.querySelector<HTMLElement>('.box');
    if (!list || !box || typeof list.showPopover !== 'function') return;
    const showing = this.open && !this.disabled && this.choices.length > 0;
    if (!showing) {
      if (list.matches(':popover-open')) list.hidePopover();
      return;
    }
    const r = box.getBoundingClientRect();
    list.style.left = `${r.left}px`;
    list.style.width = `${r.width}px`;
    list.style.top = `${r.bottom + 8}px`;
    if (!list.matches(':popover-open')) list.showPopover();
  }

  static override styles = [
    base,
    fieldParts,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
      :host([disabled]) { opacity: 0.4; pointer-events: none; }
      .box {
        display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); min-height: 44px; padding: var(--space-2) 0;
        border-bottom: 1px solid var(--hairline-strong); cursor: text;
        transition: border-color var(--motion-base) var(--ease-standard), box-shadow var(--motion-base) var(--ease-standard);
      }
      .box:hover { border-bottom-color: color-mix(in srgb, var(--ink) 50%, transparent); }
      .box:focus-within { border-bottom-color: var(--focus); box-shadow: 0 1px 0 var(--focus); }
      input {
        flex: 1; min-width: 8ch; padding: var(--space-1) 0; border: 0; background: none; outline: none;
        color: var(--ink); font: inherit; font-size: var(--type-body); line-height: var(--leading-body);
      }
      input::placeholder { color: color-mix(in srgb, var(--ink-muted) 75%, transparent); }
      .list {
        position: absolute; margin: 0; padding: var(--space-2) 0; list-style: none; max-height: 240px; overflow: auto;
        background: color-mix(in srgb, var(--slate) 94%, transparent); backdrop-filter: blur(var(--surface-blur)) saturate(1.25);
        border: 1px solid var(--hairline); border-radius: var(--radius-inset); box-shadow: var(--shadow-raised); color: var(--ink);
      }
      .list[popover] { position: fixed; inset-inline: auto; }
      .list[hidden] { display: none; }
      .opt { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-4); cursor: pointer; font-size: var(--type-meta); line-height: var(--leading-meta); }
      .opt.active { background: color-mix(in srgb, var(--ink) 8%, transparent); }
      .opt .word { flex: 1; }
      .opt em { font-style: normal; font-size: var(--type-small); color: var(--ink-muted); }
      ui-icon { color: var(--ink-muted); }
      .full { font-size: var(--type-small); color: var(--ink-muted); }
    `,
  ];

  override render() {
    const rows = this.choices;
    const shown = this.open && !this.disabled && rows.length > 0;
    const active = Math.min(this.active, rows.length - 1);
    const optionFor = (value: string) => this.options.find((o) => o.value === value);
    return html`
      <div class="head">
        <label class="name" id=${this.ids.label} for=${this.ids.input}>${this.label}</label>
        ${this.optional ? html`<span class="flag">Optional</span>` : nothing}
      </div>
      ${this.hint ? html`<p class="hint" id=${this.ids.hint}>${this.hint}</p>` : nothing}
      <div class="box" @click=${() => this.input?.focus()}>
        ${this.values.map((v) => {
          const option = optionFor(v);
          return html`<ui-tag removable label=${option?.label ?? v} icon=${option?.icon ?? ''} @ui-remove=${() => this.unpick(v)}></ui-tag>`;
        })}
        ${this.full
          ? html`<span class="full">${this.max} at most</span>`
          : html`<input
              id=${this.ids.input}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded=${String(shown)}
              aria-controls=${this.ids.list}
              aria-activedescendant=${shown && active >= 0 ? `${this.ids.list}-${active}` : nothing}
              aria-describedby=${this.hint ? this.ids.hint : nothing}
              autocomplete="off"
              placeholder=${this.values.length ? '' : this.placeholder}
              .value=${this.typed}
              ?disabled=${this.disabled}
              @focus=${() => (this.open = true)}
              @input=${(e: Event) => {
                this.typed = (e.target as HTMLInputElement).value;
                this.active = 0;
                this.open = true;
              }}
              @keydown=${this.onKey}
            />`}
      </div>
      <ul class="list" id=${this.ids.list} role="listbox" aria-labelledby=${this.ids.label} popover="manual" ?hidden=${!shown}>
        ${rows.map(
          (row, i) => html`<li
            id="${this.ids.list}-${i}"
            class="opt ${i === active ? 'active' : ''}"
            role="option"
            aria-selected="false"
            @pointerenter=${() => (this.active = i)}
            @pointerdown=${(e: Event) => e.preventDefault()}
            @click=${() => this.pick(row)}
          >
            ${row.option
              ? html`<ui-icon name=${row.option.icon ?? 'tag'} size="16"></ui-icon><span class="word">${row.option.label}</span>${row.option.detail ? html`<em>${row.option.detail}</em>` : nothing}`
              : html`<ui-icon name="plus" size="16"></ui-icon><span class="word">Add “${row.add}”</span>`}
          </li>`,
        )}
      </ul>
    `;
  }
}

if (!customElements.get('ui-tag-picker')) customElements.define('ui-tag-picker', UiTagPicker);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tag-picker': UiTagPicker;
  }
}
