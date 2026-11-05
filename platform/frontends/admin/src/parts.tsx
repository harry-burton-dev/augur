import { Button, Dialog, PageHead, type PageAction, type StatusName } from '@augur/app-kit';
import type { ReactNode } from 'react';
import type { Person } from './api.js';

/** One admin screen: its heading and actions, then what's on it. */
export const Page = ({ heading, summary, actions, onAction, children }: { heading: string; summary: string; actions?: PageAction[]; onAction?: (a: PageAction) => void; children: ReactNode }) => (
  <div className="admin-page">
    <PageHead eyebrow="Admin" heading={heading} summary={summary} actions={actions} onAction={onAction} />
    {children}
  </div>
);

/** Where someone's sign-in stands, as a status mark and its word. */
export const statusOf = (p: Pick<Person, 'enabled' | 'invited' | 'state' | 'invite' | 'locked' | 'leaving' | 'idle'>): { status: StatusName; label: string } =>
  p.state === 'left'
    ? { status: 'paused', label: 'Left' }
    : p.leaving
      ? { status: 'queued', label: `Leaving ${day(`${p.leaving.on}T12:00:00`)}` }
      : !p.enabled
        ? { status: 'paused', label: 'Off' }
        : (p.state ?? (p.invited ? 'invited' : 'active')) === 'invited'
          ? p.invite?.expired
            ? { status: 'warning', label: 'Invite expired' }
            : { status: 'queued', label: 'Invited' }
          : p.locked
            ? { status: 'warning', label: 'Locked' }
            : p.idle && 'warned' in p.idle && p.idle.warned
              ? { status: 'warning', label: 'Idle' }
              : { status: 'done', label: 'Active' };

/** Why an idle sign-in won't turn off, in Admin's words. */
const IDLE_EXEMPT: Record<'off' | 'no-email' | 'deployment-admin' | 'not-tracked', string> = {
  off: 'Never: idle accounts are off (Organisation)',
  'no-email': 'Never: email isn’t set up, so nobody could be warned',
  'deployment-admin': 'Never: deployment admins are left out',
  'not-tracked': 'Counted from their next sign-in',
};

/** What is known about someone's account, as label and value, for their dialog. */
export const lifecycleFacts = (p: Person, nameOf: (id: string) => string): { label: string; value: string }[] => {
  const facts: { label: string; value: string }[] = [{ label: 'State', value: statusOf(p).label }, { label: 'Last sign-in', value: lastSignIn(p) }];
  if (p.createdAt) facts.push({ label: 'Added', value: day(p.createdAt) });
  if (p.state === 'invited' && p.invite?.expiresAt) facts.push({ label: p.invite.expired ? 'Invite ran out' : 'Invite works until', value: day(p.invite.expiresAt) });
  if (p.lockout?.locked || p.locked) facts.push({ label: 'Locked out', value: p.lockout ? `After ${p.lockout.failures} wrong passwords in a row` : 'After repeated wrong passwords' });
  if (p.idle && 'warnsAt' in p.idle) {
    facts.push({ label: p.idle.warned ? 'Idle warning sent' : 'Idle warning', value: day(p.idle.warnsAt) });
    facts.push({ label: 'Turns off if idle', value: day(p.idle.turnsOffAt) });
  } else if (p.idle) facts.push({ label: 'Turns off if idle', value: IDLE_EXEMPT[p.idle.exempt] });
  if (p.leaving) facts.push({ label: 'Last day', value: `${day(`${p.leaving.on}T12:00:00`)}${p.leaving.handOverTo ? `, handing over to ${nameOf(p.leaving.handOverTo)}` : ''}` });
  if (p.left) facts.push({ label: 'Left', value: `${day(p.left.at)}${p.left.handOverTo ? `, handing over to ${nameOf(p.left.handOverTo)}` : ''}` });
  return facts;
};

/** When someone last signed in, as a date, or why there's none. */
export const lastSignIn = (p: Pick<Person, 'lastSignInAt' | 'state'>) => (p.lastSignInAt ? new Date(p.lastSignInAt).toLocaleDateString() : p.state === 'invited' ? 'Never' : 'Not seen yet');

/** A secret shown once, large, to copy. */
export const Secret = ({ value, kind }: { value: string; kind: 'password' | 'secret' }) => (
  <>
    <p className="admin-secret" data-kind={kind} {...{ [`data-${kind}`]: '' }}>
      {value}
    </p>
    <div>
      <Button kind="secondary" size="sm" onPress={() => void navigator.clipboard?.writeText(value).catch(() => undefined)}>
        Copy it
      </Button>
    </div>
  </>
);

/** Shown once, straight after the password is made: it isn't kept anywhere the admin can see it again. */
export const PasswordNote = ({ name, value, reset, onClose }: { name: string; value: string; reset: boolean; onClose: () => void }) => (
  <Dialog open size="glance" eyebrow={reset ? 'New password' : 'Added'} heading={`Give ${name} this password`} summary="It works once. They choose their own when they sign in with it." cancelLabel="Done" onClose={onClose}>
    <Secret value={value} kind="password" />
    <p>It won’t be shown again. If it’s lost, give them a new one from their details.</p>
  </Dialog>
);

/** A line that says something went wrong, read out when it appears. */
export const Problem = ({ children }: { children?: ReactNode }) =>
  children ? (
    <p role="alert" className="admin-problem">
      {children}
    </p>
  ) : null;

/** One line of a list: what, and on the right something about it. */
export const Line = ({ children, end, ...data }: { children: ReactNode; end?: ReactNode } & Record<`data-${string}`, string>) => (
  <div className="admin-line" {...data}>
    <span>{children}</span>
    {end ? <span className="admin-line-end">{end}</span> : null}
  </div>
);

/** A quiet aside after something. */
export const Quiet = ({ children }: { children: ReactNode }) => <span className="admin-quiet">{children}</span>;

/** A short date: "2 Nov 2026". */
export const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
