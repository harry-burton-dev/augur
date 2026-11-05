import { AskTwice, Button, Checkbox, CheckboxGroup, DateField, Details, Dialog, Select, Status, Table, TextField, type TableColumn, type TableRow } from '@augur/app-kit';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, departmentPath, fullName, type AdminApi, type Department, type LeaveRequest, type LifecycleInfo, type Person, type Role } from './api.js';
import { day, lastSignIn, lifecycleFacts, Page, PasswordNote, Problem, statusOf } from './parts.js';

const NO_DEPARTMENT = '';
/** The leaver flow's choice when nobody takes on their work: apps keep it until someone does. */
const NO_ONE = '';

const emailCheck = (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : { state: 'error' as const, message: 'That email is missing something, like @example.org' });

const columns: TableColumn[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'department', label: 'Department', sortable: true },
  { key: 'roles', label: 'Roles' },
  { key: 'signIn', label: 'Sign-in', sortable: true, format: (v, row) => <Status status={row.signInStatus as ReturnType<typeof statusOf>['status']} label={String(v)} />, text: (v) => String(v) },
  { key: 'lastSignIn', label: 'Last sign-in', sortable: true, format: (_v, row) => String(row.lastSignInText) },
];

/**
 * Everyone who can sign in: add someone, change their name, department and
 * roles, turn their sign-in off or on, give them a new one-time password, and
 * run the leaver flow (ADR 0040) for someone who is leaving.
 *
 * A person's dialog keeps two kinds of control apart. Their details (name,
 * email, department, roles) are a form that changes nothing until Save.
 * Their sign-in (on or off, a new one-time password) acts at once, in its own
 * section that says so, each action with its own result line.
 */
export function People({ api, me, adding: addingAtFirst }: { api: AdminApi; me: string; adding?: boolean }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(Boolean(addingAtFirst));
  const [editing, setEditing] = useState<string>();
  const [password, setPassword] = useState<{ name: string; value: string; reset: boolean }>();
  const [chosenRoles, setChosenRoles] = useState<string[]>([]);
  const [liveResult, setLiveResult] = useState('');
  const [liveError, setLiveError] = useState('');
  const [leaving, setLeaving] = useState<LeaveRequest[]>([]);
  const [heir, setHeir] = useState(NO_ONE);
  const [leaverNote, setLeaverNote] = useState('');
  /** Their last day, when the leaver flow should wait for it; empty runs it now. */
  const [lastDay, setLastDay] = useState('');
  /** Whether invites can be emailed here, and today where the organisation is; until known, the one-time password is offered. */
  const [info, setInfo] = useState<LifecycleInfo>({ email: false });
  const canEmail = info.email;
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, d, r] = await Promise.all([api.people(), api.departments(), api.roles()]);
      setPeople(p);
      setDepartments(d);
      setRoles(r);
      // Who asked to leave is a hint for the leaver flow: People still works if it can't be read.
      setLeaving(await api.leaveRequests().catch(() => []));
      setInfo(await api.lifecycle().catch(() => ({ email: false })));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  const replace = (person: Person) => setPeople((all) => all.map((p) => (p.id === person.id ? person : p)));
  const person = people.find((p) => p.id === editing);

  const open = (id?: string) => {
    setLiveResult('');
    setLiveError('');
    setChosenRoles(people.find((p) => p.id === id)?.roles ?? []);
    setHeir(NO_ONE);
    setLeaverNote('');
    setLastDay('');
    if (id) {
      setEditing(id);
      // Whether they're locked out now, as the sign-in service has it; the list's word is a guess from Activity.
      api
        .person(id)
        .then(replace)
        .catch(() => undefined);
    } else setAdding(true);
  };

  const departmentOptions = [
    { value: NO_DEPARTMENT, label: 'No department' },
    ...departments
      .map((d) => ({ value: d.id, label: departmentPath(d.id, departments), detail: `${d.members.length} ${d.members.length === 1 ? 'person' : 'people'}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const fields = (p?: Person) => (
    <>
      {p ? (
        <div className="admin-part-head">
          <h3 className="admin-part-label">Their details</h3>
          <p className="admin-muted">Nothing here changes until you press Save.</p>
        </div>
      ) : null}
      <TextField name="firstName" label="First name" required defaultValue={p?.firstName ?? ''} />
      <TextField name="lastName" label="Last name" required defaultValue={p?.lastName ?? ''} />
      <TextField name="email" type="email" label="Email" required defaultValue={p?.email ?? ''} validate={emailCheck} />
      {p ? null : <TextField name="username" label="Username" optional hint="What they sign in with. Leave it empty to use the part of their email before the @." />}
      {p ? null : (
        <Select
          name="start"
          label="How they start"
          options={[
            {
              value: 'email',
              label: 'Email them an invite',
              detail: canEmail ? 'A link that lasts 72 hours to choose a password' : 'Email isn’t set up on this deployment. Whoever runs the server adds it to .env.',
              disabled: !canEmail,
            },
            { value: 'temporary-password', label: 'Give them a one-time password', detail: 'Read it to them; they choose their own at first sign-in' },
          ]}
          defaultValue={canEmail ? 'email' : 'temporary-password'}
        />
      )}
      <Select name="department" label="Department" placeholder="No department" options={departmentOptions} defaultValue={p?.departments[0] ?? NO_DEPARTMENT} />
      <CheckboxGroup label="Roles" optional value={chosenRoles} onChange={setChosenRoles}>
        {roles.map((r) => (
          <Checkbox key={r.name} value={r.name} detail={r.description}>
            {r.name}
          </Checkbox>
        ))}
      </CheckboxGroup>
    </>
  );

  const addPerson = async (values: Record<string, string>) => {
    setNotice('');
    const start = values.start === 'email' || values.start === 'temporary-password' ? values.start : canEmail ? 'email' : 'temporary-password';
    const { person: added, invite, temporaryPassword } = await api.addPerson({
      start,
      firstName: values.firstName ?? '',
      lastName: values.lastName ?? '',
      email: values.email ?? '',
      ...(values.username ? { username: values.username.trim().toLowerCase() } : {}),
      roles: chosenRoles,
      departments: values.department ? [values.department] : [],
    });
    setPeople((all) => [...all, added]);
    setDepartments((all) => all.map((d) => (added.departments.includes(d.id) ? { ...d, members: [...d.members, added.id] } : d)));
    if (temporaryPassword) setPassword({ name: fullName(added), value: temporaryPassword, reset: false });
    else if (invite?.error) setNotice(`${fullName(added)} was added, but the invite email couldn’t be sent: ${invite.error} Send it again from their details, or give them a one-time password.`);
    else if (invite?.method === 'email') setNotice(`Invite sent to ${invite.sentTo ?? added.email ?? fullName(added)}. The link works until ${invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : 'it runs out'}.`);
  };

  /** A new invite email, at once; the old link stops working. */
  const resendInvite = async (p: Person) => {
    setLiveResult('');
    setLiveError('');
    const { invite } = await api.resendInvite(p.id);
    replace({ ...p, invite: { method: 'email', sentAt: new Date().toISOString(), ...(invite.expiresAt ? { expiresAt: invite.expiresAt } : {}), expired: false, count: (p.invite?.count ?? 0) + 1 } });
    setLiveResult(`New invite sent to ${invite.sentTo ?? p.email ?? fullName(p)}. The old link no longer works.`);
  };

  const saveEdit = async (values: Record<string, string>) => {
    const p = person!;
    // The select manages the first department; any others are left as they are.
    const [, ...others] = p.departments;
    const departmentsNow = values.department ? [values.department, ...others.filter((d) => d !== values.department)] : others;
    const updated = await api.updatePerson(p.id, { firstName: values.firstName, lastName: values.lastName, email: values.email, roles: chosenRoles, departments: departmentsNow });
    replace(updated);
    // Membership counts changed somewhere; read them again rather than guess.
    setDepartments(await api.departments().catch(() => departments));
  };

  /** Turns someone's sign-in on or off straight away, and says what happened. A failure shows where it was asked: in the confirmation, or under the toggle. */
  const setSignIn = async (p: Person, enabled: boolean) => {
    setLiveResult('');
    setLiveError('');
    replace(await api.updatePerson(p.id, { enabled }));
    setLiveResult(enabled ? 'Sign-in turned on: they can sign in again.' : 'Sign-in turned off: they’re signed out everywhere and can’t sign in until it’s turned on again.');
  };

  /** Gives someone a new one-time password straight away, and shows it once. */
  const resetPassword = async (p: Person) => {
    setLiveResult('');
    setLiveError('');
    const { temporaryPassword } = await api.resetPassword(p.id);
    replace({ ...p, invited: true });
    setPassword({ name: fullName(p), value: temporaryPassword, reset: true });
    setLiveResult('New one-time password given: their old password no longer works.');
  };

  /** Lifts a lockout at once, so they can sign in again. */
  const unlock = async (p: Person) => {
    setLiveResult('');
    setLiveError('');
    await api.unlock(p.id);
    replace({ ...p, locked: false, ...(p.lockout ? { lockout: { ...p.lockout, locked: false } } : {}) });
    setLiveResult('Unlocked: they can sign in again now.');
  };

  /** Deletes a leaver's account now (ADR 0072); when the password is needed again, goes to enter it and comes back here. */
  const deleteNow = async (p: Person) => {
    setLiveResult('');
    setLiveError('');
    try {
      await api.deletePerson(p.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        window.location.assign(`/auth/again?return=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
        return;
      }
      throw err;
    }
    setPeople((all) => all.filter((x) => x.id !== p.id));
    setEditing(undefined);
  };

  /** Cancels a leaver flow set for after their last day; nothing had happened to them yet. */
  const cancelLeaving = async (p: Person) => {
    setLiveResult('');
    setLiveError('');
    replace(await api.cancelLeave(p.id));
    setLiveResult('They’re no longer leaving. Nothing had changed for them yet.');
  };

  /** The leaver flow, at once or after their last day: off, signed out everywhere, and apps told who takes on what they own. */
  const runLeaver = async (p: Person) => {
    setLiveResult('');
    setLiveError('');
    const to = people.find((x) => x.id === heir);
    const updated = await api.leave(p.id, { ...(to ? { handOverTo: to.id } : {}), ...(leaverNote.trim() ? { note: leaverNote.trim() } : {}), ...(lastDay ? { lastDay } : {}) });
    replace(updated);
    if (lastDay) {
      setLiveResult(`They leave after ${day(`${lastDay}T12:00:00`)}: until then nothing changes for them. You can cancel it here.`);
      return;
    }
    setLeaving((all) => all.filter((r) => r.person !== p.id));
    setLiveResult(
      to
        ? `They’ve left: signed out everywhere, and apps are handing what they own to ${fullName(to)}.`
        : 'They’ve left: signed out everywhere. Apps keep what they own until someone takes it on.',
    );
  };

  const askedToLeave = (id: string) => leaving.find((r) => r.person === id);
  const heirOptions = (p: Person) => [
    { value: NO_ONE, label: 'No one yet', detail: 'Apps keep what they own until someone takes it on' },
    ...people
      .filter((x) => x.id !== p.id && x.enabled)
      .map((x) => ({ value: x.id, label: fullName(x), ...(x.email ? { detail: x.email } : {}) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const rows: TableRow[] = people
    .map((p) => ({
      id: p.id,
      name: fullName(p),
      email: p.email ?? '',
      department: p.departments.map((d) => departmentPath(d, departments)).join(', '),
      roles: p.roles.join(', '),
      signIn: p.enabled && askedToLeave(p.id) ? 'Asked to leave' : statusOf(p).label,
      signInStatus: p.enabled && askedToLeave(p.id) ? 'needs' : statusOf(p).status,
      // Sorted by the time itself; shown as a date, or why there's none.
      lastSignIn: p.lastSignInAt ?? '',
      lastSignInText: lastSignIn(p),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const unready = loading || Boolean(error);

  return (
    <Page heading="People" summary="Everyone who can sign in, their department and roles.">
      <Table
        noun="people"
        filterable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        empty="No one here yet."
        onOpen={(row) => open(row.id)}
        onRetry={() => void load()}
        actions={
          <Button kind="secondary" size="sm" disabled={unready} reason={error ? 'People couldn’t be loaded. Try again first.' : 'Wait for people to load.'} onPress={() => open()}>
            Add a person
          </Button>
        }
      />
      {notice ? (
        <p role="status" className="admin-muted" data-notice>
          {notice}
        </p>
      ) : null}
      {adding && !unready ? (
        <Dialog
        open
        size="glance"
        eyebrow="People"
        heading="Add a person"
        summary="They get an invite email, or a one-time password you give them. Either way they choose their own password."
        actionLabel="Add"
        busyLabel="Adding…"
        onSubmit={addPerson}
        onClose={() => setAdding(false)}
        fields={fields()}
        />
      ) : null}
      {person ? (
        <Dialog
          open
          size="glance"
          eyebrow={person.username}
          heading={fullName(person)}
          summary={
            person.state === 'left'
              ? `Left on ${new Date(person.left!.at).toLocaleDateString()}.`
              : person.invited && !person.lastSignInAt
                ? 'Hasn’t chosen their own password yet.'
                : person.lastSignInAt
                  ? `Last signed in on ${new Date(person.lastSignInAt).toLocaleDateString()}.`
                  : ''
          }
          actionLabel="Save"
          busyLabel="Saving…"
          onSubmit={saveEdit}
          onClose={() => setEditing(undefined)}
          fields={fields(person)}
        >
          <section className="admin-facts" aria-labelledby="admin-facts-label" data-facts>
            <div className="admin-part-head">
              <h3 id="admin-facts-label" className="admin-part-label">
                Their account
              </h3>
            </div>
            <Details items={lifecycleFacts(person, (id) => fullName(people.find((x) => x.id === id) ?? { firstName: 'Someone', lastName: 'else', username: '' }))} limit={0} />
          </section>
          <section className="admin-live" aria-labelledby="admin-live-label" data-live>
            <div className="admin-part-head">
              <h3 id="admin-live-label" className="admin-part-label">
                Takes effect at once
              </h3>
              <p className="admin-muted">These change their sign-in now, without Save.</p>
            </div>
            <p className="admin-muted" data-sign-in>
              {person.enabled ? 'They can sign in.' : 'Their sign-in is off: they can’t sign in. Nothing of theirs is removed.'}
            </p>
            <div className="admin-live-actions">
              {person.enabled ? (
                <AskTwice
                  size="sm"
                  confirm="Press again: they can’t sign in from now"
                  busyLabel="Turning off…"
                  disabled={person.id === me}
                  reason="You can’t turn off your own sign-in."
                  onPress={() => setSignIn(person, false).catch((err: Error) => setLiveError(err.message))}
                >
                  Turn off their sign-in
                </AskTwice>
              ) : (
                <Button
                  kind="secondary"
                  size="sm"
                  busyLabel="Turning on…"
                  disabled={person.state === 'left'}
                  reason="They’ve left, and a leaver doesn’t come back. Add them again if they return."
                  onPress={() => setSignIn(person, true).catch((err: Error) => setLiveError(err.message))}
                >
                  Turn their sign-in on
                </Button>
              )}
              {person.state === 'invited' ? (
                <Button
                  kind="secondary"
                  size="sm"
                  busyLabel="Sending…"
                  disabled={!canEmail}
                  reason="Email isn’t set up on this deployment. Whoever runs the server adds it to .env."
                  onPress={() => resendInvite(person).catch((err: Error) => setLiveError(err.message))}
                >
                  Send a new invite
                </Button>
              ) : null}
              <Button
                kind="secondary"
                size="sm"
                busyLabel="Unlocking…"
                disabled={!(person.lockout?.locked ?? person.locked)}
                reason="They aren’t locked out."
                onPress={() => unlock(person).catch((err: Error) => setLiveError(err.message))}
              >
                Unlock
              </Button>
              <AskTwice size="sm" confirm="Press again: their current password stops working" busyLabel="Making one…" onPress={() => resetPassword(person).catch((err: Error) => setLiveError(err.message))}>
                Give them a new one-time password
              </AskTwice>
            </div>
            <div className="admin-part-head" data-leaver>
              <h3 className="admin-part-label">Leaving</h3>
              <p className="admin-muted">
                {person.state === 'left'
                  ? `They left on ${new Date(person.left!.at).toLocaleDateString()}${person.left!.handOverTo ? `, handing their work to ${fullName(people.find((x) => x.id === person.left!.handOverTo) ?? { firstName: 'someone', lastName: 'else', username: '' })}` : ''}.`
                  : person.leaving
                  ? `They leave after ${day(`${person.leaving.on}T12:00:00`)}. Until then nothing changes for them; change the day or cancel it here.`
                  : askedToLeave(person.id)
                  ? `They asked to leave on ${new Date(askedToLeave(person.id)!.requestedAt).toLocaleDateString()}${askedToLeave(person.id)!.note ? `: “${askedToLeave(person.id)!.note}”` : '.'}`
                  : 'For someone leaving the organisation. Their sign-in goes off, they’re signed out everywhere, and apps hand on what they own. Their teams and history stay.'}
              </p>
            </div>
            <Select label="Hand their work to" optional options={heirOptions(person)} value={heir} onChange={setHeir} />
            <TextField label="Note for Activity" optional multiline rows={2} maxLength={500} value={leaverNote} onChange={setLeaverNote} hint="Why, or what was agreed. Shown in Activity." />
            <DateField
              label="Last day"
              optional
              value={lastDay}
              onChange={setLastDay}
              empty="Leave now"
              disabled={!info.today}
              hint={
                info.today
                  ? `Leave it empty to run the leaver flow now. With a day, it runs once that day is over, up to ${info.lastDayAhead ?? 90} days ahead.`
                  : 'A last day can’t be set while identity can’t read the organisation’s time zone. Run it now, or try again later.'
              }
              state={lastDay && info.today && lastDay < info.today ? 'error' : undefined}
              message={lastDay && info.today && lastDay < info.today ? 'That day is past. Leave it empty to run it now.' : undefined}
            />
            <div className="admin-live-actions">
              <AskTwice
                size="sm"
                confirm={lastDay ? `Press again: they leave after ${day(`${lastDay}T12:00:00`)}` : 'Press again: they leave now'}
                busyLabel="Leaving…"
                disabled={person.id === me || person.state === 'left'}
                reason={person.state === 'left' ? 'They’ve already left.' : 'You can’t run the leaver flow on yourself. Ask another admin.'}
                onPress={() => runLeaver(person).catch((err: Error) => setLiveError(err.message))}
              >
                {lastDay ? (person.leaving ? 'Move their last day' : 'Set their last day') : 'They’re leaving'}
              </AskTwice>
              {person.leaving ? (
                <Button kind="secondary" size="sm" busyLabel="Cancelling…" onPress={() => cancelLeaving(person).catch((err: Error) => setLiveError(err.message))}>
                  Cancel leaving
                </Button>
              ) : null}
              {person.state === 'left' ? (
                <AskTwice
                  size="sm"
                  confirm="Press again: their account is deleted for good"
                  busyLabel="Deleting…"
                  disabled={Boolean(person.deleting)}
                  reason="Deleting their account has started; it carries on by itself."
                  onPress={() => deleteNow(person).catch((err: Error) => setLiveError(err.message))}
                >
                  Delete their account now
                </AskTwice>
              ) : null}
            </div>
            {liveResult ? (
              <p role="status" className="admin-muted" data-live-result>
                {liveResult}
              </p>
            ) : null}
            <Problem>{liveError}</Problem>
          </section>
        </Dialog>
      ) : null}
      {password ? <PasswordNote {...password} onClose={() => setPassword(undefined)} /> : null}
    </Page>
  );
}
