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
export const statusOf = (p: Pick<Person, 'enabled' | 'invited' | 'state'>): { status: StatusName; label: string } =>
  p.state === 'left'
    ? { status: 'paused', label: 'Left' }
    : !p.enabled
      ? { status: 'paused', label: 'Off' }
      : (p.state ?? (p.invited ? 'invited' : 'active')) === 'invited'
        ? { status: 'queued', label: 'Invited' }
        : { status: 'done', label: 'Active' };

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
