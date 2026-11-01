import { ProgressBar } from 'react-aria-components';
import { cx } from './cx.js';
import { Icon } from './icon.js';

export interface ProgressProps {
  /** What is running ("Uploading 3 files"). */
  label: string;
  /** 0 to 100. Leave out while it can't be known: the bar then runs. */
  value?: number;
  /** What it says beside the label ("2 of 3", "About a minute left"). Defaults to the percentage. */
  valueText?: string;
  className?: string;
}

/** How far an upload, an extraction run or an upgrade has got. */
export function Progress({ label, value, valueText, className }: ProgressProps) {
  const known = value != null;
  return (
    <ProgressBar
      value={known ? value : undefined}
      isIndeterminate={!known}
      valueLabel={valueText}
      className={cx('augur-progress', className)}
    >
      {({ percentage, valueText: said }) => (
        <>
          <span className="augur-progress-head">
            <span>{label}</span>
            {known ? <span className="augur-progress-value">{said}</span> : null}
          </span>
          <span className="augur-bar">
            <i style={known ? { width: `${percentage}%` } : undefined} />
          </span>
        </>
      )}
    </ProgressBar>
  );
}

export interface Step {
  label: string;
  state: 'done' | 'now' | 'next';
}

/** A few named steps, in order, with where things are now. */
export function Steps({ label, steps, className }: { label: string; steps: Step[]; className?: string }) {
  return (
    <ol className={cx('augur-steps', className)} aria-label={label}>
      {steps.map((s) => (
        <li key={s.label} className="augur-step" data-state={s.state} aria-current={s.state === 'now' ? 'step' : undefined}>
          <span className="augur-step-mark" aria-hidden="true">
            {s.state === 'done' ? <Icon name="check" size={14} /> : null}
          </span>
          {s.label}
          {s.state === 'done' ? <span className="sr-only"> (done)</span> : null}
        </li>
      ))}
    </ol>
  );
}
