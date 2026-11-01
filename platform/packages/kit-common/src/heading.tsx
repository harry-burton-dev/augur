import { cx } from './cx.js';

export interface HeadingProps {
  /** Where you are, in small capitals above the title. */
  eyebrow?: string;
  /** What this is. */
  heading: string;
  /** A fact about now ("Three unread."), under the title. */
  summary?: string;
  size?: 's' | 'm' | 'l';
  /** The heading level, 1 to 6. */
  level?: number;
  /** For a dialog or panel that names itself by this heading. */
  id?: string;
  className?: string;
}

/** The top of anything: an eyebrow, a title and an optional summary. One heading per surface. */
export function Heading({ eyebrow, heading, summary, size = 'm', level = 2, id, className }: HeadingProps) {
  return (
    <div className={cx('augur-heading', className)} data-size={size}>
      {eyebrow ? <div className="augur-eyebrow">{eyebrow}</div> : null}
      <div className="augur-title" role="heading" aria-level={Math.min(6, Math.max(1, level))} id={id}>
        {heading}
      </div>
      {summary ? <p className="augur-summary">{summary}</p> : null}
    </div>
  );
}
