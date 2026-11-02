import { useEffect, useRef, useState } from 'react';
import { Input, TextField as AriaTextField } from 'react-aria-components';
import { FieldHead, FieldHint, Icon, cx, useFieldCheck, useReason, useValue, type FieldProps } from '@augur/kit-common';
import { List, type ListItem } from './list.js';
import { Refs } from './things.js';

/** A person or a team, as the picker shows and returns them. */
export interface Principal {
  kind: 'person' | 'team';
  id: string;
  name: string;
  /** For a person, their team or email; for a team, where it sits. */
  detail?: string;
  /** For a team, how many people are in it. */
  size?: number;
  /** A word at the end of the row, such as how far they're already let in ("Can read"). */
  meta?: string;
}

/** Finds people and teams by name. The app asks identity through the SDK. */
export type PrincipalSearch = (query: string) => Promise<Principal[]>;

export interface PeoplePickerProps extends Omit<FieldProps, 'state' | 'message' | 'required' | 'optional'> {
  search: PrincipalSearch;
  /** Why one can't be chosen, in one sentence; nothing when it can. */
  check?: (p: Principal) => string | undefined | void;
  /** `people`, `teams`, or `both` (the default). */
  kinds?: 'people' | 'teams' | 'both';
  /** Choices gather above the field as chips; without it, each choice is handed over and the field empties. */
  multiple?: boolean;
  /** The ones chosen so far, with `multiple`. Left out, the picker keeps its own. */
  value?: Principal[];
  defaultValue?: Principal[];
  onChange?: (value: Principal[]) => void;
  /** One was chosen. */
  onPick?: (principal: Principal) => void;
  placeholder?: string;
  /** How long typing rests before it looks, in ms. */
  pause?: number;
  /** A dialog collects the chosen ones as `kind:id`, joined with commas. */
  name?: string;
}

export const principalKey = (p: Pick<Principal, 'kind' | 'id'>) => `${p.kind}:${p.id}`;

/** The rows for what was found: each says its team or size, and the ones that can't be chosen say why. */
export const principalRows = (found: Principal[], chosen: Principal[], check?: PeoplePickerProps['check']): ListItem[] =>
  found.map((p) => {
    const reason = check?.(p) || (chosen.some((c) => principalKey(c) === principalKey(p)) ? 'Already chosen.' : '');
    const detail = [p.detail, p.kind === 'team' && p.size !== undefined ? `${p.size} ${p.size === 1 ? 'person' : 'people'}` : ''].filter(Boolean).join(' · ') || (p.kind === 'team' ? 'Team' : '');
    return {
      id: principalKey(p),
      title: p.name,
      icon: p.kind === 'person' ? 'person' : 'people',
      ...(detail ? { detail } : {}),
      ...(p.meta ? { meta: p.meta } : {}),
      ...(reason ? { disabled: true, reason } : {}),
    };
  });

/**
 * Find people and teams by name. Typing looks after a short pause (Enter looks
 * now, Esc clears). The ones that can't be chosen stay in the list, dimmed,
 * and say why. With `multiple`, choices gather as chips you can take off again.
 */
export function PeoplePicker({ label, hint, disabled, reason, className, search, check, kinds = 'both', multiple, value, defaultValue = [], onChange, onPick, placeholder = 'A name, an email or a team', pause = 200, name }: PeoplePickerProps) {
  const [chosen, setChosen] = useValue<Principal[]>(value, defaultValue, onChange);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Principal[] | undefined>();
  const [looking, setLooking] = useState(false);
  const [failure, setFailure] = useState('');
  const asked = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const { reasoned, describe, caption } = useReason(disabled, reason);
  useFieldCheck({ check: () => true, focus: () => input.current?.focus(), name, value: () => chosen.map(principalKey).join(',') });
  useEffect(() => () => clearTimeout(timer.current), []);

  const find = async (q: string) => {
    clearTimeout(timer.current);
    const mine = ++asked.current;
    if (!q.trim()) {
      setFound(undefined);
      setLooking(false);
      setFailure('');
      return;
    }
    setLooking(true);
    try {
      const all = await search(q.trim());
      if (mine !== asked.current) return;
      setFound(all.filter((p) => kinds === 'both' || (kinds === 'people' ? p.kind === 'person' : p.kind === 'team')));
      setFailure('');
    } catch (err) {
      if (mine === asked.current) setFailure((err as Error).message);
    } finally {
      if (mine === asked.current) setLooking(false);
    }
  };
  const typed = (q: string) => {
    setQuery(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void find(q), pause);
  };
  const choose = (p: Principal) => {
    onPick?.(p);
    if (multiple && !chosen.some((c) => principalKey(c) === principalKey(p))) setChosen([...chosen, p]);
    asked.current++;
    setQuery('');
    setFound(undefined);
  };
  const showing = Boolean(query.trim() && (found !== undefined || failure || looking));

  return (
    <div className={cx('augur-field quill-people-picker', className)} data-unavailable={disabled || undefined}>
      <AriaTextField value={query} onChange={typed} isDisabled={disabled && !reasoned} isReadOnly={reasoned} aria-label={label}>
        <FieldHead label={label} />
        <FieldHint hint={hint} />
        {multiple && chosen.length ? (
          <Refs
            className="quill-people-chosen"
            refs={chosen.map((p) => ({ kind: p.kind, id: p.id, label: p.name }))}
            onRemove={disabled ? undefined : (r) => setChosen(chosen.filter((p) => principalKey(p) !== `${r.kind}:${r.id}`))}
          />
        ) : null}
        <div className="augur-field-box quill-people-box">
          <Icon name="find" size={16} />
          <Input
            ref={input}
            className="augur-input"
            autoComplete="off"
            placeholder={placeholder}
            aria-expanded={showing}
            {...describe}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.stopPropagation();
                setQuery('');
                void find('');
              } else if (e.key === 'Enter') {
                e.preventDefault();
                void find(query);
              }
            }}
          />
        </div>
      </AriaTextField>
      {caption}
      {showing ? (
        <List
          className="quill-people-found"
          label="People and teams found"
          noun={['match', 'matches']}
          density="compact"
          items={principalRows(found ?? [], multiple ? chosen : [], check)}
          loading={looking && found === undefined}
          error={failure || undefined}
          empty="No one by that name. Try part of a name or an email."
          onOpen={(item) => {
            const p = found?.find((f) => principalKey(f) === item.id);
            if (p && !item.disabled) choose(p);
          }}
          onRetry={() => void find(query)}
        />
      ) : null}
    </div>
  );
}
