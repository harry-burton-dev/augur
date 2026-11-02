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
import { Lifecycle } from './lifecycle.js';
import { FilterBar, filterValue } from './filter-bar.js';
import { Contents, Reader, loadReader, slugFor, type ReaderHandle } from './reader.js';
import { PeoplePicker, principalRows } from './people-picker.js';

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

describe('lifecycles and people', () => {
  const states = [
    { id: 'draft', name: 'Draft' },
    { id: 'review', name: 'In review' },
    { id: 'issued', name: 'Issued' },
    { id: 'retired', name: 'Retired' },
  ];

  it('rings where a record is, hides off-line states, and offers its moves or says why not', () => {
    const move = vi.fn();
    draw(<Lifecycle label="Version 3" states={states} state="review" offLine={['retired']} moves={['issued']} onMove={move} />);
    expect([...document.querySelectorAll('.quill-lifecycle li')].map((l) => l.textContent)).toEqual(['Draft', 'In review', 'Issued']);
    expect(document.querySelector('[aria-current="step"]')!.textContent).toBe('In review');
    expect(document.querySelector('ol')!.getAttribute('aria-label')).toBe('Version 3: In review');
    act(() => button('Make it Issued').click());
    expect(move).toHaveBeenCalledWith('issued');
    draw(<Lifecycle states={states} state="retired" offLine={['retired']} why="Only its library’s leads can move it." />);
    expect(text()).toContain('Retired');
    expect(text()).toContain('Only its library’s leads can move it.');
    expect(document.querySelector('.quill-lifecycle-moves')).toBeNull();
  });

  it('says a team’s size, and why one can’t be chosen', () => {
    const rows = principalRows(
      [
        { kind: 'team', id: 't1', name: 'Ops', size: 4 },
        { kind: 'person', id: 'u1', name: 'Nora Briggs', detail: 'Ops' },
      ],
      [{ kind: 'person', id: 'u1', name: 'Nora Briggs' }],
    );
    expect(rows[0]).toMatchObject({ id: 'team:t1', detail: '4 people', icon: 'people' });
    expect(rows[1]).toMatchObject({ disabled: true, reason: 'Already chosen.' });
  });

  it('looks after typing, and gathers what’s picked as chips', async () => {
    const search = vi.fn(async () => [
      { kind: 'person' as const, id: 'u1', name: 'Nora Briggs', detail: 'Ops' },
      { kind: 'team' as const, id: 't1', name: 'Ops', size: 4 },
    ]);
    const change = vi.fn();
    draw(<PeoplePicker label="Who" multiple kinds="people" search={search} pause={0} onChange={change} />);
    const input = document.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'No');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(search).toHaveBeenCalledWith('No');
    const rows = [...document.querySelectorAll<HTMLElement>('.quill-list-row')];
    expect(rows).toHaveLength(1);
    await act(async () => rows[0]!.click());
    expect(change).toHaveBeenLastCalledWith([{ kind: 'person', id: 'u1', name: 'Nora Briggs', detail: 'Ops' }]);
    expect(document.querySelector('.quill-ref-name')!.textContent).toBe('Nora Briggs');
    expect(document.querySelector('input')!.value).toBe('');
  });
});

describe('filtering', () => {
  const filters = [
    { id: 'tag', label: 'Tags', options: [{ value: 't1', label: 'Travel' }, { value: 't2', label: 'Leave' }] },
    { id: 'since', label: 'Changed', single: true, options: [{ value: 'week', label: 'Past week' }] },
  ];

  it('drops unknown or empty filters from a value', () => {
    expect(filterValue(filters, { tag: ['t1', 'gone'], since: [], other: ['x'] })).toEqual({ tag: ['t1'] });
  });

  it('counts, shows what’s on as tags, takes one off, and clears them all', () => {
    const change = vi.fn();
    draw(<FilterBar label="Filter documents" filters={filters} value={{ tag: ['t1', 't2'] }} sorts={[{ value: 'title', label: 'Title' }]} sort="title" count={3} noun={['document', 'documents']} onChange={change} />);
    expect(text()).toContain('3 documents');
    expect(text()).toContain('Sort: Title');
    expect(button('Tags, 2 chosen')).toBeDefined();
    expect([...document.querySelectorAll('.quill-filter-chips .quill-tag-word')].map((t) => t.textContent)).toEqual(['Travel', 'Leave']);
    act(() => button('Remove Tags: Travel').click());
    expect(change).toHaveBeenLastCalledWith({ tag: ['t2'] }, 'title');
    act(() => button('Clear all').click());
    expect(change).toHaveBeenLastCalledWith({}, 'title');
  });

  it('adds a choice from a filter’s menu, and replaces it for a single one', async () => {
    const change = vi.fn();
    draw(<FilterBar label="Filter documents" filters={filters} value={{ tag: ['t1'] }} onChange={change} />);
    await act(async () => button('Tags, 1 chosen').click());
    const leave = [...document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')].find((i) => i.textContent?.includes('Leave'))!;
    await act(async () => leave.click());
    expect(change).toHaveBeenLastCalledWith({ tag: ['t1', 't2'] }, '');
  });
});

describe('reading', () => {
  it('anchors every block, drops a first heading that repeats the title, and escapes HTML', async () => {
    await loadReader();
    const outline = vi.fn();
    const handle: { current: ReaderHandle | null } = { current: null };
    draw(<Reader ref={handle} heading="Plan" markdown={'# Plan\n\nIntro <b>bold</b>\n\n## 2. Claims & receipts\n\nMore [up](#plan) and [out](https://example.org)'} onOutline={outline} />);
    await act(async () => {});
    const article = document.querySelector('.quill-reader')!;
    expect(article.querySelector('h1')!.hidden).toBe(true);
    expect(article.querySelector('b')).toBeNull();
    expect(article.textContent).toContain('<b>bold</b>');
    expect(article.querySelector('#claims-receipts')).not.toBeNull();
    expect(article.querySelector('a[href^="https"]')!.getAttribute('rel')).toBe('noopener noreferrer');
    expect(outline).toHaveBeenLastCalledWith([{ id: 'claims-receipts', text: '2. Claims & receipts', level: 2 }]);
    expect(handle.current!.headingFor('b4')).toBe('claims-receipts');
    expect(handle.current!.goTo('b2', { focus: true })).toBe(true);
    expect(document.activeElement?.id).toBe('b2');
    expect(slugFor('Café ünd Ölé')).toBe('cafe-und-ole');
  });

  it('lists headings from the top level there is and marks the one being read', () => {
    const pick = vi.fn();
    draw(<Contents items={[{ id: 'a', text: 'A', level: 2 }, { id: 'b', text: 'B', level: 3 }]} current="b" onSelect={pick} />);
    expect([...document.querySelectorAll('.quill-contents li')].map((l) => l.getAttribute('data-level'))).toEqual(['1', '2']);
    expect(document.querySelector('[aria-current="location"]')!.textContent).toBe('B');
    act(() => (document.querySelector('a') as HTMLElement).click());
    expect(pick).toHaveBeenCalledWith('a');
  });

  it('loads pictures only through the host, and names the ones it can’t find', async () => {
    await loadReader();
    const source = vi.fn(async (src: string) => (src === 'a.png' ? 'blob:a' : undefined));
    draw(<Reader markdown={'![Map](a.png)\n\n![Chart](b.png)'} imageSource={source} />);
    await act(async () => {});
    expect(document.querySelector('img')!.getAttribute('src')).toBe('blob:a');
    expect(document.querySelector('.quill-reader-missing')!.textContent).toBe('[Picture: Chart]');
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
