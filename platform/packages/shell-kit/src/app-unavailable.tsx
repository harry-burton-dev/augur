import type { ReactNode } from 'react';
import { Button, Heading, Icon, Progress, type IconName } from '@augur/kit-common';

export type AppState = 'loading' | 'failed' | 'needs-newer' | 'limited';

export interface AppUnavailableProps {
  app: { name: string; icon: IconName };
  state: AppState;
  /** Why, in a sentence: what failed, which AUGUR version it needs, or which floor or role it's for. */
  reason?: string;
  /** Who can change it ("Your deployment admin", a Person). */
  who?: ReactNode;
  /** Try loading it again (failed only). */
  onRetry?: () => void;
  /** The words for each state's title, when a deployment wants its own. */
  words?: Partial<Record<AppState, string>>;
}

const WORDS: Record<AppState, string> = {
  loading: 'Opening',
  failed: 'Couldn’t open',
  'needs-newer': 'Needs a newer AUGUR',
  limited: 'Not on this floor',
};

/**
 * One screen for an app that can't show yet, instead of hiding it: loading,
 * failed, needing a newer AUGUR, or kept to some floors or roles. It says
 * which, why, and who can change it (Nothing is obtuse).
 */
export function AppUnavailable({ app, state, reason, who, onRetry, words }: AppUnavailableProps) {
  const title = { ...WORDS, ...words }[state];
  return (
    <div className="aerie-unavailable" data-state={state} aria-busy={state === 'loading' || undefined}>
      <span className="aerie-unavailable-mark" aria-hidden="true">
        <Icon name={app.icon} size={32} />
      </span>
      <Heading eyebrow={title} heading={app.name} summary={reason} level={1} />
      {state === 'loading' ? <Progress label={`${title} ${app.name}`} /> : null}
      {who ? <div className="aerie-unavailable-who">{who}</div> : null}
      {state === 'failed' && onRetry ? (
        <Button kind="secondary" onPress={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
