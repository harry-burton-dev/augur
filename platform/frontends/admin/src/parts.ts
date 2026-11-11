import type { Person } from './api.js';

/** A status mark's name, as Quill's `quill-status` and a list row's `status` take it. */
export type StatusName = 'needs' | 'running' | 'queued' | 'paused' | 'done' | 'failed' | 'warning';

/** One choice of a `quill-select`. */
export type SelectOption = { value: string; label: string; detail?: string; disabled?: boolean };

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
  if (p.source) facts.push({ label: 'Signs in with', value: p.source === 'federated' ? 'The organisation’s sign-in' : 'A password here' });
  if (p.createdAt) facts.push({ label: 'Added', value: day(p.createdAt) });
  if (p.state === 'invited' && p.invite?.expiresAt) facts.push({ label: p.invite.expired ? 'Invite ran out' : 'Invite works until', value: day(p.invite.expiresAt) });
  if (p.lockout?.locked || p.locked) facts.push({ label: 'Locked out', value: p.lockout ? `After ${p.lockout.failures} wrong passwords in a row` : 'After repeated wrong passwords' });
  if (p.idle && 'warnsAt' in p.idle) {
    facts.push({ label: p.idle.warned ? 'Idle warning sent' : 'Idle warning', value: day(p.idle.warnsAt) });
    facts.push({ label: 'Turns off if idle', value: day(p.idle.turnsOffAt) });
  } else if (p.idle) facts.push({ label: 'Turns off if idle', value: IDLE_EXEMPT[p.idle.exempt] });
  if (p.leaving) facts.push({ label: 'Last day', value: `${day(`${p.leaving.on}T12:00:00`)}${p.leaving.handOverTo ? `, handing over to ${nameOf(p.leaving.handOverTo)}` : ''}` });
  if (p.left) facts.push({ label: 'Left', value: `${day(p.left.at)}${p.left.handOverTo ? `, handing over to ${nameOf(p.left.handOverTo)}` : ''}` });
  if (p.deleting) facts.push({ label: 'Account', value: 'Being deleted: it carries on within five minutes' });
  else if (p.left?.deleteAfter) facts.push({ label: 'Account deleted', value: day(p.left.deleteAfter) });
  return facts;
};

/** When someone last signed in, as a date, or why there's none. */
export const lastSignIn = (p: Pick<Person, 'lastSignInAt' | 'state'>) => (p.lastSignInAt ? new Date(p.lastSignInAt).toLocaleDateString() : p.state === 'invited' ? 'Never' : 'Not seen yet');

/** A short date: "2 Nov 2026". */
export const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
