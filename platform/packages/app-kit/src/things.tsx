import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, cx, type IconName } from '@augur/kit-common';
import { Status, type StatusName } from './states.js';

export type FloorKind = 'personal' | 'team' | 'org';

/** The floor colours a mark is drawn in: the readable, upper glow of each kind. */
export const floorMark: Record<FloorKind, string> = { personal: 'var(--floor-you-high)', team: 'var(--floor-team-high)', org: 'var(--floor-org-high)' };
export const floorIcon: Record<FloorKind, IconName> = { personal: 'account', team: 'people', org: 'org' };
const floorStyle = (kind?: FloorKind) => ({ '--floor': kind ? floorMark[kind] : 'var(--ink-muted)' }) as CSSProperties;

export interface CardProps {
  heading: string;
  status?: StatusName;
  /** The status in words, when the kit's own word isn't the right one. */
  statusLabel?: string;
  /** A kit icon in the corner instead of a status. */
  icon?: IconName;
  floorKind?: FloorKind;
  floorName?: string;
  /** Up to three short facts after the floor; extras are dropped. */
  meta?: string[];
  /** The one line that changes what you'd do. */
  note?: string;
  noteTone?: 'warning' | 'danger' | 'ink';
  unavailable?: boolean;
  /** Why it can't be opened, in one sentence; takes the meta line's place. */
  reason?: string;
  onOpen?: () => void;
  /** A Tally under the lines. */
  tally?: ReactNode;
  className?: string;
}

/**
 * One thing in a grid of things: a title, its mark, one line of meta, and at
 * most one more line. The whole card opens it; there are no buttons inside.
 * Its floor shows as a dot with the floor's name. Unavailable, it stays,
 * dashed with a lock, and says why.
 */
export function Card({ heading, status, statusLabel, icon, floorKind, floorName, meta = [], note, noteTone = 'warning', unavailable, reason, onOpen, tally, className }: CardProps) {
  const facts = [
    ...(floorKind || floorName
      ? [
          <span key="floor" className="quill-card-floor" style={floorStyle(floorKind)}>
            {floorName}
          </span>,
        ]
      : []),
    ...meta.slice(0, 3).map((m, i) => <span key={i}>{m}</span>),
  ];
  const mark = unavailable ? <Icon name="lock" size={14} /> : status ? <Status status={status} label={statusLabel} /> : icon ? <Icon name={icon} size={14} /> : null;
  const inner = (
    <>
      <span className="quill-card-top">
        <span className="quill-card-title">{heading}</span>
        {mark}
      </span>
      <span className="quill-card-meta">{unavailable && reason ? <span>{reason}</span> : facts}</span>
      {note && !unavailable ? (
        <span className="quill-card-note" data-tone={noteTone} title={note}>
          {note}
        </span>
      ) : null}
      {tally}
    </>
  );
  return unavailable ? (
    <div className={cx('quill-card', className)} data-unavailable="" aria-disabled="true">
      {inner}
    </div>
  ) : (
    <button type="button" className={cx('quill-card', className)} onClick={onOpen}>
      {inner}
    </button>
  );
}

/** Lays cards out in a grid that fills its width: as many columns as fit, none narrower than 260px. */
export function Cards({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cx('quill-cards', className)}>{children}</div>;
}

export interface TallyCount {
  /** `done` green, `warning` amber, `failed` red, `queued` faint; anything else plain. */
  status: StatusName;
  n: number;
  /** What one of them is, in words. */
  word: string;
  /** Said out loud under the bar; quiet counts are only drawn. */
  loud?: boolean;
}

export interface TallyProps {
  /** Up to five kinds, drawn in order. */
  counts: TallyCount[];
  noun?: [string, string];
  size?: 'sm' | 'md';
  className?: string;
}

/** Counts drawn as a short bar of segments, with words only for the total and what needs attention. */
export function Tally({ counts: all, noun = ['thing', 'things'], size = 'sm', className }: TallyProps) {
  const counts = all.slice(0, 5).filter((c) => c.n > 0);
  const total = counts.reduce((sum, c) => sum + c.n, 0);
  const [one, many] = noun;
  const said = `${total} ${total === 1 ? one : many}${counts.length ? `: ${counts.map((c) => `${c.n} ${c.word}`).join(', ')}` : ''}`;
  const segments =
    total > 24
      ? counts.map((c, i) => <i key={i} data-status={c.status} style={{ flexGrow: c.n }} />)
      : counts.flatMap((c, i) => Array.from({ length: c.n }, (_, j) => <i key={`${i}-${j}`} data-status={c.status} />));
  return (
    <div className={cx('quill-tally', className)} data-size={size}>
      <div className="quill-tally-bar" role="img" aria-label={said} title={said}>
        {segments}
      </div>
      <div className="quill-tally-words" aria-hidden="true">
        {total} {total === 1 ? one : many}
        {counts
          .filter((c) => c.loud)
          .map((c, i) => (
            <span key={i}>
              {' · '}
              <b data-status={c.status}>
                {c.n} {c.word}
              </b>
            </span>
          ))}
      </div>
    </div>
  );
}

export interface TimelineItem {
  id?: string;
  /** When, as an ISO date and time. */
  at: string;
  /** Who did it, in bold. */
  who: string;
  /** What they did, as the rest of the sentence. */
  what: ReactNode;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Yesterday", or the day as "Tue 27 Oct" (with the year when it isn't this year). */
export const dayWords = (at: Date, now = new Date()) => {
  if (sameDay(at, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(at, yesterday)) return 'Yesterday';
  return at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) }).replace(',', '');
};

export interface TimelineProps {
  items: TimelineItem[];
  /** How many show before "Earlier"; 0 shows them all. */
  limit?: number;
  /** Today, for tests and stories. */
  now?: Date;
  className?: string;
}

/** What happened, newest first, grouped by day: who, then what, at a time of day. Five show; the rest wait behind "Earlier". */
export function Timeline({ items, limit = 5, now = new Date(), className }: TimelineProps) {
  const [open, setOpen] = useState(false);
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  const folds = limit > 0 && sorted.length > limit;
  const shown = folds && !open ? sorted.slice(0, limit) : sorted;
  const rows: ReactNode[] = [];
  let last = '';
  shown.forEach((item, i) => {
    const at = new Date(item.at);
    const day = dayWords(at, now);
    if (day !== last)
      rows.push(
        <li key={`day-${i}`} className="quill-timeline-day quill-label">
          {day}
        </li>,
      );
    last = day;
    rows.push(
      <li key={item.id ?? `ev-${i}`} className="quill-timeline-ev">
        <time dateTime={item.at}>{at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
        <span>
          <b>{item.who}</b> {item.what}
        </span>
      </li>,
    );
  });
  return (
    <div className={cx('quill-timeline', className)}>
      <ol>{rows}</ol>
      {folds ? (
        <button type="button" className="quill-fold" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Fewer' : 'Earlier'}
        </button>
      ) : null}
    </div>
  );
}

export interface PathStep {
  id?: string;
  /** Which kind of floor it's on: its disc is drawn in that floor's colour. */
  floor: FloorKind;
  title: string;
  /** One line under it. */
  line?: string;
  /** A word or two after the title, in tracked capitals. */
  mark?: string;
  /** `no` marks a step that refuses or blocks (red); otherwise green. */
  markTone?: 'yes' | 'no';
  /** The step you're on: ringed. */
  here?: boolean;
}

export interface PathProps {
  steps: PathStep[];
  onOpen?: (step: PathStep) => void;
  className?: string;
}

/** A chain of floors or steps with one of them marked: each a disc in its floor's colour, joined by a line. */
export function Path({ steps, onOpen, className }: PathProps) {
  return (
    <ol className={cx('quill-path', className)}>
      {steps.map((s, i) => (
        <li key={s.id ?? i} data-here={s.here ? '' : undefined} style={floorStyle(s.floor)} aria-current={s.here ? 'step' : undefined}>
          <span className="quill-path-disc" aria-hidden="true">
            <Icon name={floorIcon[s.floor]} size={14} />
          </span>
          <span className="quill-path-title">
            {s.id && !s.here ? (
              <button type="button" onClick={() => onOpen?.(s)}>
                {s.title}
              </button>
            ) : (
              <span>{s.title}</span>
            )}
            {s.mark ? (
              <span className="quill-label quill-path-mark" data-tone={s.markTone}>
                {s.mark}
              </span>
            ) : null}
          </span>
          <span className="quill-path-line">{s.line}</span>
        </li>
      ))}
    </ol>
  );
}

/** What a reference points at. */
export type RefKind = 'entity' | 'document' | 'intent' | 'person' | 'team';

/** A thing from any app, as a chip shows it: the SDK's EntityRef, DocumentRef and IntentRef all fit. */
export interface RefShown {
  kind: RefKind;
  id: string;
  label?: string;
  title?: string;
  /** An entity's kind in the ontology ("vessel"), which picks its icon. */
  type?: string;
  /** Set when it's kept on another floor than this page's. */
  floorKind?: FloorKind;
  floorName?: string;
  /** Where it came from, when it isn't this page's own: it can't be removed here. */
  from?: string;
}

const entityIcons = new Set(['vessel', 'aircraft', 'vehicle', 'place', 'port', 'facility', 'event']);

/** The kit icon for a reference: an entity's own kind where the kit draws one. */
export const refIcon = (ref: Pick<RefShown, 'kind' | 'type'>): IconName =>
  ref.kind === 'entity'
    ? ref.type && entityIcons.has(ref.type)
      ? (ref.type as IconName)
      : 'atlas'
    : ({ document: 'document', intent: 'compass', person: 'person', team: 'people' } as const)[ref.kind];

export const refName = (ref: RefShown) => ref.label || ref.title || 'Untitled';

export interface RefProps {
  value: RefShown;
  onOpen?: (ref: RefShown) => void;
  /** With it, a × takes it off this page; refs that come `from` somewhere else never show it. */
  onRemove?: (ref: RefShown) => void;
  className?: string;
}

/** A thing from any app as a small chip: its kind's icon, its name, and a floor dot when it's kept on another floor. Things open; text never links. */
export function Ref({ value: ref, onOpen, onRemove, className }: RefProps) {
  const name = refName(ref);
  const title = [ref.from ? `From ${ref.from}` : '', ref.floorName ? `Kept on ${ref.floorName}` : ''].filter(Boolean).join(' · ');
  return (
    <span className={cx('quill-ref', className)}>
      <button type="button" className="quill-ref-open" title={title || undefined} onClick={() => onOpen?.(ref)}>
        <Icon name={refIcon(ref)} size={14} />
        <span className="quill-ref-name">{name}</span>
        {ref.floorKind ? <span className="quill-ref-dot" style={floorStyle(ref.floorKind)} aria-hidden="true" /> : null}
        {title ? <span className="quill-sr">, {title}</span> : null}
      </button>
      {onRemove && !ref.from ? (
        <button type="button" className="quill-ref-remove" aria-label={`Remove ${name}`} onClick={() => onRemove(ref)}>
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </span>
  );
}

export interface RefsProps {
  refs: RefShown[];
  /** How many the person can't open: counted, not dropped. */
  closedCount?: number;
  /** Where those are kept and who to ask, in one sentence. */
  closedReason?: string;
  onOpen?: (ref: RefShown) => void;
  onRemove?: (ref: RefShown) => void;
  /** Said when there are none at all; left out, it says nothing. */
  empty?: string;
  className?: string;
}

/** References as a wrapping row of chips; the ones the person can't open are counted in a last chip that says where and who to ask. */
export function Refs({ refs, closedCount = 0, closedReason, onOpen, onRemove, empty, className }: RefsProps) {
  if (!refs.length && !closedCount) return empty ? <span className={cx('quill-refs-empty', className)}>{empty}</span> : null;
  return (
    <span className={cx('quill-refs', className)}>
      {refs.map((r) => (
        <Ref key={`${r.kind}:${r.id}`} value={r} onOpen={onOpen} onRemove={onRemove} />
      ))}
      {closedCount ? (
        <span className="quill-refs-closed" tabIndex={closedReason ? 0 : undefined}>
          <Icon name="lock" size={12} />
          {closedCount} you can’t open
          {closedReason ? (
            <span className="augur-reason" role="tooltip">
              {closedReason}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
