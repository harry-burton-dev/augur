import { LitElement, css, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { base, uid } from '../shared.js';
import { fieldChrome, fieldHead } from './field-chrome.js';
import type { FieldState } from './text-field.js';
import './icon.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');
/** A local day as YYYY-MM-DD. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const real = (y: number, m: number, d: number) => {
  const at = new Date(y, m, d);
  return at.getFullYear() === y && at.getMonth() === m && at.getDate() === d ? at : null;
};

/**
 * A day typed in words, as people say it: "13 nov", "nov 13 2027", "13/11",
 * "2026-11-13", "today", "tomorrow", "friday" (the next one), "end of week",
 * "end of month", "+2w", "+3d", "-1m". Returns YYYY-MM-DD, or null when it
 * isn't a day.
 */
export const parseDay = (text: string, now = new Date()): string | null => {
  const t = text.trim().toLowerCase().replace(/[,.]/g, ' ').replace(/\s+/g, ' ');
  const today = startOf(now);
  if (!t) return null;
  if (t === 'today' || t === 'now') return isoDay(today);
  if (t === 'tomorrow') return isoDay(new Date(today.getTime() + DAY_MS));
  if (t === 'yesterday') return isoDay(new Date(today.getTime() - DAY_MS));
  if (t === 'end of week') return isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((5 - today.getDay() + 7) % 7)));
  if (t === 'end of month') return isoDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const shift = /^([+-])\s?(\d{1,3})\s?(d|day|days|w|wk|week|weeks|m|month|months|y|year|years)$/.exec(t);
  if (shift) {
    const n = Number(shift[2]) * (shift[1] === '-' ? -1 : 1);
    const unit = shift[3]![0];
    const at = new Date(today);
    if (unit === 'd') at.setDate(at.getDate() + n);
    else if (unit === 'w') at.setDate(at.getDate() + n * 7);
    else if (unit === 'm') at.setMonth(at.getMonth() + n);
    else at.setFullYear(at.getFullYear() + n);
    return isoDay(at);
  }
  const weekday = DAYS.findIndex((d) => t === d || (t.length > 3 && d === t.slice(0, 3) && /^[a-z]+$/.test(t)));
  if (weekday >= 0) return isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + (((weekday - today.getDay() + 7) % 7) || 7)));
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return ((d) => (d ? isoDay(d) : null))(real(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getFullYear();
    return ((d) => (d ? isoDay(d) : null))(real(y, Number(m[2]) - 1, Number(m[1])));
  }
  // "13 nov", "13 november 2027", "nov 13", "fri 13 nov": a weekday in front is allowed and ignored.
  const words = t.split(' ').filter((w) => !DAYS.includes(w.slice(0, 3)) || /\d/.test(w) || MONTHS.includes(w.slice(0, 3)));
  const month = words.findIndex((w) => /^[a-z]+$/.test(w) && MONTHS.includes(w.slice(0, 3)));
  const numbers = words.filter((w) => /^\d+(st|nd|rd|th)?$/.test(w)).map((w) => parseInt(w, 10));
  if (month >= 0 && numbers.length >= 1 && numbers.length <= 2 && words.length === numbers.length + 1) {
    const mi = MONTHS.indexOf(words[month]!.slice(0, 3));
    const [day, year] = numbers[0]! > 31 ? [numbers[1], numbers[0]] : numbers;
    if (!day) return null;
    const d = real(year ?? today.getFullYear(), mi, day);
    return d ? isoDay(d) : null;
  }
  return null;
};

/** A day in words: "Fri 13 Nov", with the year when it isn't this one. */
export const dayName = (iso: string, now = new Date()) => {
  const d = fromIso(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) }).replace(',', '');
};

/** How far a day is from today, in words: "today", "in 15 days", "3 days ago". */
export const dayDistance = (iso: string, now = new Date()) => {
  const n = Math.round((fromIso(iso).getTime() - startOf(now).getTime()) / DAY_MS);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
};

/** One quick choice beside the field: its words, and what it means in words `parseDay` reads. */
export interface DateQuick {
  label: string;
  value: string;
}

/**
 * A day, said in words ("Fri 13 Nov · in 15 days") and typed in words
 * ("13 nov", "friday", "+2w"), with up to four quick choices under it and the
 * calendar one press away. Empty, it says its `empty` words ("Not set",
 * "Still holds"). Its value is YYYY-MM-DD.
 *
 * Takes part in forms and in `ui-dialog` like `ui-text-field`.
 *
 * @fires ui-change - when the day changes, detail `{ value }`
 */
export class UiDate extends LitElement {
  static formAssociated = true;

  static override properties = {
    label: { type: String },
    hint: { type: String },
    value: { type: String },
    name: { type: String, reflect: true },
    required: { type: Boolean, reflect: true },
    optional: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
    empty: { type: String },
    quick: { attribute: false },
    state: { type: String, reflect: true },
    message: { type: String },
    draft: { state: true },
  };

  declare label: string;
  declare hint: string;
  /** YYYY-MM-DD, or empty. */
  declare value: string;
  declare name: string;
  declare required: boolean;
  declare optional: boolean;
  declare disabled: boolean;
  /** What an empty day says when you're not typing: "Not set", "Still holds", "Today". */
  declare empty: string;
  /** Up to four quick choices; extras are dropped. */
  declare quick: DateQuick[];
  declare state: FieldState;
  declare message: string;
  /** What's being typed; undefined while not typing. */
  declare draft: string | undefined;
  /** Today, for words and quick choices. Tests set it. */
  now = new Date();

  private internals?: ElementInternals;
  private ids = { input: uid('date'), hint: uid('hint'), msg: uid('msg') };

  constructor() {
    super();
    this.label = '';
    this.hint = '';
    this.value = '';
    this.name = '';
    this.required = false;
    this.optional = false;
    this.disabled = false;
    this.empty = 'Not set';
    this.quick = [
      { label: 'End of week', value: 'end of week' },
      { label: 'End of month', value: 'end of month' },
      { label: 'In two weeks', value: '+2w' },
    ];
    this.state = 'idle';
    this.message = '';
    this.draft = undefined;
    try {
      this.internals = this.attachInternals();
    } catch {
      // Not supported (some test DOMs): the field still works, just not as a form control.
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('value')) this.internals?.setFormValue(this.value);
  }

  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector<HTMLInputElement>('.input')?.focus(options);
  }

  setState(state: FieldState, message = '') {
    this.state = state;
    this.message = message;
    const invalid = state === 'error' || state === 'attention';
    this.internals?.setValidity(invalid ? { customError: true } : {}, invalid ? message || 'Needs you.' : '');
  }

  /** Check the field now, as a form's primary does. Returns true when nothing needs fixing. */
  check(): boolean {
    if (this.draft !== undefined) this.commit();
    if (this.state === 'error') return false;
    if (this.required && !this.value) {
      this.setState('attention', 'Needs you.');
      return false;
    }
    this.setState('idle');
    return true;
  }

  /** Set the day; empty clears it. */
  choose(iso: string) {
    const changed = iso !== this.value;
    this.value = iso;
    this.draft = undefined;
    this.setState('idle');
    if (changed) this.dispatchEvent(new CustomEvent('ui-change', { detail: { value: this.value }, bubbles: true, composed: true }));
  }

  private commit() {
    const draft = this.draft ?? '';
    if (!draft.trim()) return this.choose('');
    const day = parseDay(draft, this.now);
    if (day) return this.choose(day);
    this.setState('error', 'Try “13 Nov”, “friday” or “+2w”.');
  }

  private words() {
    return this.value ? `${dayName(this.value, this.now)} · ${dayDistance(this.value, this.now)}` : '';
  }

  static override styles = [
    base,
    fieldChrome,
    css`
      .input { cursor: text; }
      .cal { all: unset; cursor: pointer; display: grid; place-items: center; width: 28px; height: 28px; border-radius: var(--radius-key); color: var(--ink-muted); }
      .cal:hover { color: var(--ink); }
      .cal:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .native { position: absolute; right: 0; bottom: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; border: 0; padding: 0; }
      .quicks { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    `,
  ];

  override render() {
    const typing = this.draft !== undefined;
    const describedBy = [this.hint ? this.ids.hint : '', this.message ? this.ids.msg : ''].filter(Boolean).join(' ');
    const quick = this.quick.slice(0, 4);
    return html`${fieldHead(this.label, this.ids.input, this.required, this.optional)}
      ${this.hint ? html`<p class="hint" id=${this.ids.hint}>${this.hint}</p>` : nothing}
      <div class="box" part="box">
        <input id=${this.ids.input} class="input" autocomplete="off"
          .value=${live(typing ? this.draft! : this.words())}
          placeholder=${this.empty || nothing}
          ?disabled=${this.disabled}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${this.state === 'error' || this.state === 'attention' ? 'true' : 'false'}
          @focus=${() => (this.draft = this.value ? dayName(this.value, new Date(0)) : '')}
          @input=${(e: Event) => {
            this.draft = (e.target as HTMLInputElement).value;
            if (this.state === 'error' || this.state === 'attention') this.setState('idle');
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              this.commit();
            } else if (e.key === 'Escape' && typing) {
              this.draft = undefined;
              this.setState('idle');
            }
          }}
          @blur=${() => typing && this.commit()} />
        <button class="cal" type="button" aria-label="Choose on a calendar" @click=${() => {
          const native = this.renderRoot.querySelector<HTMLInputElement>('.native');
          try {
            native?.showPicker();
          } catch {
            native?.focus();
          }
        }}><ui-icon name="calendar" size="16" aria-hidden="true"></ui-icon></button>
        <input class="native" type="date" tabindex="-1" aria-hidden="true" .value=${live(this.value)}
          @change=${(e: Event) => this.choose((e.target as HTMLInputElement).value)} />
      </div>
      ${quick.length || (this.value && !this.required)
        ? html`<div class="quicks">
            ${quick.map((q) => html`<button class="quiet" type="button" @click=${() => this.choose(parseDay(q.value, this.now) ?? '')}>${q.label}</button>`)}
            ${this.value && !this.required ? html`<button class="quiet" type="button" @click=${() => this.choose('')}>Clear</button>` : nothing}
          </div>`
        : nothing}
      <p class="msg" id=${this.ids.msg} aria-live="polite">${this.message}</p>`;
  }
}

if (!customElements.get('ui-date')) customElements.define('ui-date', UiDate);

declare global {
  interface HTMLElementTagNameMap {
    'ui-date': UiDate;
  }
}
