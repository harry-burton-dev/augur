import type { ReactNode } from 'react';
import { Heading } from '@augur/kit-common';

export interface FrontSection {
  id: string;
  /** "Needs you", "New since you looked", "Worth knowing". */
  title: string;
  /** How many there are, shown after the title. */
  count?: number;
  /** What it says when there's nothing here, so an empty section still tells you something. */
  empty: string;
  /** The things themselves: rows, cards. Leave out or pass nothing when there are none. */
  children?: ReactNode;
}

export interface FrontPageProps {
  /** Where you are ("Plans, your team's floor"). */
  eyebrow?: string;
  /** The app's name. */
  heading: string;
  /** One fact about now ("Three need you."). */
  summary?: string;
  /** In this order: what needs you, what's new, what's worth knowing. */
  sections: FrontSection[];
}

const hasContent = (node: ReactNode) => node != null && node !== false && !(Array.isArray(node) && node.length === 0);

/**
 * The page the app's name in the rail opens: what needs you, what's new since
 * you looked, and what's worth knowing, each said in a line when it's empty.
 */
export function FrontPage({ eyebrow, heading, summary, sections }: FrontPageProps) {
  return (
    <div className="quill-front">
      <Heading eyebrow={eyebrow} heading={heading} summary={summary} size="l" level={1} />
      {sections.map((s) => (
        <section key={s.id} className="quill-front-section" aria-labelledby={`front-${s.id}`}>
          <h2 id={`front-${s.id}`} className="quill-section-title">
            {s.title}
            {s.count != null ? <span className="quill-section-count">{s.count}</span> : null}
          </h2>
          {hasContent(s.children) ? s.children : <p className="quill-empty">{s.empty}</p>}
        </section>
      ))}
    </div>
  );
}
