import { useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { Input, TextField as AriaTextField } from 'react-aria-components';
import { FieldHead, FieldHint, Icon, NEEDS_YOU, StateMark, cx, shownState, useFieldCheck, useMessage, type FieldProps, type FieldState } from '@augur/kit-common';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** A local day as YYYY-MM-DD. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const real = (y: number, m: number, d: number) => {
  const at = new Date(y, m, d);
  return at.getFullYear() === y && at.getMonth() === m && at.getDate() === d ? at : null;
};
const isoOr = (d: Date | null) => (d ? isoDay(d) : null);

/**
 * A day typed in words, as people say it: "13 nov", "nov 13 2027", "13/11",
 * "2026-11-13", "today", "tomorrow", "friday" (the next one), "end of week",
 * "end of month", "+2w", "+3d", "-1m". Returns YYYY-MM-DD, or null.
 */
export const parseDay = (text: string, now = new Date()): string | null => {
  const t = text.trim().toLowerCase().replace(/[,.]/g, ' ').replace(/\s+/g, ' ');
  const today = startOf(now);
  if (!t) return null;
  if (t === 'today' || t === 'now') return isoDay(today);
  if (t === 'tomorrow') return isoDay(new Date(today.getTime() + DAY_MS));
  if (t === 'yesterday') return isoDay(new Date(today.getTime() - DAY_MS));
  if (t === 'end of week') return isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((5 - today.getDay() + 7) % 7)));
  if (t === 'end of month') return isoDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const shift = /^([+-])\s?(\d{1,3})\s?(d|day|days|w|wk|week|weeks|m|month|months|y|year|years)$/.exec(t);
  if (shift) {
    const n = Number(shift[2]) * (shift[1] === '-' ? -1 : 1);
    const unit = shift[3]![0];
    const at = new Date(today);
    if (unit === 'd') at.setDate(at.getDate() + n);
    else if (unit === 'w') at.setDate(at.getDate() + n * 7);
    else if (unit === 'm') at.setMonth(at.getMonth() + n);
    else at.setFullYear(at.getFullYear() + n);
    return isoDay(at);
  }
  const weekday = DAYS.findIndex((d) => t === d || (t.length > 3 && d === t.slice(0, 3) && /^[a-z]+$/.test(t)));
  if (weekday >= 0) return isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((weekday - today.getDay() + 7) % 7 || 7)));
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return isoOr(real(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getFullYear();
    return isoOr(real(y, Number(m[2]) - 1, Number(m[1])));
  }
  const words = t.split(' ').filter((w) => !DAYS.includes(w.slice(0, 3)) || /\d/.test(w) || MONTHS.includes(w.slice(0, 3)));
  const month = words.findIndex((w) => /^[a-z]+$/.test(w) && MONTHS.includes(w.slice(0, 3)));
  const numbers = words.filter((w) => /^\d+(st|nd|rd|th)?$/.test(w)).map((w) => parseInt(w, 10));
  if (month >= 0 && numbers.length >= 1 && numbers.length <= 2 && words.length === numbers.length + 1) {
    const mi = MONTHS.indexOf(words[month]!.slice(0, 3));
    const [day, year] = numbers[0]! > 31 ? [numbers[1], numbers[0]] : numbers;
    if (!day) return null;
    return isoOr(real(year ?? today.getFullYear(), mi, day));
  }
  return null;
};

/** A day in words: "Fri 13 Nov", with the year when it isn't this one. */
export const dayName = (iso: string, now = new Date()) => {
  const d = fromIso(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) }).replace(',', '');
};

/** How far a day is from today, in words: "today", "in 15 days", "3 days ago". */
export const dayDistance = (iso: string, now = new Date()) => {
  const n = Math.round((fromIso(iso).getTime() - startOf(now).getTime()) / DAY_MS);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
};

/** One quick choice beside the field: its words, and what it means in words `parseDay` reads. */
export interface DateQuick {
  label: string;
  value: string;
}

export const DEFAULT_QUICK: DateQuick[] = [
  { label: 'End of week', value: 'end of week' },
  { label: 'End of month', value: 'end of month' },
  { label: 'In two weeks', value: '+2w' },
];

export interface DateFieldProps extends FieldProps {
  /** YYYY-MM-DD, or empty. */
  value?: string;
  /** Where it starts when the part keeps its own value (no `value`). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  /** What an empty day says when you're not typing. */
  empty?: string;
  /** Up to four quick choices. */
  quick?: DateQuick[];
  /** Today, for words and quick choices. Tests set it. */
  now?: Date;
}

/**
 * A day, said in words ("Fri 13 Nov · in 15 days") and typed in words ("13
 * nov", "friday", "+2w"), with up to four quick choices under it and the
 * calendar one press away. Its value is YYYY-MM-DD. Takes part in a Dialog's
 * checks like TextField.
 */
export function DateField({ label, hint, required, optional, disabled, state, message, className, value: given, defaultValue, onChange, name, empty = 'Not set', quick = DEFAULT_QUICK, now = new Date() }: DateFieldProps) {
  const [own, setOwnValue] = useState(defaultValue ?? '');
  const value = given ?? own;
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [check, setCheck] = useState<{ state: FieldState; message?: string }>({ state: 'idle' });
  const shown = shownState(state, message, check);
  const { describedBy, line } = useMessage(shown.message);
  const input = useRef<HTMLInputElement>(null);
  const native = useRef<HTMLInputElement>(null);
  const typing = draft !== undefined;

  const choose = (iso: string) => {
    setDraft(undefined);
    setCheck({ state: 'idle' });
    if (iso === value) return;
    if (given === undefined) setOwnValue(iso);
    onChange?.(iso);
  };
  const commit = () => {
    const text = draft ?? '';
    if (!text.trim()) return choose('');
    const day = parseDay(text, now);
    if (day) return choose(day);
    setCheck({ state: 'error', message: 'Try “13 Nov”, “friday” or “+2w”.' });
  };
  useFieldCheck({
    check: () => {
      if (typing) commit();
      if (check.state === 'error') return false;
      if (required && !value && !(typing && parseDay(draft ?? '', now))) {
        setCheck({ state: 'attention', message: NEEDS_YOU });
        return false;
      }
      return true;
    },
    focus: () => input.current?.focus(),
    name,
    value: () => value,
  });
  const words = value ? `${dayName(value, now)} · ${dayDistance(value, now)}` : '';
  const shownQuick = quick.slice(0, 4);
  return (
    <AriaTextField
      className={cx('augur-field augur-control relative quill-date', className)}
      data-state={shown.state}
      data-unavailable={disabled || undefined}
      value={typing ? draft : words}
      onChange={(v) => {
        setDraft(v);
        if (check.state !== 'idle') setCheck({ state: 'idle' });
      }}
      onFocus={() => setDraft(value ? dayName(value, new Date(0)) : '')}
      onBlur={() => typing && commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape' && typing) {
          setDraft(undefined);
          setCheck({ state: 'idle' });
        } else e.continuePropagation();
      }}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={shown.state === 'error' || shown.state === 'attention'}
      validationBehavior="aria"
      aria-describedby={describedBy}
    >
      <FieldHead label={label} required={required} optional={optional} />
      <FieldHint hint={hint} />
      <div className="augur-field-box">
        <Input ref={input} className="augur-input" placeholder={empty} autoComplete="off" />
        <StateMark state={shown.state} />
        <button
          type="button"
          className="quill-date-cal"
          aria-label="Choose on a calendar"
          disabled={disabled}
          onClick={() => {
            try {
              native.current?.showPicker();
            } catch {
              native.current?.focus();
            }
          }}
        >
          <Icon name="calendar" size={16} />
        </button>
        <input ref={native} className="quill-date-native" type="date" tabIndex={-1} aria-hidden="true" value={value} onChange={(e) => choose(e.target.value)} />
      </div>
      {shownQuick.length || (value && !required) ? (
        <div className="quill-date-quick">
          {shownQuick.map((q) => (
            <button key={q.label} type="button" disabled={disabled} onClick={() => choose(parseDay(q.value, now) ?? '')}>
              {q.label}
            </button>
          ))}
          {value && !required ? (
            <button type="button" disabled={disabled} onClick={() => choose('')}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
      {line()}
    </AriaTextField>
  );
}

/** Whether a file is one `accept` allows: endings (".pdf") and media types ("text/*"), comma separated, as on <input type="file">. */
export const accepts = (accept: string, file: Pick<File, 'name' | 'type'>) => {
  const rules = accept
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (!rules.length) return true;
  const n = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return rules.some((rule) => (rule.startsWith('.') ? n.endsWith(rule) : rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule));
};

export interface DropZoneProps {
  /** What dropping does. */
  heading?: string;
  /** What it takes. */
  hint?: string;
  /** The button's word. */
  action?: string;
  /** As on <input type="file">. Empty takes anything. */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Something is being done with the last files: says so and takes no more until it's done. */
  busy?: boolean;
  /** One line, for a dialog or a panel. */
  compact?: boolean;
  /** The files dropped or chosen that `accept` allows. */
  onFiles?: (files: File[]) => void;
  /** The ones it doesn't. */
  onReject?: (files: File[]) => void;
  className?: string;
}

/**
 * Somewhere to drop files, or press to choose them. It hands over the files
 * it accepts and says which it turned away. Its Choose button is the way in
 * from the keyboard; dropping is a shortcut, never the only way.
 */
export function DropZone({ heading = 'Drop files here', hint, action = 'Choose files', accept = '', multiple = true, disabled, busy, compact, onFiles, onReject, className }: DropZoneProps) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const take = (list: FileList | null | undefined) => {
    if (!list?.length || disabled || busy) return;
    const files = multiple ? [...list] : [list[0]!];
    const taken = files.filter((f) => accepts(accept, f));
    const turned = files.filter((f) => !taken.includes(f));
    if (taken.length) onFiles?.(taken);
    if (turned.length) onReject?.(turned);
  };
  const drag = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    if (e.type === 'dragenter') depth.current++;
    if (e.type === 'dragleave') depth.current = Math.max(0, depth.current - 1);
    setOver(depth.current > 0 && !disabled && !busy);
    if (e.type === 'dragover') e.dataTransfer.dropEffect = disabled || busy ? 'none' : 'copy';
  };
  return (
    <div
      className={cx('quill-drop', className)}
      data-over={over ? '' : undefined}
      data-compact={compact ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      aria-busy={busy || undefined}
      onDragEnter={drag}
      onDragOver={drag}
      onDragLeave={drag}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        take(e.dataTransfer?.files);
      }}
    >
      <Icon name="upload" size={20} />
      <span className="quill-drop-heading">{heading}</span>
      {hint && !compact ? <span className="quill-drop-hint">{hint}</span> : null}
      <button type="button" disabled={disabled || busy} onClick={() => picker.current?.click()}>
        {busy ? 'Working…' : action}
      </button>
      <input
        ref={picker}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        accept={accept || undefined}
        multiple={multiple}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export type SurfaceKind = 'pane' | 'raised' | 'inset' | 'overlay' | 'bar' | 'veil';

export interface SurfaceProps {
  kind?: SurfaceKind;
  pad?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** For a surface that names a region. */
  'aria-label'?: string;
}

/** The flat planes things sit on, stacked in one order only: ground, pane, raised or inset, overlay. */
export function Surface({ kind = 'pane', pad, children, className, style, ...rest }: SurfaceProps) {
  return (
    <div className={cx('quill-surface', className)} data-kind={kind} data-pad={pad ? '' : undefined} style={style} {...rest}>
      {children}
    </div>
  );
}
