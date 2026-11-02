// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateField, parseDay } from './date.js';
import { List, Table } from './list.js';
import { PageHead, Section } from './page.js';
import { Details, Notice, State } from './states.js';
import { Refs, Tally, Timeline } from './things.js';
import { TagPicker, tagChoices } from './tag-picker.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const draw = (node: ReactNode) => {
  document.body.replaceChildren(document.createElement('div'));
  root = createRoot(document.body.firstElementChild!);
  act(() => root!.render(node));
};
afterEach(() => act(() => root?.unmount()));
const text = () => document.body.textContent ?? '';
const button = (name: string) => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name)!;

describe('the parts apps took from the Lit kit', () => {
  it('waits before showing a load, and offers one thing to do after an error', () => {
    vi.useFakeTimers();
    draw(<State kind="loading" heading="Loading plans" />);
    expect(document.querySelector('.quill-state')!.hasAttribute('data-hidden')).toBe(true);
    act(() => vi.advanceTimersByTime(300));
    expect(document.querySelector('.quill-state')!.hasAttribute('data-hidden')).toBe(false);
    vi.useRealTimers();
    const retry = vi.fn();
    draw(<State kind="error" heading="Couldn’t load" action="Try again" onAction={retry} />);
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    act(() => button('Try again').click());
    expect(retry).toHaveBeenCalled();
  });

  it('counts a list, pings the first row that needs you, and says why a row is shut', () => {
    draw(
      <List
        label="Plans"
        noun={['plan', 'plans']}
        items={[
          { id: 'a', title: 'Budget', status: 'needs' },
          { id: 'b', title: 'Roster', status: 'needs' },
          { id: 'c', title: 'Kept', disabled: true, reason: 'Kept on Finance. Ask its leads.' },
        ]}
      />,
    );
    expect(text()).toContain('3 plans');
    expect(document.querySelectorAll('.quill-list-lead[data-first]')).toHaveLength(1);
    expect(text()).toContain('Kept on Finance. Ask its leads.');
  });

  it('sorts a table by a header, then the reverse, then not at all', () => {
    const rows = [
      { id: '1', name: 'Beta', size: 2 },
      { id: '2', name: 'Alpha', size: 10 },
    ];
    const sorts = vi.fn();
    draw(<Table noun="files" columns={[{ key: 'name', label: 'Name', sortable: true }, { key: 'size', label: 'Size', kind: 'number' }]} rows={rows} onSort={sorts} />);
    const names = () => [...document.querySelectorAll('.quill-table-cell[data-primary]')].map((c) => c.textContent);
    expect(names()).toEqual(['Beta', 'Alpha']);
    const head = () => document.querySelector<HTMLElement>('.quill-table-head[data-allows-sorting]')!;
    act(() => head().click());
    expect(names()).toEqual(['Alpha', 'Beta']);
    act(() => head().click());
    expect(names()).toEqual(['Beta', 'Alpha']);
    act(() => head().click());
    expect(sorts).toHaveBeenLastCalledWith(null);
    expect(text()).toContain('2 files');
  });

  it('folds a long trail and puts actions past two in More', () => {
    draw(
      <PageHead
        heading="Leave"
        trail={['Policies', 'HR', 'People', 'Leave'].map((l) => ({ id: l, label: l }))}
        actions={[
          { id: 'a', label: 'Publish', kind: 'primary' },
          { id: 'b', label: 'Share', kind: 'primary' },
          { id: 'c', label: 'Archive' },
        ]}
      />,
    );
    expect(button('Show 2 more steps')).toBeDefined();
    expect(button('Publish')).toBeDefined();
    expect(button('Archive')).toBeUndefined();
    expect(button('More')).toBeDefined();
  });

  it('folds a section past its limit and says how many more', () => {
    draw(
      <Section label="Parts" limit={2}>
        <p>one</p>
        <p>two</p>
        <p>three</p>
      </Section>,
    );
    expect(text()).toContain('1 more');
    expect(text()).not.toContain('three');
    act(() => button('1 more').click());
    expect(text()).toContain('three');
  });

  it('says what isn’t known instead of leaving a gap', () => {
    draw(<Details items={[{ label: 'Owner', value: '' }, { label: 'Floor', value: 'Finance' }]} />);
    expect(text()).toContain('Not known');
  });

  it('draws a tally and says only what needs attention', () => {
    draw(<Tally noun={['part', 'parts']} counts={[{ status: 'done', n: 5, word: 'done' }, { status: 'failed', n: 1, word: 'blocked', loud: true }]} />);
    expect(document.querySelectorAll('.quill-tally-bar i')).toHaveLength(6);
    expect(document.querySelector('.quill-tally-words')!.textContent).toBe('6 parts · 1 blocked');
  });

  it('groups what happened by day', () => {
    draw(<Timeline now={new Date('2026-11-02T12:00:00')} items={[{ at: '2026-11-02T09:00:00', who: 'Sam', what: 'judged it at risk' }, { at: '2026-11-01T09:00:00', who: 'You', what: 'set it' }]} />);
    expect(text()).toContain('Today');
    expect(text()).toContain('Yesterday');
  });

  it('counts the refs you can’t open', () => {
    draw(<Refs refs={[{ kind: 'document', id: 'd', title: 'Leave' }]} closedCount={2} closedReason="Kept on Finance." />);
    expect(text()).toContain('2 you can’t open');
  });

  it('reads days in words and says them back', () => {
    const now = new Date('2026-11-02T12:00:00');
    expect(parseDay('13 nov', now)).toBe('2026-11-13');
    expect(parseDay('+2w', now)).toBe('2026-11-16');
    expect(parseDay('nonsense', now)).toBeNull();
    const change = vi.fn();
    draw(<DateField label="Due" now={now} onChange={change} />);
    act(() => button('End of month').click());
    expect(change).toHaveBeenCalledWith('2026-11-30');
  });

  it('shows a notice’s tone and its one action', () => {
    const act$ = vi.fn();
    draw(<Notice tone="needs" heading="Waiting for your back-brief." action="Write it" onAction={act$} more={2} />);
    expect(text()).toContain('2 more need you.');
  });
});

describe('picking tags', () => {
  const people = [
    { value: 'u1', label: 'Nora Briggs' },
    { value: 'u2', label: 'Ben Norris' },
    { value: 'u3', label: 'Ada Lee' },
  ];

  it('offers what isn’t chosen, those that start with the word first, and a new one when it may', () => {
    expect(tagChoices(people, ['u3'], 'nor', false).map((c) => c.id)).toEqual(['u1', 'u2']);
    expect(tagChoices(people, [], 'Kim', true).map((c) => c.add)).toEqual(['Kim']);
    expect(tagChoices(people, [], 'ada lee', true).some((c) => c.add)).toBe(false);
  });

  it('shows the chosen as tags, takes one off with its ×, and says when it’s full', () => {
    const change = vi.fn();
    draw(<TagPicker label="Developers" options={people} defaultValue={['u1', 'u2']} max={2} onChange={change} />);
    expect([...document.querySelectorAll('.quill-tag-word')].map((t) => t.textContent)).toEqual(['Nora Briggs', 'Ben Norris']);
    expect(document.querySelector('input')!.placeholder).toContain('most it takes: 2');
    act(() => button('Remove Nora Briggs').click());
    expect(change).toHaveBeenLastCalledWith(['u2']);
  });
});

describe('writing and trees', () => {
  it('writes Markdown, keeps a chosen mention as a link, and counts against its guide', async () => {
    const { Editor } = await import('./editor.js');
    const seen: string[] = [];
    const source = vi.fn(async () => ({ found: [{ kind: 'person' as const, id: 'u1', label: 'Nora Briggs' }] }));
    draw(<Editor label="Brief" guide="1 sentence" mentionSource={source} onChange={(v) => seen.push(v)} />);
    const area = document.querySelector('textarea')!;
    const type = async (value: string) => {
      await act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
        set.call(area, value);
        area.setSelectionRange(value.length, value.length);
        area.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    await type('Ask @No');
    expect(source).toHaveBeenCalledWith('@', 'No');
    await act(async () => (document.querySelector('[role="option"]') as HTMLElement).click());
    expect(seen.at(-1)).toBe('Ask [@Nora Briggs](person:u1) ');
    expect(document.querySelector('.quill-ref')).not.toBeNull();
    await type('Ask @Nora Briggs. And more. ');
    expect(text()).toContain('aim for 1');
  });

  it('shows what the editor wrote without reading any of it as HTML', async () => {
    const { Prose } = await import('./editor.js');
    draw(<Prose value={'**Bold** and <b>not</b>\n- one\n- two\n> said'} />);
    expect(document.querySelector('strong')!.textContent).toBe('Bold');
    expect(document.querySelectorAll('li')).toHaveLength(2);
    expect(document.querySelector('b')).toBeNull();
    expect(document.querySelector('blockquote')!.textContent).toBe('said');
  });

  it('opens the rows above the selected one and says which was chosen', async () => {
    const { Tree } = await import('./tree.js');
    const chosen = vi.fn();
    draw(<Tree label="Folders" selected="hr" onSelect={chosen} items={[{ id: 'p', label: 'Policies', children: [{ id: 'hr', label: 'HR' }, { id: 'it', label: 'IT' }] }, { id: 'x', label: 'Other' }]} />);
    const rows = () => [...document.querySelectorAll('[role="row"]')].map((r) => r.textContent);
    expect(rows()).toEqual(['Policies', 'HR', 'IT', 'Other']);
    act(() => (document.querySelectorAll('[role="row"]')[2] as HTMLElement).click());
    expect(chosen).toHaveBeenCalledWith(expect.objectContaining({ id: 'it' }));
  });
});
