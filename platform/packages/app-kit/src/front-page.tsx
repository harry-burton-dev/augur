import type { ReactNode } from 'react';
import { cx, Heading } from '@augur/kit-common';
import { Reel, type ReelItem, type ReelTone, type Reveal } from './reel.js';
import type { Ambience } from './focus.js';

/** One section of a front page, as an app declares it. The same shape for every app. */
export interface FrontSectionConfig {
  id: string;
  /** "Needs you", "New since you looked", "Worth knowing". */
  title: string;
  /** What it says when there's nothing here, so an empty section still tells you something. */
  empty: string;
  /** `list` (the default): the app's own rows or cards. `reel`: a lane of cards from `items`. */
  layout?: 'list' | 'reel';
  /** For a reel: how loud it is and the colour of its light. */
  tone?: ReelTone;
  /** For a reel: all its cards at once, or pulled in one at a time. */
  reveal?: Reveal;
  /** For a reel: what one card is called ("action"). */
  noun?: string;
}

export interface FrontSection extends FrontSectionConfig {
  /** How many there are, shown after the title. Worked out from `items` when there are some. */
  count?: number;
  /** The things themselves for a list section: rows, cards. Leave out or pass nothing when there are none. */
  children?: ReactNode;
  /** The cards for a reel section. */
  items?: ReelItem[];
}

/** How the page opens. */
export type FrontLook =
  /** A heading at the top left, like any other page (the default). */
  | 'plain'
  /** Harry's title card: the floor small above the app's name, wide and centred, and search under it. */
  | 'title';

/** What an app says about its front page: everything but the data. Keep it beside the app's manifest. */
export interface FrontPageConfig {
  look?: FrontLook;
  ambience?: Ambience;
  sections: FrontSectionConfig[];
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
  look?: FrontLook;
  /** Search, under the heading: the app's own find field. */
  search?: ReactNode;
  /** How ambient cards look on the reels. */
  ambience?: Ambience;
}

const hasContent = (node: ReactNode) => node != null && node !== false && !(Array.isArray(node) && node.length === 0);

/**
 * Puts an app's front page config together with what's there now: `data`
 * gives each section, by id, its items or rows. The same config gives the
 * same page in every app.
 */
export const frontSections = (config: FrontPageConfig, data: Record<string, Pick<FrontSection, 'items' | 'children' | 'count'> | undefined>): FrontSection[] =>
  config.sections.map((s) => ({ ...s, ...(data[s.id] ?? {}) }));

/**
 * The page the app's name in the rail opens: what needs you, what's new since
 * you looked, and what's worth knowing, each said in a line when it's empty.
 * A section is a list of the app's own rows, or a reel of cards.
 */
export function FrontPage({ eyebrow, heading, summary, sections, look = 'plain', search, ambience }: FrontPageProps) {
  return (
    <div className={cx('quill-front', look === 'title' ? 'quill-front-title' : undefined)} data-look={look}>
      {look === 'title' ? (
        <header className="quill-title-card">
          {eyebrow ? <p className="quill-title-eyebrow">{eyebrow}</p> : null}
          <h1 className="quill-title-name">{heading}</h1>
          {summary ? <p className="quill-title-summary">{summary}</p> : null}
        </header>
      ) : (
        <Heading eyebrow={eyebrow} heading={heading} summary={summary} size="l" level={1} />
      )}
      {search ? <div className="quill-front-search">{search}</div> : null}
      {sections.map((s) => {
        const count = s.count ?? s.items?.length;
        const reel = s.layout === 'reel';
        return (
          <section key={s.id} className="quill-front-section" data-tone={s.tone} aria-labelledby={`front-${s.id}`}>
            <h2 id={`front-${s.id}`} className="quill-section-title">
              {s.title}
              {count != null ? <span className="quill-section-count">{count}</span> : null}
            </h2>
            {reel && s.items?.length ? (
              <Reel label={s.title} tone={s.tone} items={s.items} reveal={s.reveal} noun={s.noun} ambience={ambience} />
            ) : hasContent(s.children) ? (
              s.children
            ) : (
              <p className="quill-empty">{s.empty}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
