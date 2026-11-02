import { Button } from '@augur/kit-common';

export type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'expired';

export interface ConnectionProps {
  state: ConnectionState;
  /** Sign in again, for an expired session. What you were doing is kept. */
  onSignIn?: () => void;
  words?: Partial<Record<Exclude<ConnectionState, 'online'>, string>>;
}

const WORDS = {
  offline: 'You’re offline. What you do stays here and goes when you’re back.',
  reconnecting: 'Reconnecting…',
  expired: 'Your session ended. Sign in again to carry on; nothing you were doing is lost.',
};

/** Says, under the band, when AUGUR is offline, reconnecting, or your session has ended. Nothing shows while all is well. */
export function Connection({ state, onSignIn, words }: ConnectionProps) {
  if (state === 'online') return null;
  const said = { ...WORDS, ...words }[state];
  return (
    <div className="aerie-connection" data-state={state} role={state === 'expired' ? 'alert' : 'status'}>
      <span>{said}</span>
      {state === 'expired' && onSignIn ? (
        <Button kind="primary" size="sm" onPress={onSignIn}>
          Sign in
        </Button>
      ) : null}
    </div>
  );
}
