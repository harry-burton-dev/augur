import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { base } from '../shared.js';
import { readMentions } from './editor.js';
import type { RefKind, RefShown } from './ref.js';
import './ref.js';

const INLINE = /\*\*([^*\n]+)\*\*|_([^_\n]+)_|\[([@#][^\]\n]+)\]\((entity|document|intent|person|team):([^)\s]+)\)/g;

/** One line's bold, italic and mentions, as templates: nothing is read as HTML. */
const inline = (text: string): (string | TemplateResult)[] => {
  const out: (string | TemplateResult)[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    if (m[1] !== undefined) out.push(html`<strong>${inline(m[1])}</strong>`);
    else if (m[2] !== undefined) out.push(html`<em>${inline(m[2])}</em>`);
    else {
      const ref: RefShown = { kind: m[4] as RefKind, id: m[5]!, label: m[3]!.slice(1) };
      out.push(html`<ui-ref .ref=${ref}></ui-ref>`);
    }
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
};

/** What the editor writes, as plain words: marks dropped, mentions kept as their names. */
export const plainText = (markdown: string) =>
  readMentions(markdown)
    .text.replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/^(- |> )/gm, '');

/**
 * Shows what `ui-editor` writes: paragraphs, bold, italic, lists, quotes, and
 * mentions as chips that open where you are. Only that much Markdown is read,
 * and none of it as HTML.
 *
 * @fires ui-open - {ref} a mention was pressed
 */
export class UiProse extends LitElement {
  static override properties = {
    value: { type: String },
  };

  declare value: string;

  constructor() {
    super();
    this.value = '';
  }

  static override styles = [
    base,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-3); max-width: var(--measure-prose); color: var(--ink); font-size: var(--type-body); line-height: var(--leading-body); }
      p, ul, blockquote { margin: 0; }
      ul { padding-left: 1.2em; display: flex; flex-direction: column; gap: var(--space-1); }
      blockquote { padding-left: var(--space-4); border-left: 2px solid var(--hairline-strong); color: var(--ink-muted); }
      strong { font-weight: 600; }
      ui-ref { vertical-align: baseline; }
    `,
  ];

  override render() {
    const blocks: TemplateResult[] = [];
    const lines = this.value.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < lines.length; ) {
      const line = lines[i]!;
      if (!line.trim()) {
        i++;
        continue;
      }
      const run = (mark: string) => {
        const items: string[] = [];
        while (i < lines.length && lines[i]!.startsWith(mark)) items.push(lines[i++]!.slice(mark.length));
        return items;
      };
      if (line.startsWith('- ')) blocks.push(html`<ul>${run('- ').map((l) => html`<li>${inline(l)}</li>`)}</ul>`);
      else if (line.startsWith('> ')) blocks.push(html`<blockquote>${run('> ').map((l, n) => html`${n ? html`<br />` : nothing}${inline(l)}`)}</blockquote>`);
      else {
        const para: string[] = [];
        while (i < lines.length && lines[i]!.trim() && !lines[i]!.startsWith('- ') && !lines[i]!.startsWith('> ')) para.push(lines[i++]!);
        blocks.push(html`<p>${para.map((l, n) => html`${n ? html`<br />` : nothing}${inline(l)}`)}</p>`);
      }
    }
    return blocks;
  }
}

if (!customElements.get('ui-prose')) customElements.define('ui-prose', UiProse);

declare global {
  interface HTMLElementTagNameMap {
    'ui-prose': UiProse;
  }
}
