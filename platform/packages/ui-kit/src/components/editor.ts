import { LitElement, css, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { base, uid } from '../shared.js';
import { fieldChrome, fieldHead } from './field-chrome.js';
import { refIcon, refName, type RefKind, type RefShown } from './ref.js';
import type { FieldState } from './text-field.js';
import './ref.js';
import './icon.js';

/** One thing named in the text: how it reads there ("@Nora Briggs") and what it points at. */
interface Mention {
  text: string;
  ref: RefShown;
}

/** What a mention search found, and how many more there are that the person can't open. */
export interface MentionResult {
  found: RefShown[];
  closedCount?: number;
  /** Where those are kept and who to ask: "Kept on Finance." */
  closedReason?: string;
}

/** Finds what `@` (people and teams) or `#` (things and intents) could mean. The app asks through the SDK. */
export type MentionSource = (trigger: '@' | '#', query: string) => Promise<MentionResult>;

const KINDS: RefKind[] = ['entity', 'document', 'intent', 'person', 'team'];
const GROUP: Record<RefKind, string> = { person: 'People', team: 'Teams', entity: 'Things', intent: 'Intents', document: 'Documents' };
const LINK = /\[([@#][^\]\n]+)\]\((entity|document|intent|person|team):([^)\s]+)\)/g;

/** Markdown with mentions as links (`[@Nora Briggs](person:u1)`), read into the text people see and what each mention points at. */
export const readMentions = (markdown: string): { text: string; mentions: Mention[] } => {
  const mentions: Mention[] = [];
  const text = markdown.replace(LINK, (_all, shown: string, kind: RefKind, id: string) => {
    if (!mentions.some((m) => m.text === shown)) mentions.push({ text: shown, ref: { kind, id, label: shown.slice(1) } });
    return shown;
  });
  return { text, mentions };
};

/** The text people see, with each mention still in it written back as a link. */
export const writeMentions = (text: string, mentions: Mention[]) => {
  let out = text;
  for (const m of [...mentions].sort((a, b) => b.text.length - a.text.length)) {
    const escaped = m.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(^|[^\\[\\w])${escaped}(?![\\w\\]])`, 'g'), (_all, before: string) => `${before}[${m.text}](${m.ref.kind}:${m.ref.id})`);
  }
  return out;
};

/** A soft length guide, "2 sentences", "120 words" or "600 characters", read as a number and a unit. */
const readGuide = (guide: string) => {
  const m = /^(\d+)\s*(sentence|sentences|word|words|character|characters)$/.exec(guide.trim());
  return m ? { n: Number(m[1]), unit: m[2]!.replace(/s$/, '') as 'sentence' | 'word' | 'character' } : undefined;
};
const measure = (text: string, unit: 'sentence' | 'word' | 'character') => {
  const t = text.trim();
  if (!t) return 0;
  if (unit === 'character') return t.length;
  if (unit === 'word') return t.split(/\s+/).length;
  return t.split(/(?<=[.!?])\s+(?=\S)/).filter((s) => /\w/.test(s)).length;
};

/**
 * A field for writing more than a line. It writes Markdown, and stays quiet
 * while you write: no toolbar at rest; selecting text brings a small bar
 * (bold, italic, list, quote), and Ctrl B and Ctrl I work without it. Type
 * `@` for people and teams, or `#` for things and intents, and what you choose
 * is saved as a reference; the ones in the text show as chips under it.
 *
 * A `guide` ("2 sentences") counts and says when you've gone past it, but
 * never stops you. Long writing belongs in Artifacts.
 *
 * Takes part in forms and in `ui-dialog` like `ui-text-field`.
 *
 * @fires ui-input - every change, detail `{ value }` (Markdown)
 * @fires ui-change - on leaving the field, detail `{ value }`
 */
export class UiEditor extends LitElement {
  static formAssociated = true;

  static override properties = {
    label: { type: String },
    hint: { type: String },
    placeholder: { type: String },
    value: { type: String },
    name: { type: String, reflect: true },
    required: { type: Boolean, reflect: true },
    optional: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
    rows: { type: Number },
    guide: { type: String },
    state: { type: String, reflect: true },
    message: { type: String },
    mentionSource: { attribute: false },
    text: { state: true },
    mentions: { state: true },
    asking: { state: true },
    result: { state: true },
    active: { state: true },
    selecting: { state: true },
  };

  declare label: string;
  declare hint: string;
  declare placeholder: string;
  /** Markdown, with mentions as `[@Name](kind:id)` links. */
  declare value: string;
  declare name: string;
  declare required: boolean;
  declare optional: boolean;
  declare disabled: boolean;
  declare rows: number;
  /** A soft guide: "2 sentences", "120 words" or "600 characters". */
  declare guide: string;
  declare state: FieldState;
  declare message: string;
  declare mentionSource: MentionSource | undefined;
  declare text: string;
  declare mentions: Mention[];
  /** The mention being typed: its trigger, what follows it, and where it starts. */
  declare asking: { trigger: '@' | '#'; query: string; at: number } | undefined;
  declare result: MentionResult | undefined;
  declare active: number;
  declare selecting: boolean;

  private internals?: ElementInternals;
  private ids = { input: uid('editor'), hint: uid('hint'), msg: uid('msg'), list: uid('mentions') };
  private written = '';
  private asked = 0;

  constructor() {
    super();
    this.label = '';
    this.hint = '';
    this.placeholder = '';
    this.value = '';
    this.name = '';
    this.required = false;
    this.optional = false;
    this.disabled = false;
    this.rows = 3;
    this.guide = '';
    this.state = 'idle';
    this.message = '';
    this.text = '';
    this.mentions = [];
    this.active = 0;
    this.selecting = false;
    try {
      this.internals = this.attachInternals();
    } catch {
      // Not supported (some test DOMs): the field still works, just not as a form control.
    }
  }

  /** What the text points at: each mention still in it, once. */
  get refs(): RefShown[] {
    return readMentions(this.value).mentions.map((m) => m.ref);
  }

  override willUpdate(changed: Map<string, unknown>) {
    // A value set from outside is read into text and mentions; one we wrote ourselves is already there.
    if (changed.has('value') && this.value !== this.written) {
      const { text, mentions } = readMentions(this.value);
      this.text = text;
      this.mentions = mentions;
      this.written = this.value;
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('value')) this.internals?.setFormValue(this.value);
    if (changed.has('text')) this.grow();
  }

  private get area() {
    return this.renderRoot.querySelector<HTMLTextAreaElement>('textarea');
  }

  override focus(options?: FocusOptions) {
    this.area?.focus(options);
  }

  setState(state: FieldState, message = '') {
    this.state = state;
    this.message = message;
    const invalid = state === 'error' || state === 'attention';
    this.internals?.setValidity(invalid ? { customError: true } : {}, invalid ? message || 'Needs you.' : '');
  }

  /** Check the field now, as a form's primary does. Returns true when nothing needs fixing. */
  check(): boolean {
    if (this.required && !this.text.trim()) {
      this.setState('attention', 'Needs you.');
      return false;
    }
    this.setState('idle');
    return true;
  }

  private grow() {
    const el = this.area;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`;
  }

  /** Takes new text (and where the caret goes), keeps only the mentions still in it, and writes the value. */
  private write(text: string, caret?: number) {
    this.text = text;
    this.mentions = this.mentions.filter((m) => text.includes(m.text));
    this.value = this.written = writeMentions(text, this.mentions);
    if (this.state === 'attention' || this.state === 'error') this.setState('idle');
    this.dispatchEvent(new CustomEvent('ui-input', { detail: { value: this.value }, bubbles: true, composed: true }));
    if (caret !== undefined) {
      void this.updateComplete.then(() => {
        this.area?.setSelectionRange(caret, caret);
        this.area?.focus();
      });
    }
  }

  private onInput(e: Event) {
    const area = e.target as HTMLTextAreaElement;
    this.write(area.value);
    this.lookForMention(area);
  }

  private lookForMention(area: HTMLTextAreaElement) {
    if (!this.mentionSource) return;
    const before = area.value.slice(0, area.selectionStart);
    const m = /(^|\s)([@#])([^\s@#[\]()]{0,40})$/.exec(before);
    if (!m) return this.closeMentions();
    const trigger = m[2] as '@' | '#';
    const query = m[3]!;
    this.asking = { trigger, query, at: before.length - query.length - 1 };
    const asked = ++this.asked;
    void this.mentionSource(trigger, query).then(
      (result) => {
        if (asked !== this.asked) return;
        this.result = result;
        this.active = 0;
      },
      () => asked === this.asked && (this.result = { found: [] }),
    );
  }

  private closeMentions() {
    this.asking = undefined;
    this.result = undefined;
    this.asked++;
  }

  /** Puts the chosen thing in place of what was typed after `@` or `#`. */
  mention(ref: RefShown) {
    const asking = this.asking;
    if (!asking) return;
    const shown = `${asking.trigger}${refName(ref)}`;
    const end = asking.at + 1 + asking.query.length;
    const text = `${this.text.slice(0, asking.at)}${shown} ${this.text.slice(end)}`;
    if (!this.mentions.some((m) => m.text === shown)) this.mentions = [...this.mentions, { text: shown, ref }];
    this.closeMentions();
    this.write(text, asking.at + shown.length + 1);
  }

  private onKeydown(e: KeyboardEvent) {
    const found = this.result?.found ?? [];
    if (this.asking && found.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.active = (this.active + (e.key === 'ArrowDown' ? 1 : found.length - 1)) % found.length;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this.mention(found[this.active]!);
        return;
      }
    }
    if (e.key === 'Escape' && this.asking) {
      e.stopPropagation();
      this.closeMentions();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      this.format(e.key === 'b' ? 'bold' : 'italic');
    }
  }

  /** Bold or italic wraps the selection; list and quote mark each line it touches. */
  format(kind: 'bold' | 'italic' | 'list' | 'quote') {
    const area = this.area;
    if (!area) return;
    const [start, end] = [area.selectionStart, area.selectionEnd];
    const text = this.text;
    if (kind === 'bold' || kind === 'italic') {
      const mark = kind === 'bold' ? '**' : '_';
      const chosen = text.slice(start, end);
      const wrapped = chosen.startsWith(mark) && chosen.endsWith(mark) && chosen.length >= mark.length * 2;
      const next = wrapped ? chosen.slice(mark.length, chosen.length - mark.length) : `${mark}${chosen}${mark}`;
      this.write(text.slice(0, start) + next + text.slice(end));
      void this.updateComplete.then(() => area.setSelectionRange(start, start + next.length));
      return;
    }
    const mark = kind === 'list' ? '- ' : '> ';
    const from = text.lastIndexOf('\n', start - 1) + 1;
    const lines = text.slice(from, end).split('\n');
    const all = lines.every((l) => l.startsWith(mark));
    const next = lines.map((l) => (all ? l.slice(mark.length) : l.startsWith(mark) ? l : mark + l)).join('\n');
    this.write(text.slice(0, from) + next + text.slice(end));
    void this.updateComplete.then(() => area.setSelectionRange(from, from + next.length));
  }

  private onSelect() {
    const area = this.area;
    this.selecting = Boolean(area && area.selectionEnd > area.selectionStart);
  }

  static override styles = [
    base,
    fieldChrome,
    css`
      textarea.input { overflow: hidden; min-height: calc(var(--leading-body) * 2 + var(--space-3) * 2); }
      .box { align-items: stretch; }
      .bar { position: absolute; bottom: calc(100% + var(--space-1)); right: 0; z-index: 2; display: flex; gap: 2px; padding: 3px; border-radius: var(--radius-key);
        background: var(--surface-overlay); -webkit-backdrop-filter: blur(var(--surface-blur)); backdrop-filter: blur(var(--surface-blur));
        border: 1px solid var(--hairline); box-shadow: var(--shadow-raised); }
      .bar button { all: unset; cursor: pointer; min-width: 28px; height: 26px; padding: 0 var(--space-2); box-sizing: border-box; display: grid; place-items: center; border-radius: var(--radius-key);
        font-size: var(--type-small); color: var(--ink); }
      .bar button:hover { background: var(--hairline); }
      .bar button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 1px; }
      .bar b { font-weight: 700; }
      .bar i { font-style: italic; font-family: Georgia, serif; }
      .found { margin: 0; padding: var(--space-2); list-style: none; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--hairline); border-radius: var(--radius-inset);
        background: var(--surface-pane); max-height: 260px; overflow: auto; }
      .group { padding: var(--space-2) var(--space-2) var(--space-1); font-size: var(--type-label); line-height: var(--leading-label); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--ink-muted); }
      .option { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2); border-radius: var(--radius-key); cursor: pointer; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink); }
      .option[aria-selected='true'] { background: var(--hairline); }
      .option ui-icon { color: var(--ink-muted); }
      .option small { margin-left: auto; color: var(--ink-muted); font-size: var(--type-small); }
      .closed, .none { padding: var(--space-2); font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .count.over { color: var(--warning); }
    `,
  ];

  private suggestions() {
    const result = this.result;
    if (!this.asking || !result) return nothing;
    const found = result.found;
    let last = '';
    let index = -1;
    return html`<ul class="found" id=${this.ids.list} role="listbox" aria-label=${this.asking.trigger === '@' ? 'People and teams' : 'Things and intents'}>
      ${KINDS.flatMap((kind) => found.filter((r) => r.kind === kind)).map((ref) => {
        index++;
        const i = index;
        const head = GROUP[ref.kind] !== last ? html`<li class="group" role="presentation">${GROUP[ref.kind]}</li>` : nothing;
        last = GROUP[ref.kind];
        return html`${head}<li class="option" role="option" id=${`${this.ids.list}-${i}`} aria-selected=${i === this.active ? 'true' : 'false'}
            @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.mention(ref)}>
            <ui-icon name=${refIcon(ref)} size="14" aria-hidden="true"></ui-icon>${refName(ref)}${ref.floorName ? html`<small>${ref.floorName}</small>` : nothing}
          </li>`;
      })}
      ${!found.length ? html`<li class="none" role="presentation">Nothing by that name.</li>` : nothing}
      ${result.closedCount
        ? html`<li class="closed" role="presentation">${result.closedCount} more you can’t open${result.closedReason ? `, ${result.closedReason.replace(/^./, (c) => c.toLowerCase())}` : ''}</li>`
        : nothing}
    </ul>`;
  }

  override render() {
    const guide = readGuide(this.guide);
    const used = guide ? measure(this.text, guide.unit) : 0;
    const over = Boolean(guide && used > guide.n);
    const describedBy = [this.hint ? this.ids.hint : '', this.message ? this.ids.msg : ''].filter(Boolean).join(' ');
    const open = Boolean(this.asking && this.result);
    return html`${fieldHead(this.label, this.ids.input, this.required, this.optional)}
      ${this.hint ? html`<p class="hint" id=${this.ids.hint}>${this.hint}</p>` : nothing}
      <div class="box" part="box">
        ${this.selecting
          ? html`<div class="bar" role="toolbar" aria-label="Format the selection">
              <button aria-label="Bold" title="Bold (Ctrl B)" @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.format('bold')}><b>B</b></button>
              <button aria-label="Italic" title="Italic (Ctrl I)" @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.format('italic')}><i>I</i></button>
              <button @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.format('list')}>List</button>
              <button @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.format('quote')}>Quote</button>
            </div>`
          : nothing}
        <textarea id=${this.ids.input} class="input" rows=${this.rows} .value=${live(this.text)} placeholder=${this.placeholder || nothing}
          ?disabled=${this.disabled} ?required=${this.required}
          role=${this.mentionSource ? 'combobox' : nothing} aria-expanded=${this.mentionSource ? (open ? 'true' : 'false') : nothing}
          aria-controls=${open ? this.ids.list : nothing} aria-activedescendant=${open && this.result?.found.length ? `${this.ids.list}-${this.active}` : nothing}
          aria-describedby=${describedBy || nothing} aria-invalid=${this.state === 'error' || this.state === 'attention' ? 'true' : 'false'}
          @input=${this.onInput} @keydown=${this.onKeydown} @select=${this.onSelect} @mouseup=${this.onSelect} @keyup=${this.onSelect}
          @blur=${() => {
            this.selecting = false;
            this.closeMentions();
            if (this.required && !this.text.trim()) this.check();
            this.dispatchEvent(new CustomEvent('ui-change', { detail: { value: this.value }, bubbles: true, composed: true }));
          }}></textarea>
      </div>
      ${this.suggestions()}
      ${this.mentions.length
        ? html`<ui-refs .refs=${this.mentions.map((m) => m.ref)}></ui-refs>`
        : nothing}
      <div class="foot">
        <p class="msg" id=${this.ids.msg} aria-live="polite">${this.message}</p>
        ${guide
          ? html`<span class="count ${over ? 'over' : ''}">${used} ${used === 1 ? guide.unit : `${guide.unit}s`}${over ? ` · aim for ${guide.n}` : ''}</span>`
          : nothing}
      </div>`;
  }
}

if (!customElements.get('ui-editor')) customElements.define('ui-editor', UiEditor);

declare global {
  interface HTMLElementTagNameMap {
    'ui-editor': UiEditor;
  }
}
