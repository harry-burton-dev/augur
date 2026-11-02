import type { ReactNode } from 'react';
import { Status, type StatusName } from '@augur/app-kit';
import { STATE_LOOK, type UnitState } from './model/states.js';
import { formatWhen } from './model/time.js';

/** The kit's status mark for each unit state: a word and a shape, never colour alone. */
const MARK: Record<UnitState, StatusName> = {
  running: 'running',
  watching: 'running',
  halted: 'failed',
  held: 'paused',
  'waiting-you': 'needs',
  'waiting-window': 'queued',
  'update-available': 'warning',
  'up-to-date': 'done',
};

export const StateMark = ({ state }: { state: UnitState }) => <Status status={MARK[state]} label={STATE_LOOK[state].words} />;

/** A version, in tabular figures, that can be selected and copied whole. */
export const Version = ({ v, name }: { v: string; name?: string }) => (
  <span className="tabular-nums select-all" data-version={v}>
    {v}
    {name ? ` ${name}` : ''}
  </span>
);

export const When = ({ at, zone, now }: { at?: string | Date; zone: string; now: Date }) =>
  at ? <time dateTime={new Date(at).toISOString()}>{formatWhen(at, zone, now)}</time> : <span className="text-ink-muted">Not yet</span>;

export const Section = ({ title, children, id }: { title: string; children: ReactNode; id?: string }) => (
  <section aria-labelledby={id} className="flex flex-col gap-3">
    <h2 id={id} className="text-heading text-ink m-0">
      {title}
    </h2>
    {children}
  </section>
);

/** Label-and-value lines, as the kit's facts draw them. */
export const Facts = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 m-0">
    {rows.map(([label, value]) => (
      <div key={label} className="contents">
        <dt className="text-ink-muted text-small">{label}</dt>
        <dd className="m-0 text-ink">{value}</dd>
      </div>
    ))}
  </dl>
);

export const Muted = ({ children }: { children: ReactNode }) => <p className="m-0 text-ink-muted">{children}</p>;
