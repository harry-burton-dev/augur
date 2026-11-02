import { Button, Dialog, Select, Table, TextField, type PageAction, type TableColumn, type TableRow } from '@augur/app-kit';
import { useCallback, useEffect, useState } from 'react';
import { departmentPath, fullName, levelOf, type AdminApi, type Department, type Person, type TeamLevels } from './api.js';
import { Line, Page, Problem, Quiet } from './parts.js';

const TOP = '';

const columns: TableColumn[] = [
  { key: 'name', label: 'Department', sortable: true },
  { key: 'level', label: 'Level', sortable: true },
  { key: 'members', label: 'Members', kind: 'number', sortable: true, sortFirst: 'desc' },
  { key: 'within', label: 'Inside', sortable: true },
];

/** Whether a department's name would work there: no slash, and no other with the same name beside it. */
export const nameCheck = (departments: Department[], except?: string, parentId?: string) => (value: string) => {
  if (value.includes('/')) return { state: 'error' as const, message: 'A department’s name can’t have a / in it.' };
  const clash = departments.find((d) => d.id !== except && (d.parentId ?? TOP) === (parentId ?? TOP) && d.name.toLowerCase() === value.trim().toLowerCase());
  return clash ? { state: 'error' as const, message: `There is already a department called “${clash.name}” there.` } : null;
};

/**
 * Departments: add one (at the top or inside another), rename it, and choose
 * who is in it. A person's department reaches apps as the `departments` claim
 * when they next sign in. Each level has a name, Department at the top and
 * Team inside it unless renamed here, which people see on their floors.
 */
export function Departments({ api, adding: addingAtFirst }: { api: AdminApi; adding?: boolean }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [levels, setLevels] = useState<TeamLevels>({ levels: ['Department', 'Team'], max: 5 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(Boolean(addingAtFirst));
  const [naming, setNaming] = useState(false);
  const [open, setOpen] = useState<string>();
  const [working, setWorking] = useState(false);
  const [memberError, setMemberError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, p] = await Promise.all([api.departments(), api.people()]);
      setDepartments(d);
      setPeople(p);
      // the names are shown beside each department; without them the defaults stand
      const l = await api.levels().catch(() => undefined);
      if (l) setLevels(l);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  const membership = async (department: Department, person: string, add: boolean) => {
    setWorking(true);
    try {
      await (add ? api.addMember(department.id, person) : api.removeMember(department.id, person));
      setDepartments((all) => all.map((d) => (d.id === department.id ? { ...d, members: add ? [...d.members, person] : d.members.filter((m) => m !== person) } : d)));
      setPeople((all) => all.map((p) => (p.id === person ? { ...p, departments: add ? [...p.departments, department.id] : p.departments.filter((d) => d !== department.id) } : p)));
      setMemberError('');
    } catch (err) {
      setMemberError((err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const saveLevels = async (values: Record<string, string>) => {
    const names = Array.from({ length: levels.max }, (_, i) => (values[`level${i + 1}`] ?? '').trim());
    const last = names.reduce((n, name, i) => (name ? i + 1 : n), 0);
    if (names.slice(0, last).some((n) => !n)) throw new Error('Name every level down to the last one you name: a level can’t be left without a name in between.');
    setLevels(await api.setLevels(names.slice(0, last)));
  };

  const unready = loading || Boolean(error);
  const why = error ? 'Departments couldn’t be loaded. Try again first.' : 'Wait for the departments to load.';
  const actions: PageAction[] = [
    { id: 'new', label: 'New department', disabled: unready, reason: why },
    { id: 'levels', label: 'Level names', kind: 'tertiary', disabled: unready, reason: why },
  ];
  const rows: TableRow[] = departments
    .map((d) => ({
      id: d.id,
      name: departmentPath(d.id, departments),
      level: levelOf(d.id, departments, levels.levels),
      members: d.members.length,
      within: d.parentId ? departmentPath(d.parentId, departments) : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const department = departments.find((d) => d.id === open);
  const parentOptions = [
    { value: TOP, label: 'Nowhere: a top-level department' },
    ...departments.map((d) => ({ value: d.id, label: departmentPath(d.id, departments) })).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  return (
    <Page
      heading="Departments"
      summary={`Who belongs where. A department can sit inside another: ${levels.levels.join(', then ')}.`}
      actions={actions}
      onAction={(a) => (a.id === 'new' ? setAdding(true) : setNaming(true))}
    >
      <Table noun="departments" filterable columns={columns} rows={rows} loading={loading} error={error} empty="No departments yet." onOpen={(row) => {
          setMemberError('');
          setOpen(row.id);
        }} onRetry={() => void load()} />
      {adding && !unready ? (
        <Dialog
          open
          eyebrow="Departments"
          heading="New department"
          actionLabel="Add"
          busyLabel="Adding…"
          onSubmit={async (values) => {
            const created = await api.addDepartment((values.name ?? '').trim(), values.parent || undefined);
            setDepartments((all) => [...all, created]);
          }}
          onClose={() => setAdding(false)}
          fields={
            <>
              <TextField name="name" label="Name" required validate={nameCheck(departments)} />
              <Select name="parent" label="Inside" optional options={parentOptions} defaultValue={TOP} />
            </>
          }
        />
      ) : null}
      {naming ? (
        <Dialog
          open
          eyebrow="Departments"
          heading="Level names"
          summary={`What each level of department is called, from the top. People see the name on their floor, and a level deeper than the last name takes that one. Up to ${levels.max} levels.`}
          actionLabel="Save"
          busyLabel="Saving…"
          onSubmit={saveLevels}
          onClose={() => setNaming(false)}
          fields={Array.from({ length: levels.max }, (_, i) => (
            <TextField
              key={i}
              name={`level${i + 1}`}
              label={i === 0 ? 'At the top' : `Level ${i + 1}`}
              required={i === 0}
              optional={i > 0}
              defaultValue={levels.levels[i] ?? ''}
              hint={i >= levels.levels.length ? `Without a name, it’s called ${levels.levels[levels.levels.length - 1]}` : undefined}
            />
          ))}
        />
      ) : null}
      {department ? <Details department={department} departments={departments} people={people} working={working} problem={memberError} membership={membership} api={api} onRenamed={(d) => setDepartments((all) => all.map((x) => (x.id === d.id ? { ...x, name: d.name } : x)))} onClose={() => setOpen(undefined)} /> : null}
    </Page>
  );
}

/** One department: who's in it, adding and removing them straight away, and its name, saved with Save. */
function Details(p: {
  api: AdminApi;
  department: Department;
  departments: Department[];
  people: Person[];
  working: boolean;
  problem: string;
  membership: (d: Department, person: string, add: boolean) => Promise<void>;
  onRenamed: (d: Department) => void;
  onClose: () => void;
}) {
  const { department } = p;
  const members = p.people.filter((x) => department.members.includes(x.id)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const others = p.people
    .filter((x) => !department.members.includes(x.id))
    .map((x) => ({ value: x.id, label: fullName(x), ...(x.enabled ? {} : { detail: 'Sign-in off' }) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const parent = department.parentId ? departmentPath(department.parentId, p.departments) : '';
  return (
    <Dialog
      open
      size="glance"
      eyebrow={parent ? `Inside ${parent}` : 'Department'}
      heading={department.name}
      summary={`${members.length} ${members.length === 1 ? 'member' : 'members'}. Changes to members happen straight away; a new name waits for Save.`}
      actionLabel="Save name"
      busyLabel="Saving…"
      onSubmit={async (values) => p.onRenamed(await p.api.renameDepartment(department.id, (values.name ?? '').trim()))}
      onClose={p.onClose}
      fields={<TextField name="name" label="Name" required defaultValue={department.name} validate={nameCheck(p.departments, department.id, department.parentId)} />}
    >
      <div data-members className="admin-stack">
        {members.length ? (
          members.map((m) => (
            <Line
              key={m.id}
              end={
                <Button kind="tertiary" size="sm" busy={p.working} onPress={() => void p.membership(department, m.id, false)}>
                  Remove
                </Button>
              }
            >
              {fullName(m)} <Quiet>{m.email ?? ''}</Quiet>
            </Line>
          ))
        ) : (
          <p>No one is in {department.name} yet.</p>
        )}
      </div>
      <Select label="Add someone" placeholder="Choose a person" options={others} busy={p.working} value={null} onChange={(id) => void p.membership(department, id, true)} empty="Everyone is in it already." />
      <Problem>{p.problem}</Problem>
    </Dialog>
  );
}
