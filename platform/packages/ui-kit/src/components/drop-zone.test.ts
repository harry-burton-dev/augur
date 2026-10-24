import { beforeEach, describe, expect, it } from 'vitest';
import './drop-zone.js';
import { accepts, type UiDropZone } from './drop-zone.js';

let zone: UiDropZone;
const root = () => zone.shadowRoot!;
const file = (name: string, type = '') => new File(['x'], name, { type });
const drop = (files: File[], kind = 'drop') => {
  const e = new Event(kind, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(e, 'dataTransfer', { value: { files, types: ['Files'], dropEffect: 'none' } });
  root().querySelector('.zone')!.dispatchEvent(e);
};

beforeEach(async () => {
  document.body.innerHTML = '<ui-drop-zone accept=".pdf,.md,text/*" hint="PDF, Markdown or text"></ui-drop-zone>';
  zone = document.querySelector('ui-drop-zone')!;
  await zone.updateComplete;
});

describe('ui-drop-zone', () => {
  it('matches files to accept by ending or media type', () => {
    expect(accepts('.pdf, text/*', file('Report.PDF'))).toBe(true);
    expect(accepts('.pdf, text/*', file('notes', 'text/plain'))).toBe(true);
    expect(accepts('.pdf, text/*', file('deck.pptx'))).toBe(false);
    expect(accepts('application/pdf', file('a.pdf', 'application/pdf'))).toBe(true);
    expect(accepts('', file('anything.bin'))).toBe(true);
  });

  it('hands over the files it takes, and says which it turned away', () => {
    const seen: string[] = [];
    zone.addEventListener('ui-files', (e) => seen.push(`files ${(e as CustomEvent).detail.files.map((f: File) => f.name).join(' ')}`));
    zone.addEventListener('ui-reject', (e) => seen.push(`reject ${(e as CustomEvent).detail.files.map((f: File) => f.name).join(' ')}`));
    drop([file('a.pdf'), file('deck.pptx'), file('b.md')]);
    expect(seen).toEqual(['files a.pdf b.md', 'reject deck.pptx']);
  });

  it('shows when files are over it', async () => {
    drop([], 'dragenter');
    await zone.updateComplete;
    expect(zone.over).toBe(true);
    drop([], 'dragleave');
    await zone.updateComplete;
    expect(zone.over).toBe(false);
  });

  it('takes nothing while busy or off, and says it is working', async () => {
    const seen: unknown[] = [];
    zone.addEventListener('ui-files', (e) => seen.push(e));
    zone.busy = true;
    await zone.updateComplete;
    drop([file('a.pdf')]);
    expect(seen).toEqual([]);
    expect(root().querySelector('button')!.textContent).toBe('Working…');
    expect(root().querySelector('button')!.disabled).toBe(true);
  });

  it('leaves the hint out when compact', async () => {
    expect(root().querySelector('.hint')!.textContent).toBe('PDF, Markdown or text');
    zone.compact = true;
    await zone.updateComplete;
    expect(root().querySelector('.hint')).toBeNull();
  });

  it('takes one file when it isn’t multiple', () => {
    zone.multiple = false;
    const seen: number[] = [];
    zone.addEventListener('ui-files', (e) => seen.push((e as CustomEvent).detail.files.length));
    drop([file('a.pdf'), file('b.pdf')]);
    expect(seen).toEqual([1]);
  });
});
