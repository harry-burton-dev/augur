import { AskTwice, Button, Checkbox, CheckboxGroup, Dialog, Select, Status, Table, TextField, type TableColumn, type TableRow } from '@augur/app-kit';
import { useCallback, useEffect, useState } from 'react';
import { departmentPath, fullName, type AdminApi, type Department, type LeaveRequest, type Person, type Role } from './api.js';
import { Page, PasswordNote, Problem, statusOf } from './parts.js';

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
    if (id) setEditing(id);
    else setAdding(true);
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
    const { person: added, temporaryPassword } = await api.addPerson({
      firstName: values.firstName ?? '',
      lastName: values.lastName ?? '',
      email: values.email ?? '',
      ...(values.username ? { username: values.username.trim().toLowerCase() } : {}),
      roles: chosenRoles,
      departments: values.department ? [values.department] : [],
    });
    setPeople((all) => [...all, added]);
    setDepartments((all) => all.map((d) => (added.departments.includes(d.id) ? { ...d, members: [...d.members, added.id] } : d)));
    setPassword({ name: fullName(added), value: temporaryPassword, reset: false });
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

  /** The leaver flow, at once: off, signed out everywhere, and apps told who takes on what they own. */
  const runLeaver = async (p: Person) => {
    setLiveResult('');
    setLiveError('');
    const to = people.find((x) => x.id === heir);
    replace(await api.leave(p.id, { ...(to ? { handOverTo: to.id } : {}), ...(leaverNote.trim() ? { note: leaverNote.trim() } : {}) }));
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
      {adding && !unready ? (
        <Dialog
        open
        size="glance"
        eyebrow="People"
        heading="Add a person"
        summary="They get a one-time password to sign in with, then choose their own."
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
          summary={person.invited ? 'Hasn’t chosen their own password yet.' : ''}
          actionLabel="Save"
          busyLabel="Saving…"
          onSubmit={saveEdit}
          onClose={() => setEditing(undefined)}
          fields={fields(person)}
        >
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
                <Button kind="secondary" size="sm" busyLabel="Turning on…" onPress={() => setSignIn(person, true).catch((err: Error) => setLiveError(err.message))}>
                  Turn their sign-in on
                </Button>
              )}
              <AskTwice size="sm" confirm="Press again: their current password stops working" busyLabel="Making one…" onPress={() => resetPassword(person).catch((err: Error) => setLiveError(err.message))}>
                Give them a new one-time password
              </AskTwice>
            </div>
            <div className="admin-part-head" data-leaver>
              <h3 className="admin-part-label">Leaving</h3>
              <p className="admin-muted">
                {askedToLeave(person.id)
                  ? `They asked to leave on ${new Date(askedToLeave(person.id)!.requestedAt).toLocaleDateString()}${askedToLeave(person.id)!.note ? `: “${askedToLeave(person.id)!.note}”` : '.'}`
                  : 'For someone leaving the organisation. Their sign-in goes off, they’re signed out everywhere, and apps hand on what they own. Their teams and history stay.'}
              </p>
            </div>
            <Select label="Hand their work to" optional options={heirOptions(person)} value={heir} onChange={setHeir} />
            <TextField label="Note for Activity" optional multiline rows={2} maxLength={500} value={leaverNote} onChange={setLeaverNote} hint="Why, or what was agreed. Shown in Activity." />
            <div className="admin-live-actions">
              <AskTwice
                size="sm"
                confirm="Press again: they leave now"
                busyLabel="Leaving…"
                disabled={person.id === me}
                reason="You can’t run the leaver flow on yourself. Ask another admin."
                onPress={() => runLeaver(person).catch((err: Error) => setLiveError(err.message))}
              >
                They’re leaving
              </AskTwice>
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
