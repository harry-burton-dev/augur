import { afterEach, describe, expect, it } from 'vitest';
import './reader.js';
import './contents.js';
import { slugFor, type UiReader } from './reader.js';
import type { UiContents } from './contents.js';

const mount = async (markdown: string, imageSource?: UiReader['imageSource']) => {
  const reader = document.createElement('ui-reader');
  reader.imageSource = imageSource;
  const outlines: unknown[] = [];
  reader.addEventListener('ui-outline', (e) => outlines.push((e as CustomEvent).detail.headings));
  reader.markdown = markdown;
  document.body.append(reader);
  await reader.updateComplete;
  return { reader, root: reader.shadowRoot!, outlines };
};

afterEach(() => {
  document.body.innerHTML = '';
});

const DOC = `# Travel policy

Book through the **travel desk**.

## Claims & receipts

- Keep receipts
- Claim within 30 days

## Claims & receipts

| Item | Limit |
|---|---|
| Hotel | £150 |
`;

describe('ui-reader', () => {
  it('makes anchors from headings’ words', () => {
    expect(slugFor('2. Claims & receipts')).toBe('claims-receipts');
    expect(slugFor('Café policy')).toBe('cafe-policy');
    expect(slugFor('***')).toBe('section');
  });

  it('reads Markdown as HTML elements, every block with a stable anchor', async () => {
    const { root, reader, outlines } = await mount(DOC);
    const blocks = [...root.querySelectorAll<HTMLElement>('[data-block]')].map((b) => [b.tagName, b.id]);
    expect(blocks).toEqual([
      ['H1', 'travel-policy'],
      ['P', 'b2'],
      ['H2', 'claims-receipts'],
      ['UL', 'b4'],
      ['H2', 'claims-receipts-2'],
      ['TABLE', 'b6'],
    ]);
    expect(root.querySelector('strong')!.textContent).toBe('travel desk');
    expect(root.querySelector('.table[role=region] table')).not.toBeNull();
    expect(outlines).toEqual([
      [
        { id: 'travel-policy', text: 'Travel policy', level: 1 },
        { id: 'claims-receipts', text: 'Claims & receipts', level: 2 },
        { id: 'claims-receipts-2', text: 'Claims & receipts', level: 2 },
      ],
    ]);
    expect(reader.headingFor('b4')).toBe('claims-receipts');
    expect(reader.headingFor('b2')).toBe('travel-policy');
  });

  it('shows raw HTML as text and keeps unsafe links out', async () => {
    const { root } = await mount('<script>alert(1)</script>\n\n<b onclick="x()">bold</b> [bad](javascript:alert(1)) [good](https://example.org) [here](#b1)');
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>');
    const links = [...root.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]);
    expect(links).toEqual([
      ['https://example.org', '_blank', 'noopener noreferrer'],
      ['#b1', null, null],
    ]);
  });

  it('loads pictures only through the host', async () => {
    const asked: string[] = [];
    const { root, reader } = await mount('![A chart](images/1.png)\n\n![](https://tracker.example/pixel.gif)', async (src) => {
      asked.push(src);
      return src === 'images/1.png' ? 'blob:chart' : undefined;
    });
    await new Promise((r) => setTimeout(r));
    expect(asked).toEqual(['images/1.png', 'https://tracker.example/pixel.gif']);
    expect(root.querySelector('img')!.getAttribute('src')).toBe('blob:chart');
    expect(root.querySelector('img')!.alt).toBe('A chart');
    expect(root.querySelector('.missing')!.textContent).toBe('[Picture]');
    expect(reader.shadowRoot!.querySelectorAll('img[data-src]').length).toBe(0);
  });

  it('leaves out a first heading that only repeats the title shown above it', async () => {
    const reader = document.createElement('ui-reader');
    reader.heading = 'Travel Policy';
    reader.markdown = DOC;
    document.body.append(reader);
    await reader.updateComplete;
    expect(reader.shadowRoot!.querySelector('h1')!.hidden).toBe(true);
    expect(reader.outline.map((h) => h.id)).toEqual(['claims-receipts', 'claims-receipts-2']);
    expect(reader.headingFor('b2')).toBe('');
    reader.heading = 'Something else';
    await reader.updateComplete;
    expect(reader.shadowRoot!.querySelector('h1')!.hidden).toBe(false);
  });

  it('hears scrolling in a pane inside another component’s shadow root, with it slotted in', async () => {
    // A shell: its stage scrolls, in its shadow root, with the app slotted in.
    const shell = document.createElement('div');
    const pane = shell.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'));
    const slot = pane.appendChild(document.createElement('slot'));
    document.body.append(shell);
    const reader = document.createElement('ui-reader');
    reader.markdown = DOC;
    // happy-dom doesn't assign slots; a browser does.
    Object.defineProperty(reader, 'assignedSlot', { value: slot });
    shell.append(reader);
    await reader.updateComplete;
    const heard: string[] = [];
    reader.addEventListener('ui-position', (e) => heard.push((e as CustomEvent).detail.anchor));
    // The reader's top has gone up past the view, and the third block is the first still in it.
    reader.getBoundingClientRect = () => ({ top: -500 }) as DOMRect;
    const blocks = [...reader.shadowRoot!.querySelectorAll<HTMLElement>('[data-block]')];
    blocks.forEach((b, i) => (b.getBoundingClientRect = () => ({ bottom: i < 2 ? 10 : 400 }) as DOMRect));
    pane.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(r));
    expect(heard).toEqual(['claims-receipts']);
  });

  it('goes to a block and puts focus on it', async () => {
    const { reader, root } = await mount(DOC);
    expect(reader.goTo('claims-receipts', { smooth: false })).toBe(true);
    expect(reader.position).toBe('claims-receipts');
    expect(root.activeElement?.id).toBe('claims-receipts');
    expect(reader.goTo('nowhere')).toBe(false);
  });

  it('says what words are selected, and the block they’re in', async () => {
    const { reader, root } = await mount(DOC);
    expect(reader.marked()).toBeUndefined();
    const words = root.querySelector('strong')!.firstChild!;
    const range = document.createRange();
    range.setStart(words, 0);
    range.setEnd(words, 6);
    const selection = (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ?? document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    expect(reader.marked()).toEqual({ text: 'travel', anchor: 'b2', context: 'Book through the travel desk.' });
  });

  it('follows a link to an anchor in the document', async () => {
    const { reader, root } = await mount(`[Claims](#claims-receipts)\n\n${DOC}`);
    root.querySelector('a')!.click();
    expect(reader.position).toBe('claims-receipts');
  });
});

describe('ui-contents', () => {
  it('lists headings as links, marks the one being read, and says which was chosen', async () => {
    const contents = document.createElement('ui-contents');
    contents.items = [
      { id: 'a', text: 'Travel', level: 1 },
      { id: 'b', text: 'Claims', level: 2 },
    ];
    contents.current = 'b';
    document.body.append(contents);
    await contents.updateComplete;
    const root = contents.shadowRoot!;
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Contents');
    const links = [...root.querySelectorAll('a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('aria-current')])).toEqual([
      ['Travel', 'false'],
      ['Claims', 'location'],
    ]);
    const chosen: string[] = [];
    contents.addEventListener('ui-select', (e) => chosen.push((e as CustomEvent).detail.id));
    links[0].click();
    expect(chosen).toEqual(['a']);
  });
});
