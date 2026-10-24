import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';

/** Whether a file is one `accept` allows: endings (".pdf") and media types ("text/*"), comma separated, as on <input type="file">. */
export const accepts = (accept: string, file: Pick<File, 'name' | 'type'>) => {
  const rules = accept.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return rules.some((rule) => (rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule));
};

/**
 * Somewhere to drop files, or press to choose them. It hands over the files it
 * accepts and says which it turned away; what happens next is the app's.
 *
 * Works from the keyboard and screen readers through its Choose button; dropping
 * is a shortcut, never the only way.
 *
 * @fires ui-files - detail `{ files }`, the files dropped or chosen that `accept` allows
 * @fires ui-reject - detail `{ files }`, the ones it doesn't
 */
export class UiDropZone extends LitElement {
  static override properties = {
    heading: { type: String },
    hint: { type: String },
    action: { type: String },
    accept: { type: String },
    multiple: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    compact: { type: Boolean, reflect: true },
    over: { type: Boolean, reflect: true },
  };

  /** What dropping does: "Drop files to add them". */
  declare heading: string;
  /** What it takes: "PDF, Word, HTML, Markdown or text, up to 200 MB". */
  declare hint: string;
  /** The button's word. */
  declare action: string;
  /** As on <input type="file">: ".pdf,.docx,text/*". Empty takes anything. */
  declare accept: string;
  declare multiple: boolean;
  declare disabled: boolean;
  /** Something is being done with the last files: says so and takes no more until it's done. */
  declare busy: boolean;
  /** One line, for a dialog or a panel: the words beside the button, the hint left out. */
  declare compact: boolean;
  /** Files are being dragged over it. */
  declare over: boolean;

  private depth = 0;

  constructor() {
    super();
    this.heading = 'Drop files here';
    this.hint = '';
    this.action = 'Choose files';
    this.accept = '';
    this.multiple = true;
    this.disabled = false;
    this.busy = false;
    this.compact = false;
    this.over = false;
  }

  /** Opens the system's file chooser. */
  choose() {
    if (!this.disabled && !this.busy) this.renderRoot.querySelector<HTMLInputElement>('input')?.click();
  }

  private take(list: FileList | null | undefined) {
    if (!list?.length || this.disabled || this.busy) return;
    const files = this.multiple ? [...list] : [list[0]];
    const taken = files.filter((f) => accepts(this.accept, f));
    const turned = files.filter((f) => !taken.includes(f));
    if (taken.length) this.dispatchEvent(new CustomEvent('ui-files', { detail: { files: taken }, bubbles: true, composed: true }));
    if (turned.length) this.dispatchEvent(new CustomEvent('ui-reject', { detail: { files: turned }, bubbles: true, composed: true }));
  }

  private onDrag(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    if (e.type === 'dragenter') this.depth++;
    if (e.type === 'dragleave') this.depth = Math.max(0, this.depth - 1);
    this.over = this.depth > 0 && !this.disabled && !this.busy;
    if (e.type === 'dragover') e.dataTransfer.dropEffect = this.disabled || this.busy ? 'none' : 'copy';
  }

  private onDrop(e: DragEvent) {
    e.preventDefault();
    this.depth = 0;
    this.over = false;
    this.take(e.dataTransfer?.files);
  }

  static override styles = [
    base,
    css`
      :host { display: block; }
      .zone {
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2);
        min-height: 128px; padding: var(--space-5); text-align: center;
        border: 1.5px dashed var(--hairline-strong); border-radius: var(--radius-card);
        transition: border-color var(--motion-quick) var(--ease-standard), background var(--motion-quick) var(--ease-standard);
      }
      :host([compact]) .zone { flex-direction: row; justify-content: flex-start; gap: var(--space-3); min-height: 56px; padding: var(--space-2) var(--space-4); text-align: left; }
      :host([compact]) .heading { flex: 1; color: var(--ink-muted); font-size: var(--type-meta); }
      :host([compact]) button { margin-top: 0; }
      :host([over]) .zone { border-color: var(--green); background: color-mix(in srgb, var(--green) 8%, transparent); }
      :host([disabled]) .zone { opacity: 0.4; }
      ui-icon { color: var(--ink-muted); }
      :host([over]) ui-icon { color: var(--green); }
      .heading { font-size: var(--type-body); line-height: var(--leading-body); }
      .hint { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      button {
        margin-top: var(--space-2); padding: var(--space-1) var(--space-4); border-radius: var(--radius-pill);
        border: 1px solid var(--hairline-strong); background: none; color: var(--ink); font: inherit; font-size: var(--type-meta); cursor: pointer;
      }
      button:hover:not([disabled]) { background: color-mix(in srgb, var(--ink) 6%, transparent); }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      button[disabled] { cursor: default; }
      input { display: none; }
    `,
  ];

  override render() {
    return html`<div
      class="zone"
      @dragenter=${this.onDrag}
      @dragover=${this.onDrag}
      @dragleave=${this.onDrag}
      @drop=${this.onDrop}
      aria-busy=${this.busy ? 'true' : 'false'}
    >
      <ui-icon name="upload" size="20"></ui-icon>
      <span class="heading">${this.heading}</span>
      ${this.hint && !this.compact ? html`<span class="hint">${this.hint}</span>` : nothing}
      <button type="button" ?disabled=${this.disabled || this.busy} @click=${() => this.choose()}>${this.busy ? 'Working…' : this.action}</button>
      <input
        type="file"
        tabindex="-1"
        aria-hidden="true"
        accept=${this.accept || nothing}
        ?multiple=${this.multiple}
        @change=${(e: Event) => {
          const input = e.target as HTMLInputElement;
          this.take(input.files);
          input.value = '';
        }}
      />
    </div>`;
  }
}

if (!customElements.get('ui-drop-zone')) customElements.define('ui-drop-zone', UiDropZone);

declare global {
  interface HTMLElementTagNameMap {
    'ui-drop-zone': UiDropZone;
  }
}
