import { LitElement, css, html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import MarkdownIt from 'markdown-it';
import { base, reducedMotion } from '../shared.js';

/** A heading in what the reader shows, for a contents list. */
export interface OutlineItem {
  id: string;
  text: string;
  /** 1 for a top-level heading, down to 3. */
  level: number;
}

export type ReaderSize = 'small' | 'medium' | 'large';
export type ReaderWidth = 'narrow' | 'wide';

/** A heading's words as an anchor: "2. Claims & receipts" → "claims-receipts". */
export const slugFor = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^[\d.\s]+(?=\D)/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';

const BLOCK_OPEN = new Set(['paragraph_open', 'heading_open', 'bullet_list_open', 'ordered_list_open', 'blockquote_open', 'table_open', 'fence', 'code_block', 'hr']);

/**
 * Markdown as the kit reads it: no raw HTML (it's escaped), only safe links, and
 * every top-level block with a stable anchor: a heading by its words, anything
 * else by its place (`b12`). The same Markdown always gets the same anchors, so a
 * link, a search hit or a saved place can point at one paragraph.
 */
const markdown = () => {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  md.core.ruler.push('ui_anchors', (state) => {
    const taken = new Set<string>();
    let n = 0;
    state.tokens.forEach((token, i) => {
      if (token.level !== 0 || !BLOCK_OPEN.has(token.type)) return;
      n++;
      let id = `b${n}`;
      if (taken.has(id)) id = `b${n}-block`;
      if (token.type === 'heading_open') {
        const base = slugFor(state.tokens[i + 1]?.content ?? '');
        id = base;
        for (let k = 2; taken.has(id); k++) id = `${base}-${k}`;
      }
      taken.add(id);
      token.attrSet('id', id);
      token.attrSet('data-block', String(n));
    });
  });
  // Pictures wait for the host to say where they are; a document never fetches anything itself.
  md.renderer.rules.image = (tokens, i) => {
    const token = tokens[i];
    const src = md.utils.escapeHtml(token.attrGet('src') ?? '');
    const alt = md.utils.escapeHtml(token.content);
    return `<img data-src="${src}" alt="${alt}" loading="lazy">`;
  };
  const link = md.renderer.rules.link_open ?? ((tokens, i, options, _env, self) => self.renderToken(tokens, i, options));
  md.renderer.rules.link_open = (tokens, i, options, env, self) => {
    const href = tokens[i].attrGet('href') ?? '';
    if (!href.startsWith('#')) {
      tokens[i].attrSet('target', '_blank');
      tokens[i].attrSet('rel', 'noopener noreferrer');
    }
    return link(tokens, i, options, env, self);
  };
  // A wide table scrolls inside its own box, and says so to a keyboard.
  md.renderer.rules.table_open = (tokens, i, options, _env, self) =>
    `<div class="table" role="region" tabindex="0" aria-label="Table, scrolls sideways">${self.renderToken(tokens, i, options)}`;
  md.renderer.rules.table_close = (tokens, i, options, _env, self) => `${self.renderToken(tokens, i, options)}</div>`;
  return md;
};

let shared: MarkdownIt | undefined;

/** Words selected in a reader: what they say, the block they start in, and that block's words. */
export interface MarkedPassage {
  text: string;
  anchor: string;
  context: string;
}

/**
 * A document to read, from Markdown, in the kit's reading type: one measure, one
 * rhythm, the same whatever the document was written in. Headings, lists,
 * tables, quotes and code come out as their HTML elements, so a screen reader
 * can move through them.
 *
 * It renders nothing it wasn't given: raw HTML is shown as text, links open
 * elsewhere, and pictures load only through `imageSource`, which turns a
 * document's own reference (`images/1.png`) into an address the host trusts.
 *
 * @fires ui-outline - rendered, detail `{ headings }`: its headings, for a contents list
 * @fires ui-position - the block at the top of the view changed while reading, detail `{ anchor }`
 */
export class UiReader extends LitElement {
  static override properties = {
    markdown: { type: String },
    size: { type: String, reflect: true },
    width: { type: String, reflect: true },
    imageSource: { attribute: false },
    heading: { type: String },
  };

  declare markdown: string;
  declare size: ReaderSize;
  declare width: ReaderWidth;
  /** Where a picture the document refers to really is, or undefined to leave it out. */
  declare imageSource: ((src: string) => Promise<string | undefined>) | undefined;
  /**
   * The document's title, when the page shows it above: a first heading that
   * only repeats it is left out, of the page and of the outline.
   */
  declare heading: string;

  private rendered = '';
  private html = '';
  private atTop = '';
  private frame = 0;

  constructor() {
    super();
    this.markdown = '';
    this.size = 'medium';
    this.width = 'narrow';
    this.imageSource = undefined;
    this.heading = '';
  }

  /** Its headings, from the top level down to the third. */
  get outline(): OutlineItem[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('h1[id]:not([hidden]), h2[id], h3[id]')].map((h) => ({ id: h.id, text: h.textContent?.trim() ?? '', level: Number(h.tagName[1]) }));
  }

  /** The block at the top of the view, by its anchor. */
  get position() {
    return this.atTop;
  }

  /** The heading a block sits under (itself, when it is one), for marking the contents. */
  headingFor(anchor: string) {
    let heading = '';
    for (const block of this.renderRoot.querySelectorAll<HTMLElement>('[data-block]')) {
      if (/^H[1-3]$/.test(block.tagName) && !block.hidden) heading = block.id;
      if (block.id === anchor) break;
    }
    return heading;
  }

  /**
   * Brings a block to the top of the view and puts focus on it, so reading goes
   * on from there. `focus: false` only scrolls: for going back to where someone was.
   */
  goTo(anchor: string, { smooth = true, focus = true } = {}) {
    const target = this.renderRoot.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`);
    if (!target) return false;
    target.scrollIntoView({ block: 'start', behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
    if (focus) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    this.atTop = anchor;
    return true;
  }

  /**
   * The words selected in the document, if any: the text, the block they start
   * in (by its anchor) and that block's words, so another app can be told what
   * was marked and where. Undefined when nothing in this document is selected.
   */
  marked(): MarkedPassage | undefined {
    const root = this.renderRoot as ShadowRoot & { getSelection?: () => Selection | null };
    const selection = root.getSelection?.() ?? document.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return undefined;
    const range = selection.getRangeAt(0);
    const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    const block = start?.closest<HTMLElement>('[data-block]');
    if (!block || !root.contains(block)) return undefined;
    const text = selection.toString().replace(/\s+/g, ' ').trim();
    if (!text) return undefined;
    return { text, anchor: block.id, context: (block.textContent ?? '').replace(/\s+/g, ' ').trim() };
  }

  private scrollers: EventTarget[] = [];

  override connectedCallback() {
    super.connectedCallback();
    // Whatever scrolls it: the page, or a pane round it, even one inside another component's
    // shadow root (a shell's stage, with the app slotted in), where a scroll event never reaches the document.
    this.scrollers = [window];
    // Up the composed tree: into the slot a node is shown in, and out of each shadow root.
    const up = (at: Node): Node | null => (at instanceof Element && at.assignedSlot) || (at instanceof ShadowRoot ? at.host : at.parentNode);
    for (let at: Node | null = up(this); at; at = up(at)) {
      if (at instanceof Element) this.scrollers.push(at);
    }
    for (const target of this.scrollers) target.addEventListener('scroll', this.onScroll, { passive: true });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const target of this.scrollers) target.removeEventListener('scroll', this.onScroll);
    this.scrollers = [];
    cancelAnimationFrame(this.frame);
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('markdown') && this.markdown !== this.rendered) {
      this.rendered = this.markdown;
      this.html = (shared ??= markdown()).render(this.markdown ?? '');
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('markdown') || changed.has('heading')) {
      const first = this.renderRoot.querySelector<HTMLElement>('article > :first-child');
      const repeats = first?.tagName === 'H1' && first.textContent?.trim().toLocaleLowerCase() === this.heading.trim().toLocaleLowerCase();
      for (const h of this.renderRoot.querySelectorAll('h1[hidden]')) h.removeAttribute('hidden');
      if (repeats && this.heading) first.setAttribute('hidden', '');
      this.atTop = '';
      void this.loadImages();
      this.dispatchEvent(new CustomEvent('ui-outline', { detail: { headings: this.outline }, bubbles: true, composed: true }));
    } else if (changed.has('imageSource')) void this.loadImages();
  }

  private async loadImages() {
    for (const img of this.renderRoot.querySelectorAll<HTMLImageElement>('img[data-src]')) {
      const src = img.dataset.src ?? '';
      const found = src && this.imageSource ? await this.imageSource(src).catch(() => undefined) : undefined;
      if (found) {
        img.src = found;
        img.removeAttribute('data-src');
      } else if (this.imageSource) {
        // The host has no such picture: say what it was.
        img.replaceWith(Object.assign(document.createElement('span'), { className: 'missing', textContent: img.alt ? `[Picture: ${img.alt}]` : '[Picture]' }));
      }
    }
  }

  private onScroll = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const top = this.getBoundingClientRect().top;
      // Only while it's what is being read: once its top has gone up past the view's.
      if (top > 0) return;
      const blocks = this.renderRoot.querySelectorAll<HTMLElement>('[data-block]');
      let at = '';
      for (const block of blocks) {
        if (block.getBoundingClientRect().bottom > 72) {
          at = block.id;
          break;
        }
      }
      if (at && at !== this.atTop) {
        this.atTop = at;
        this.dispatchEvent(new CustomEvent('ui-position', { detail: { anchor: at }, bubbles: true, composed: true }));
      }
    });
  };

  private onClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest?.('a');
    const href = a?.getAttribute('href');
    if (href?.startsWith('#') && this.goTo(decodeURIComponent(href.slice(1)))) e.preventDefault();
  }

  static override styles = [
    base,
    css`
      :host { display: block; --reader-type: 18px; --reader-leading: 30px; }
      :host([size='small']) { --reader-type: var(--type-body); --reader-leading: var(--leading-body); }
      :host([size='large']) { --reader-type: var(--type-lead); --reader-leading: 32px; }
      article {
        max-width: var(--measure-read); margin: 0 auto;
        font-size: var(--reader-type); line-height: var(--reader-leading); color: var(--ink);
        overflow-wrap: break-word; hyphens: auto;
      }
      :host([width='wide']) article { max-width: var(--measure-wide); }
      article > * { margin: 0 0 calc(var(--reader-leading) * 0.75); }
      [tabindex='-1']:focus { outline: none; }
      [hidden] { display: none; }
      article > [hidden] + * { margin-top: 0; }
      h1, h2, h3, h4, h5, h6 { color: var(--ink); scroll-margin-top: var(--space-6); text-wrap: balance; }
      h1 { font-size: var(--type-title-s); line-height: var(--leading-title-s); font-weight: 300; margin-top: var(--space-6); }
      h2 { font-size: var(--type-heading); line-height: var(--leading-heading); font-weight: 400; margin-top: var(--space-6); }
      h3 { font-size: var(--type-lead); line-height: var(--leading-lead); font-weight: 500; margin-top: var(--space-5); }
      h4, h5, h6 { font-size: var(--reader-type); line-height: var(--reader-leading); font-weight: 600; margin-top: var(--space-5); }
      article > :first-child { margin-top: 0; }
      p, li, blockquote, td, th { text-wrap: pretty; }
      [data-block] { scroll-margin-top: var(--space-6); }
      a { color: var(--ink); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--ink) 40%, transparent); text-underline-offset: 3px; }
      a:hover { text-decoration-color: var(--ink); }
      a:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; border-radius: 2px; }
      strong { font-weight: 600; }
      ul, ol { padding-left: 1.5em; }
      li + li, li > ul, li > ol { margin-top: calc(var(--reader-leading) * 0.25); }
      li::marker { color: var(--ink-muted); }
      blockquote { margin-left: 0; padding-left: var(--space-4); border-left: 2px solid var(--hairline-strong); color: var(--ink-muted); }
      hr { border: 0; border-top: 1px solid var(--hairline); margin: var(--space-6) 0; }
      code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.875em; padding: 0.1em 0.3em; border-radius: 4px; background: color-mix(in srgb, var(--ink) 8%, transparent); }
      pre { overflow-x: auto; padding: var(--space-4); border-radius: var(--radius-inset); background: color-mix(in srgb, var(--ink) 6%, transparent); line-height: 1.5; }
      pre code { padding: 0; background: none; }
      .table { overflow-x: auto; border-radius: var(--radius-inset); border: 1px solid var(--hairline); }
      .table:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      table { border-collapse: collapse; width: 100%; font-size: calc(var(--reader-type) * 0.875); line-height: 1.45; font-variant-numeric: tabular-nums; }
      th, td { padding: var(--space-2) var(--space-3); text-align: left; vertical-align: top; border-bottom: 1px solid var(--hairline); }
      th { font-weight: 500; color: var(--ink-muted); }
      tr:last-child td { border-bottom: 0; }
      img { display: block; max-width: 100%; height: auto; margin: 0 auto; border-radius: var(--radius-inset); }
      .missing { color: var(--ink-muted); font-size: var(--type-meta); }
    `,
  ];

  override render() {
    return html`<article @click=${this.onClick}>${this.html ? unsafeHTML(this.html) : nothing}</article>`;
  }
}

if (!customElements.get('ui-reader')) customElements.define('ui-reader', UiReader);

declare global {
  interface HTMLElementTagNameMap {
    'ui-reader': UiReader;
  }
}
