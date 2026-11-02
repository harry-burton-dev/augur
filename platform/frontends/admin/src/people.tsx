import { Button, Checkbox, CheckboxGroup, Dialog, Select, Status, Table, TextField, Toggle, type TableColumn, type TableRow } from '@augur/app-kit';
import { useCallback, useEffect, useState } from 'react';
import { departmentPath, fullName, type AdminApi, type Department, type Person, type Role } from './api.js';
import { Page, PasswordNote, Problem, statusOf } from './parts.js';

const NO_DEPARTMENT = '';

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
 * roles, turn their sign-in off or on, and give them a new one-time password.
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
  const [resetError, setResetError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, d, r] = await Promise.all([api.people(), api.departments(), api.roles()]);
      setPeople(p);
      setDepartments(d);
      setRoles(r);
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
    setResetError('');
    setChosenRoles(people.find((p) => p.id === id)?.roles ?? []);
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

  const resetPassword = async (p: Person) => {
    setResetError('');
    try {
      const { temporaryPassword } = await api.resetPassword(p.id);
      replace({ ...p, invited: true });
      setEditing(undefined);
      setPassword({ name: fullName(p), value: temporaryPassword, reset: true });
    } catch (err) {
      setResetError((err as Error).message);
    }
  };

  const rows: TableRow[] = people
    .map((p) => ({
      id: p.id,
      name: fullName(p),
      email: p.email ?? '',
      department: p.departments.map((d) => departmentPath(d, departments)).join(', '),
      roles: p.roles.join(', '),
      signIn: statusOf(p).label,
      signInStatus: statusOf(p).status,
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
          <Toggle
            label="Can sign in"
            hint={person.id === me ? undefined : 'Turned off, they can’t sign in; nothing of theirs is removed.'}
            checked={person.enabled}
            disabled={person.id === me}
            reason="You can’t turn off your own sign-in."
            onChange={async (enabled) => replace(await api.updatePerson(person.id, { enabled }))}
          />
          <div>
            <Button kind="tertiary" size="sm" onPress={() => void resetPassword(person)}>
              Give them a new one-time password
            </Button>
          </div>
          <Problem>{resetError}</Problem>
        </Dialog>
      ) : null}
      {password ? <PasswordNote {...password} onClose={() => setPassword(undefined)} /> : null}
    </Page>
  );
}
