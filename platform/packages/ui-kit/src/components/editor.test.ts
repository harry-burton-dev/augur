import { describe, expect, it, vi } from 'vitest';
import './editor.js';
import './prose.js';
import { plainText } from './prose.js';
import type { UiProse } from './prose.js';
import { readMentions, writeMentions } from './editor.js';
import type { MentionSource, UiEditor } from './editor.js';

const settle = async (el: UiEditor) => {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

const mount = async (props: Partial<UiEditor> = {}) => {
  const el = document.createElement('ui-editor') as UiEditor;
  Object.assign(el, props);
  document.body.replaceChildren(el);
  await settle(el);
  return el;
};
const area = (el: UiEditor) => el.shadowRoot!.querySelector('textarea')!;
const type = (el: UiEditor, text: string) => {
  const a = area(el);
  a.value = text;
  a.setSelectionRange(text.length, text.length);
  a.dispatchEvent(new Event('input'));
};

describe('mentions in Markdown', () => {
  it('reads links into what people see, and writes them back', () => {
    const md = 'Keep [#Port Halden](entity:ent_1) open; ask [@Nora Briggs](person:u1).';
    const { text, mentions } = readMentions(md);
    expect(text).toBe('Keep #Port Halden open; ask @Nora Briggs.');
    expect(mentions.map((m) => m.ref)).toEqual([
      { kind: 'entity', id: 'ent_1', label: 'Port Halden' },
      { kind: 'person', id: 'u1', label: 'Nora Briggs' },
    ]);
    expect(writeMentions(text, mentions)).toBe(md);
  });
});

describe('ui-editor', () => {
  it('turns @ and # into references, and saves them as links', async () => {
    const source: MentionSource = vi.fn(async (trigger) =>
      trigger === '#'
        ? { found: [{ kind: 'entity', id: 'ent_1', type: 'port', label: 'Port Halden' }, { kind: 'intent', id: 'i1', title: 'Keep Port Halden open' }], closedCount: 1, closedReason: 'Kept on Finance.' }
        : { found: [] },
    ) as MentionSource;
    const el = await mount({ label: 'Purpose', mentionSource: source });
    type(el, 'So ships are not sent south to #hal');
    await settle(el);
    expect(source).toHaveBeenCalledWith('#', 'hal');
    const root = el.shadowRoot!;
    expect([...root.querySelectorAll('.group')].map((g) => g.textContent)).toEqual(['Things', 'Intents']);
    expect(root.querySelector('.closed')!.textContent).toBe('1 more you can’t open, kept on Finance.');
    area(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle(el);
    expect(el.value).toBe('So ships are not sent south to [#Port Halden](entity:ent_1) ');
    expect(el.refs).toEqual([{ kind: 'entity', id: 'ent_1', label: 'Port Halden' }]);
    expect(root.querySelector('.found')).toBeNull();
    expect(root.querySelector('ui-refs')!.refs).toHaveLength(1);
  });

  it('forgets a mention once its words are deleted', async () => {
    const el = await mount({ value: 'Ask [@Nora Briggs](person:u1)' });
    expect(area(el).value).toBe('Ask @Nora Briggs');
    type(el, 'Ask Nora');
    await settle(el);
    expect(el.value).toBe('Ask Nora');
    expect(el.refs).toEqual([]);
  });

  it('bolds a selection and makes lines a list', async () => {
    const el = await mount({ value: 'Refit Hull 4\nDredge the channel' });
    area(el).setSelectionRange(0, 5);
    el.format('bold');
    await settle(el);
    expect(el.value).toBe('**Refit** Hull 4\nDredge the channel');
    area(el).setSelectionRange(0, el.value.length);
    el.format('list');
    await settle(el);
    expect(el.value).toBe('- **Refit** Hull 4\n- Dredge the channel');
  });

  it('counts against its guide, and says so without stopping you', async () => {
    const el = await mount({ guide: '2 sentences' });
    type(el, 'One. Two. Three.');
    await settle(el);
    const count = el.shadowRoot!.querySelector('.count')!;
    expect(count.textContent).toBe('3 sentences · aim for 2');
    expect(count.classList.contains('over')).toBe(true);
    expect(el.check()).toBe(true);
  });

  it('asks in green when it’s required and empty', async () => {
    const el = await mount({ required: true });
    expect(el.check()).toBe(false);
    expect(el.state).toBe('attention');
  });
});

describe('ui-prose', () => {
  it('shows what the editor writes, with mentions as chips, and nothing as HTML', async () => {
    const el = document.createElement('ui-prose') as UiProse;
    el.value = 'Keep **[#Port Halden](entity:ent_1)** open.\n\n- Refit _Hull 4_\n- <b>Dredge</b>\n\n> Two hulls in dock';
    document.body.replaceChildren(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector('strong ui-ref')!.ref).toEqual({ kind: 'entity', id: 'ent_1', label: 'Port Halden' });
    expect([...root.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['Refit Hull 4', '<b>Dredge</b>']);
    expect(root.querySelector('li em')!.textContent).toBe('Hull 4');
    expect(root.querySelector('b')).toBeNull();
    expect(root.querySelector('blockquote')!.textContent).toBe('Two hulls in dock');
  });

  it('gives plain words for places that only take a line', () => {
    expect(plainText('Keep **[#Port Halden](entity:ent_1)** open, _now_.')).toBe('Keep #Port Halden open, now.');
  });
});
