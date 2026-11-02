import { cx } from './cx.js';

/** The floor a person is shown on: their colour comes from that floor's token. */
export type PersonTone = 'you' | 'team' | 'department' | 'org';

export interface PersonProps {
  name: string;
  /** One quiet line under the name: their role, or what they did ("Edited 3 days ago"). */
  detail?: string;
  /** A picture; initials show when it's missing or fails. */
  picture?: string;
  tone?: PersonTone;
  /** Only the round mark, with the name read aloud. */
  markOnly?: boolean;
  className?: string;
}

/** Up to two initials: first and last word. */
export const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const pick = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return pick.map((w) => [...w][0]!.toUpperCase()).join('');
};

function Mark({ name, picture, tone = 'team' }: Pick<PersonProps, 'name' | 'picture' | 'tone'>) {
  return (
    <span className="augur-avatar" data-tone={tone} aria-hidden="true">
      {picture ? <img src={picture} alt="" onError={(e) => (e.currentTarget.hidden = true)} /> : null}
      <span>{initials(name)}</span>
    </span>
  );
}

/** Someone: an owner, who did something, or who to ask. A round mark with their initials, then their name. */
export function Person({ name, detail, picture, tone, markOnly, className }: PersonProps) {
  if (markOnly)
    return (
      <span className={cx('augur-person', className)} role="img" aria-label={name} title={name}>
        <Mark name={name} picture={picture} tone={tone} />
      </span>
    );
  return (
    <span className={cx('augur-person', className)}>
      <Mark name={name} picture={picture} tone={tone} />
      <span className="augur-person-text">
        <span>{name}</span>
        {detail ? <small>{detail}</small> : null}
      </span>
    </span>
  );
}

export interface PeopleProps {
  people: Pick<PersonProps, 'name' | 'picture' | 'tone'>[];
  /** How many marks before "+N". */
  max?: number;
  /** Read aloud for the group ("Shared with"). The names follow. */
  label: string;
  className?: string;
}

/** Several people as overlapping marks, then "+N" for the rest. Every name is read aloud and shown on hover. */
export function People({ people, max = 4, label, className }: PeopleProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const names = people.map((p) => p.name).join(', ');
  return (
    <span className={cx('augur-people', className)} role="img" aria-label={`${label}: ${names}`} title={names}>
      {shown.map((p, i) => (
        <Mark key={`${p.name}-${i}`} {...p} />
      ))}
      {rest > 0 ? (
        <span className="augur-avatar augur-avatar-more" aria-hidden="true">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
