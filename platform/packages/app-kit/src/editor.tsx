import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { TextArea, TextField as AriaTextField } from 'react-aria-components';
import { FieldHead, FieldHint, Icon, NEEDS_YOU, cx, shownState, useFieldCheck, useMessage, type FieldProps, type FieldState } from '@augur/kit-common';
import { Ref, Refs, refIcon, refName, type RefKind, type RefShown } from './things.js';

/** One thing named in the text: how it reads there ("@Nora Briggs") and what it points at. */
export interface Mention {
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

/** What the editor writes, as plain words: marks dropped, mentions kept as their names. */
export const plainText = (markdown: string) =>
  readMentions(markdown)
    .text.replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/^(- |> )/gm, '');

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

export interface EditorProps extends FieldProps {
  /** Markdown, with mentions as `[@Name](kind:id)` links. */
  value?: string;
  /** Where it starts when the part keeps its own value (no `value`). */
  defaultValue?: string;
  /** Every change, as Markdown. */
  onChange?: (value: string) => void;
  /** On leaving the field. */
  onCommit?: (value: string) => void;
  name?: string;
  placeholder?: string;
  rows?: number;
  /** A soft guide: "2 sentences", "120 words" or "600 characters". */
  guide?: string;
  mentionSource?: MentionSource;
  autoFocus?: boolean;
}

/**
 * A field for writing more than a line. It writes Markdown and stays quiet
 * while you write: selecting text brings a small bar (bold, italic, list,
 * quote), and Ctrl B and Ctrl I work without it. Type `@` for people and
 * teams or `#` for things and intents; what you choose is saved as a
 * reference and shows as a chip under it. A `guide` counts and says when
 * you've gone past it, but never stops you.
 */
export function Editor({ label, hint, required, optional, disabled, state, message, className, value: given, defaultValue, onChange, onCommit, name, placeholder, rows = 3, guide: guideWords = '', mentionSource, autoFocus }: EditorProps) {
  const [own, setOwn] = useState(defaultValue ?? '');
  const value = given ?? own;
  const [text, setText] = useState(() => readMentions(value).text);
  const [mentions, setMentions] = useState(() => readMentions(value).mentions);
  const written = useRef(value);
  const [check, setCheck] = useState<{ state: FieldState; message?: string }>({ state: 'idle' });
  const [asking, setAsking] = useState<{ trigger: '@' | '#'; query: string; at: number }>();
  const [result, setResult] = useState<MentionResult>();
  const [active, setActive] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const asked = useRef(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<[number, number] | undefined>(undefined);
  const listId = useId();
  const shown = shownState(state, message, check);
  const { describedBy, line } = useMessage(shown.message);

  // A value set from outside is read into text and mentions; one we wrote ourselves is already there.
  useEffect(() => {
    if (value === written.current) return;
    const read = readMentions(value);
    setText(read.text);
    setMentions(read.mentions);
    written.current = value;
  }, [value]);
  useEffect(() => {
    const el = area.current;
    if (el) {
      el.style.height = 'auto';
      if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`;
    }
    if (caret.current && el) {
      el.setSelectionRange(...caret.current);
      el.focus();
      caret.current = undefined;
    }
  }, [text]);

  useFieldCheck({
    check: () => {
      if (required && !text.trim()) {
        setCheck({ state: 'attention', message: NEEDS_YOU });
        return false;
      }
      setCheck({ state: 'idle' });
      return true;
    },
    focus: () => area.current?.focus(),
    name,
    value: () => written.current,
  });

  const write = (next: string, at?: [number, number], kept = mentions) => {
    const still = kept.filter((m) => next.includes(m.text));
    const md = writeMentions(next, still);
    setText(next);
    setMentions(still);
    written.current = md;
    if (given === undefined) setOwn(md);
    if (check.state !== 'idle') setCheck({ state: 'idle' });
    caret.current = at;
    onChange?.(md);
  };
  const closeMentions = () => {
    setAsking(undefined);
    setResult(undefined);
    asked.current++;
  };
  const lookForMention = (el: HTMLTextAreaElement) => {
    if (!mentionSource) return;
    const before = el.value.slice(0, el.selectionStart);
    const m = /(^|\s)([@#])([^\s@#[\]()]{0,40})$/.exec(before);
    if (!m) return closeMentions();
    const trigger = m[2] as '@' | '#';
    const query = m[3]!;
    setAsking({ trigger, query, at: before.length - query.length - 1 });
    const n = ++asked.current;
    void mentionSource(trigger, query).then(
      (r) => {
        if (n !== asked.current) return;
        setResult(r);
        setActive(0);
      },
      () => n === asked.current && setResult({ found: [] }),
    );
  };
  const mention = (ref: RefShown) => {
    if (!asking) return;
    const said = `${asking.trigger}${refName(ref)}`;
    const end = asking.at + 1 + asking.query.length;
    const next = `${text.slice(0, asking.at)}${said} ${text.slice(end)}`;
    const kept = mentions.some((m) => m.text === said) ? mentions : [...mentions, { text: said, ref }];
    closeMentions();
    const to = asking.at + said.length + 1;
    write(next, [to, to], kept);
  };
  const format = (kind: 'bold' | 'italic' | 'list' | 'quote') => {
    const el = area.current;
    if (!el) return;
    const [start, end] = [el.selectionStart, el.selectionEnd];
    if (kind === 'bold' || kind === 'italic') {
      const mark = kind === 'bold' ? '**' : '_';
      const chosen = text.slice(start, end);
      const wrapped = chosen.startsWith(mark) && chosen.endsWith(mark) && chosen.length >= mark.length * 2;
      const next = wrapped ? chosen.slice(mark.length, chosen.length - mark.length) : `${mark}${chosen}${mark}`;
      write(text.slice(0, start) + next + text.slice(end), [start, start + next.length]);
      return;
    }
    const mark = kind === 'list' ? '- ' : '> ';
    const from = text.lastIndexOf('\n', start - 1) + 1;
    const lines = text.slice(from, end).split('\n');
    const all = lines.every((l) => l.startsWith(mark));
    const next = lines.map((l) => (all ? l.slice(mark.length) : l.startsWith(mark) ? l : mark + l)).join('\n');
    write(text.slice(0, from) + next + text.slice(end), [from, from + next.length]);
  };
  const onSelect = () => {
    const el = area.current;
    setSelecting(Boolean(el && el.selectionEnd > el.selectionStart));
  };

  const found = result?.found ?? [];
  const ordered = KINDS.flatMap((kind) => found.filter((r) => r.kind === kind));
  const open = Boolean(asking && result);
  const guide = readGuide(guideWords);
  const used = guide ? measure(text, guide.unit) : 0;
  const over = Boolean(guide && used > guide.n);
  const keep = (e: { preventDefault(): void }) => e.preventDefault();
  let last = '';
  return (
    <AriaTextField
      className={cx('augur-field augur-control relative quill-editor', className)}
      data-state={shown.state}
      data-unavailable={disabled || undefined}
      value={text}
      onChange={() => undefined}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={shown.state === 'error' || shown.state === 'attention'}
      validationBehavior="aria"
      aria-describedby={describedBy}
    >
      <FieldHead label={label} required={required} optional={optional} />
      <FieldHint hint={hint} />
      <div className="augur-field-box quill-editor-box">
        {selecting ? (
          <div className="quill-editor-bar" role="toolbar" aria-label="Format the selection">
            <button type="button" aria-label="Bold" title="Bold (Ctrl B)" onMouseDown={keep} onClick={() => format('bold')}>
              <b>B</b>
            </button>
            <button type="button" aria-label="Italic" title="Italic (Ctrl I)" onMouseDown={keep} onClick={() => format('italic')}>
              <i>I</i>
            </button>
            <button type="button" onMouseDown={keep} onClick={() => format('list')}>
              List
            </button>
            <button type="button" onMouseDown={keep} onClick={() => format('quote')}>
              Quote
            </button>
          </div>
        ) : null}
        <TextArea
          ref={area}
          rows={rows}
          name={name}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="augur-input quill-editor-input"
          role={mentionSource ? 'combobox' : undefined}
          aria-expanded={mentionSource ? open : undefined}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && ordered.length ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            write(e.target.value);
            lookForMention(e.target);
          }}
          onKeyDown={(e) => {
            if (asking && ordered.length) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((active + (e.key === 'ArrowDown' ? 1 : ordered.length - 1)) % ordered.length);
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                mention(ordered[active]!);
                return;
              }
            }
            if (e.key === 'Escape' && asking) {
              e.stopPropagation();
              closeMentions();
              return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
              e.preventDefault();
              format(e.key === 'b' ? 'bold' : 'italic');
            }
          }}
          onSelect={onSelect}
          onMouseUp={onSelect}
          onKeyUp={onSelect}
          onBlur={() => {
            setSelecting(false);
            closeMentions();
            if (required && !text.trim()) setCheck({ state: 'attention', message: NEEDS_YOU });
            onCommit?.(written.current);
          }}
        />
      </div>
      {open && asking && result ? (
        <ul className="quill-editor-found" id={listId} role="listbox" aria-label={asking.trigger === '@' ? 'People and teams' : 'Things and intents'}>
          {ordered.map((ref, i) => {
            const head = GROUP[ref.kind] !== last ? GROUP[ref.kind] : undefined;
            last = GROUP[ref.kind];
            return (
              <li key={`${ref.kind}:${ref.id}`} role="presentation">
                {head ? <div className="quill-editor-group">{head}</div> : null}
                <div className="quill-editor-option" role="option" id={`${listId}-${i}`} aria-selected={i === active} onMouseDown={keep} onClick={() => mention(ref)}>
                  <Icon name={refIcon(ref)} size={14} />
                  {refName(ref)}
                  {ref.floorName ? <small>{ref.floorName}</small> : null}
                </div>
              </li>
            );
          })}
          {!found.length ? (
            <li className="quill-editor-none" role="presentation">
              Nothing by that name.
            </li>
          ) : null}
          {result.closedCount ? (
            <li className="quill-editor-none" role="presentation">
              {result.closedCount} more you can’t open{result.closedReason ? `, ${result.closedReason.replace(/^./, (c) => c.toLowerCase())}` : ''}
            </li>
          ) : null}
        </ul>
      ) : null}
      {mentions.length ? <Refs refs={mentions.map((m) => m.ref)} /> : null}
      {line(
        guide ? (
          <span className="augur-count-text" data-over={over ? '' : undefined}>
            {used} {used === 1 ? guide.unit : `${guide.unit}s`}
            {over ? ` · aim for ${guide.n}` : ''}
          </span>
        ) : null,
      )}
    </AriaTextField>
  );
}

const INLINE = /\*\*([^*\n]+)\*\*|_([^_\n]+)_|\[([@#][^\]\n]+)\]\((entity|document|intent|person|team):([^)\s]+)\)/g;

/** One line's bold, italic and mentions, as elements: nothing is read as HTML. */
const inline = (text: string, onOpen: ((ref: RefShown) => void) | undefined, key = 'i'): ReactNode[] => {
  const out: ReactNode[] = [];
  let at = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{inline(m[1], onOpen, k)}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k}>{inline(m[2], onOpen, k)}</em>);
    else out.push(<Ref key={k} value={{ kind: m[4] as RefKind, id: m[5]!, label: m[3]!.slice(1) }} onOpen={onOpen} />);
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
};

export interface ProseProps {
  /** What the Editor wrote. */
  value: string;
  /** A mention was pressed. */
  onOpen?: (ref: RefShown) => void;
  className?: string;
}

/** Shows what Editor writes: paragraphs, bold, italic, lists, quotes, and mentions as chips. None of it is read as HTML. */
export function Prose({ value, onOpen, className }: ProseProps) {
  const blocks: ReactNode[] = [];
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const lines$ = (l: string[], k: string) => l.flatMap((x, n) => [...(n ? [<br key={`${k}-br-${n}`} />] : []), ...inline(x, onOpen, `${k}-${n}`)]);
  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const k = `b${i}`;
    const run = (mark: string) => {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(mark)) items.push(lines[i++]!.slice(mark.length));
      return items;
    };
    if (line.startsWith('- '))
      blocks.push(
        <ul key={k}>
          {run('- ').map((l, n) => (
            <li key={n}>{inline(l, onOpen, `${k}-${n}`)}</li>
          ))}
        </ul>,
      );
    else if (line.startsWith('> ')) blocks.push(<blockquote key={k}>{lines$(run('> '), k)}</blockquote>);
    else {
      const para: string[] = [];
      while (i < lines.length && lines[i]!.trim() && !lines[i]!.startsWith('- ') && !lines[i]!.startsWith('> ')) para.push(lines[i++]!);
      blocks.push(<p key={k}>{lines$(para, k)}</p>);
    }
  }
  return <div className={cx('quill-prose', className)}>{blocks}</div>;
}
