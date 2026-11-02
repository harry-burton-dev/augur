import type { ReactNode } from 'react';
import { Person, type PersonProps } from '@augur/kit-common';

export interface AboutProps {
  /** What it is, in a line ("A collection of 12 plans"). */
  what: string;
  owner?: Pick<PersonProps, 'name' | 'detail' | 'tone' | 'picture'>;
  /** The floor it's on, by its name. */
  floor?: string;
  /** Where it is in its life ("In review"), and the moves the person can make, if any. */
  lifecycle?: ReactNode;
  /** Links to other records; leave out or pass nothing when there are none. */
  links?: ReactNode;
  /** What happened to it, newest first. */
  history?: ReactNode;
  /** The words for each row and for nothing there, when an app or a deployment wants its own. */
  words?: Partial<typeof WORDS>;
}

const WORDS = {
  owner: 'Owner',
  floor: 'Floor',
  lifecycle: 'State',
  links: 'Links',
  history: 'History',
  noOwner: 'Nobody owns this yet.',
  noLinks: 'Nothing is linked to this yet.',
  noHistory: 'Nothing has happened to this yet.',
};

/**
 * The right panel about one thing, always in the same order: what it is, who
 * owns it, its floor, where it is in its life, its links and its history. A
 * row with nothing in it stays and says so, so people learn where to look.
 */
export function About({ what, owner, floor, lifecycle, links, history, words }: AboutProps) {
  const w = { ...WORDS, ...words };
  return (
    <div className="quill-about">
      <p className="quill-about-what">{what}</p>
      <dl className="quill-about-rows">
        <dt>{w.owner}</dt>
        <dd>{owner ? <Person {...owner} /> : <span className="quill-empty">{w.noOwner}</span>}</dd>
        {floor ? (
          <>
            <dt>{w.floor}</dt>
            <dd>{floor}</dd>
          </>
        ) : null}
        {lifecycle ? (
          <>
            <dt>{w.lifecycle}</dt>
            <dd>{lifecycle}</dd>
          </>
        ) : null}
        <dt>{w.links}</dt>
        <dd>{links ?? <span className="quill-empty">{w.noLinks}</span>}</dd>
        <dt>{w.history}</dt>
        <dd>{history ?? <span className="quill-empty">{w.noHistory}</span>}</dd>
      </dl>
    </div>
  );
}
