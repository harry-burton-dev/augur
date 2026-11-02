import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@augur/kit-common';
import { FocusField, FocusItem, type Ambience } from './focus.js';
import { useRingTarget, type RingSubject } from './radial-menu.js';

/** One thing on a reel. */
export interface ReelItem {
  id: string;
  /** What to do and to what ("Approve Procedures update"). */
  title: string;
  /** When, or how soon, in a word or two ("Today 15:00", "Thu"). */
  when?: string;
  /** Late or due today: the tag lights up. */
  urgent?: boolean;
  /** Who it's from, or where ("Department 1"): read out, shown small. */
  from?: string;
  /** A small picture of the thing: a page, a stamp, a signature. Decorative, so hidden from screen readers. */
  art?: ReactNode;
  onOpen: () => void;
  /** The radial menu on the card (Open, Done, Later...). */
  ring?: () => RingSubject | undefined;
}

/** A reel's place in what needs you: it sets the colour of its light and how loud it is. */
export type ReelTone = 'action' | 'new' | 'upcoming' | 'quiet';

/** How a reel's cards arrive. */
export type Reveal =
  /** Harry's: they wait behind the reel's light, and come in one at a time as you press it. The count says how many wait. */
  | 'pull'
  /** All of them are on the reel at once. */
  | 'all';

export interface ReelProps {
  /** The reel's name, as its section heading says it ("Actions"). */
  label: string;
  tone?: ReelTone;
  items: ReelItem[];
  reveal?: Reveal;
  /** What one of these is called, for the light's words ("action", "new document"). */
  noun?: string;
  ambience?: Ambience;
}

/**
 * A lane of cards on a front page: what needs you, what's new, what's coming.
 * The card in front is in focus; the rest sit ambient beside it (focus pull,
 * PDR-010) until you hover, focus or press one, which brings it forward.
 * Pressing the card in front opens it. The reel scrolls sideways natively, so
 * a wheel, a trackpad, a finger and the keyboard all work.
 *
 * With `reveal="pull"`, the cards wait behind a light at the reel's start,
 * with a count, and each press of the light brings the next one in.
 */
export function Reel({ label, tone = 'quiet', items, reveal = 'all', noun = 'item', ambience }: ReelProps) {
  const [shown, setShown] = useState(reveal === 'all' ? items.length : 0);
  const [front, setFront] = useState<string | undefined>();
  const [landing, setLanding] = useState<string | undefined>();
  const strip = useRef<HTMLDivElement>(null);
  const cards = reveal === 'all' ? items : items.slice(0, shown);
  const waiting = items.length - cards.length;
  const inFront = cards.find((c) => c.id === front)?.id ?? cards.at(-1)?.id;

  useEffect(() => {
    if (reveal === 'all') setShown(items.length);
  }, [reveal, items.length]);

  const pull = () => {
    const next = items[shown];
    if (!next) return;
    setShown(shown + 1);
    setFront(next.id);
    setLanding(next.id);
  };

  // A card that lands is scrolled into view.
  useEffect(() => {
    if (!landing) return;
    strip.current?.querySelector<HTMLElement>(`[data-reel-id="${CSS.escape(landing)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [landing]);

  return (
    <div className="quill-reel" data-tone={tone} data-reveal={reveal}>
      {reveal === 'pull' ? (
        <button
          type="button"
          className="quill-reel-light"
          data-live={waiting ? '' : undefined}
          aria-disabled={waiting ? undefined : true}
          aria-label={waiting ? `Bring in the next ${noun}. ${waiting} waiting.` : `Every ${noun} is in.`}
          onClick={pull}
        >
          <span className="quill-reel-count" aria-hidden="true">
            {waiting}
          </span>
          <span className="quill-reel-slit" aria-hidden="true" />
        </button>
      ) : null}
      <div ref={strip} className="quill-reel-strip" role="group" aria-label={label}>
        <FocusField pulled={cards.length > 1} ambience={ambience} className="quill-reel-field">
          {cards.map((item) => (
            <ReelCard key={item.id} item={item} front={item.id === inFront} landing={item.id === landing} onFront={() => setFront(item.id)} />
          ))}
        </FocusField>
        {cards.length === 0 && waiting ? <p className="quill-reel-waiting">{waiting === 1 ? `One ${noun} waiting behind the light.` : `${waiting} waiting behind the light.`}</p> : null}
      </div>
    </div>
  );
}

function ReelCard({ item, front, landing, onFront }: { item: ReelItem; front: boolean; landing: boolean; onFront: () => void }) {
  const ring = useRingTarget(() => item.ring?.());
  const keys = ring.onKeyDown;
  return (
    <FocusItem pulled={front} className="quill-reel-slot">
      <button
        type="button"
        className={cx('quill-reel-card', landing ? 'quill-reel-landing' : undefined)}
        data-reel-id={item.id}
        data-front={front ? '' : undefined}
        aria-label={`${item.title}${item.when ? `, ${item.when}` : ''}${item.from ? `, from ${item.from}` : ''}`}
        {...ring}
        onKeyDown={(e) => {
          keys(e);
          if (!e.defaultPrevented && e.key === 'Enter') {
            e.preventDefault();
            item.onOpen();
          }
        }}
        onFocus={onFront}
        onClick={() => (front ? item.onOpen() : onFront())}
      >
        {item.when ? (
          <span className="quill-reel-when" data-urgent={item.urgent ? '' : undefined}>
            {item.when}
          </span>
        ) : null}
        {item.art ? (
          <span className="quill-reel-art" aria-hidden="true">
            {item.art}
          </span>
        ) : null}
        <span className="quill-reel-title">{item.title}</span>
      </button>
    </FocusItem>
  );
}
