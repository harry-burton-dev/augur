import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type MarkdownIt from 'markdown-it';
import { cx } from '@augur/kit-common';

/** A heading in what the reader shows, for a contents list. */
export interface OutlineItem {
  id: string;
  text: string;
  /** 1 for a top-level heading, down to 3. */
  level: number;
}

export type ReaderSize = 'small' | 'medium' | 'large';
export type ReaderWidth = 'narrow' | 'wide';

/** Words selected in a reader: what they say, the block they start in, and that block's words. */
export interface MarkedPassage {
  text: string;
  anchor: string;
  context: string;
}

/** What a page can ask of a reader it holds a ref to. */
export interface ReaderHandle {
  /** Its headings, from the top level down to the third. */
  outline(): OutlineItem[];
  /** The block at the top of the view, by its anchor. */
  position(): string;
  /** The heading a block sits under (itself, when it is one), for marking the contents. */
  headingFor(anchor: string): string;
  /** Brings a block to the top and focuses it; `focus: false` only scrolls. False when there's no such block. */
  goTo(anchor: string, options?: { smooth?: boolean; focus?: boolean }): boolean;
  /** The words selected in the document, if any. */
  marked(): MarkedPassage | undefined;
}

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
 * else by its place (`b12`). Pictures wait for the host to say where they are.
 */
const markdown = (Md: typeof import('markdown-it').default) => {
  const md = new Md({ html: false, linkify: true, typographer: true });
  md.core.ruler.push('quill_anchors', (state) => {
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
  md.renderer.rules.image = (tokens, i) => {
    const token = tokens[i]!;
    return `<img data-src="${md.utils.escapeHtml(token.attrGet('src') ?? '')}" alt="${md.utils.escapeHtml(token.content)}" loading="lazy">`;
  };
  const link = md.renderer.rules.link_open ?? ((tokens, i, options, _env, self) => self.renderToken(tokens, i, options));
  md.renderer.rules.link_open = (tokens, i, options, env, self) => {
    if (!(tokens[i]!.attrGet('href') ?? '').startsWith('#')) {
      tokens[i]!.attrSet('target', '_blank');
      tokens[i]!.attrSet('rel', 'noopener noreferrer');
    }
    return link(tokens, i, options, env, self);
  };
  md.renderer.rules.table_open = (tokens, i, options, _env, self) =>
    `<div class="quill-reader-table" role="region" tabindex="0" aria-label="Table, scrolls sideways">${self.renderToken(tokens, i, options)}`;
  md.renderer.rules.table_close = (tokens, i, options, _env, self) => `${self.renderToken(tokens, i, options)}</div>`;
  return md;
};

let shared: MarkdownIt | undefined;
let loading: Promise<MarkdownIt> | undefined;
/** Markdown-it, loaded the first time a reader shows something, since only a few screens read. */
export const loadReader = () => (loading ??= import('markdown-it').then(({ default: Md }) => (shared = markdown(Md))));

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface ReaderProps {
  markdown: string;
  size?: ReaderSize;
  width?: ReaderWidth;
  /** Where a picture the document refers to really is, or undefined to leave it out. */
  imageSource?: (src: string) => Promise<string | undefined>;
  /** The document's title, when the page shows it above: a first heading that only repeats it is left out. */
  heading?: string;
  /** Rendered: its headings, for a contents list. */
  onOutline?: (headings: OutlineItem[]) => void;
  /** The block at the top of the view changed while reading. */
  onPosition?: (anchor: string) => void;
  ref?: Ref<ReaderHandle>;
  className?: string;
}

/**
 * A document to read, from Markdown, in the kit's reading type: one measure,
 * one rhythm. Headings, lists, tables, quotes and code come out as their HTML
 * elements. It renders nothing it wasn't given: raw HTML is shown as text,
 * links open elsewhere, and pictures load only through `imageSource`.
 */
export function Reader({ markdown: source, size = 'medium', width = 'narrow', imageSource, heading = '', onOutline, onPosition, ref, className }: ReaderProps) {
  const article = useRef<HTMLElement>(null);
  const atTop = useRef('');
  const [html, setHtml] = useState(() => (shared ? shared.render(source) : undefined));
  const latest = useRef({ onOutline, onPosition });
  latest.current = { onOutline, onPosition };

  useEffect(() => {
    if (shared) setHtml(shared.render(source));
    else {
      let gone = false;
      void loadReader().then((md) => !gone && setHtml(md.render(source)));
      return () => {
        gone = true;
      };
    }
  }, [source]);

  const blocks = () => [...(article.current?.querySelectorAll<HTMLElement>('[data-block]') ?? [])];
  const outline = (): OutlineItem[] =>
    [...(article.current?.querySelectorAll<HTMLElement>('h1[id]:not([hidden]), h2[id], h3[id]') ?? [])].map((h) => ({ id: h.id, text: h.textContent?.trim() ?? '', level: Number(h.tagName[1]) }));
  const goTo: ReaderHandle['goTo'] = (anchor, { smooth = true, focus = true } = {}) => {
    const target = article.current?.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`);
    if (!target) return false;
    target.scrollIntoView?.({ block: 'start', behavior: smooth && !still() ? 'smooth' : 'auto' });
    if (focus) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    atTop.current = anchor;
    return true;
  };

  useImperativeHandle(ref, () => ({
    outline,
    position: () => atTop.current,
    headingFor(anchor) {
      let found = '';
      for (const block of blocks()) {
        if (/^H[1-3]$/.test(block.tagName) && !block.hidden) found = block.id;
        if (block.id === anchor) break;
      }
      return found;
    },
    goTo,
    marked() {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return undefined;
      const range = selection.getRangeAt(0);
      const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
      const block = start?.closest<HTMLElement>('[data-block]');
      if (!block || !article.current?.contains(block)) return undefined;
      const text = selection.toString().replace(/\s+/g, ' ').trim();
      return text ? { text, anchor: block.id, context: (block.textContent ?? '').replace(/\s+/g, ' ').trim() } : undefined;
    },
  }));

  // Once shown: hide a first heading that repeats the title, fetch pictures, and say the outline.
  useLayoutEffect(() => {
    const root = article.current;
    if (!root || html === undefined) return;
    const first = root.firstElementChild as HTMLElement | null;
    for (const h of root.querySelectorAll('h1[hidden]')) h.removeAttribute('hidden');
    if (heading && first?.tagName === 'H1' && first.textContent?.trim().toLocaleLowerCase() === heading.trim().toLocaleLowerCase()) first.hidden = true;
    atTop.current = '';
    latest.current.onOutline?.(outline());
  }, [html, heading]);

  useEffect(() => {
    const root = article.current;
    if (!root || html === undefined) return;
    let gone = false;
    void (async () => {
      for (const img of root.querySelectorAll<HTMLImageElement>('img[data-src]')) {
        const src = img.dataset.src ?? '';
        const found = src && imageSource ? await imageSource(src).catch(() => undefined) : undefined;
        if (gone) return;
        if (found) {
          img.src = found;
          img.removeAttribute('data-src');
        } else if (imageSource) img.replaceWith(Object.assign(document.createElement('span'), { className: 'quill-reader-missing', textContent: img.alt ? `[Picture: ${img.alt}]` : '[Picture]' }));
      }
    })();
    return () => {
      gone = true;
    };
  }, [html, imageSource]);

  // Whatever scrolls it: the page, or a pane round it, even inside another component's shadow root.
  useEffect(() => {
    const root = article.current;
    if (!root) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (root.getBoundingClientRect().top > 0) return;
        const at = blocks().find((b) => b.getBoundingClientRect().bottom > 72)?.id ?? '';
        if (at && at !== atTop.current) {
          atTop.current = at;
          latest.current.onPosition?.(at);
        }
      });
    };
    const up = (at: Node): Node | null => (at instanceof Element && at.assignedSlot) || (at instanceof ShadowRoot ? at.host : at.parentNode);
    const scrollers: EventTarget[] = [window];
    for (let at: Node | null = up(root); at; at = up(at)) if (at instanceof Element) scrollers.push(at);
    for (const t of scrollers) t.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      for (const t of scrollers) t.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <article
      ref={article}
      className={cx('quill-reader', className)}
      data-size={size}
      data-width={width}
      aria-busy={html === undefined || undefined}
      onClick={(e) => {
        const href = (e.target as HTMLElement).closest?.('a')?.getAttribute('href');
        if (href?.startsWith('#') && goTo(decodeURIComponent(href.slice(1)))) e.preventDefault();
      }}
      // markdown-it runs with html: false, so the document's own HTML arrives escaped.
      dangerouslySetInnerHTML={{ __html: html ?? '' }}
    />
  );
}

export interface ContentsProps {
  items: OutlineItem[];
  /** The heading being read now. */
  current?: string;
  heading?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

/** A document's contents: its headings as links, indented by level, with the one being read marked. Beside a Reader, from its `onOutline`. */
export function Contents({ items, current = '', heading = 'Contents', onSelect, className }: ContentsProps) {
  if (!items.length) return null;
  // Indented from the highest level there is, so a document without a title heading starts at the left.
  const top = Math.min(...items.map((i) => i.level));
  return (
    <nav className={cx('quill-contents', className)} aria-label={heading}>
      <span className="quill-label">{heading}</span>
      <ol>
        {items.map((item) => (
          <li key={item.id} data-level={item.level - top + 1}>
            <a
              href={`#${item.id}`}
              aria-current={item.id === current ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onSelect?.(item.id);
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
