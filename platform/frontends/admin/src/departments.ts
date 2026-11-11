import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { departmentPath, fullName, levelOf, type Department, type TeamLevels } from './api.js';
import { asking, count, said, waiting } from './common.js';
import { quill } from './quill.js';
import { pathOf } from './routes.js';
import type { View } from './view.js';

const TOP = '';
/** What each level is called until it's named, and how deep departments can go, until identity says. */
const LEVELS: TeamLevels = { levels: ['Department', 'Team'], max: 5 };

/** Why a department's name wouldn't work there: a slash, or another with the same name beside it. */
export const nameProblem = (departments: Department[], value: string, except?: string, parentId?: string): string | undefined => {
  if (!value.trim()) return 'A department needs a name.';
  if (value.includes('/')) return 'A department’s name can’t have a / in it.';
  const clash = departments.find((d) => d.id !== except && (d.parentId ?? TOP) === (parentId ?? TOP) && d.name.toLowerCase() === value.trim().toLowerCase());
  return clash ? `There is already a department called “${clash.name}” there.` : undefined;
};

/** The level names from what's typed into each, or why they don't work: none may be left out above the last one named. */
export const levelsFrom = (typed: string[]): string[] | string => {
  const names = typed.map((n) => n.trim());
  const last = names.reduce((n, name, i) => (name ? i + 1 : n), 0);
  if (!last) return 'The top level needs a name.';
  if (names.slice(0, last).some((n) => !n)) return 'Name every level down to the last one you name: a level can’t be left without a name in between.';
  return names.slice(0, last);
};

/**
 * Departments: who belongs where. One can sit inside another; each level has a name (Department at the top and
 * Team inside it unless renamed), which people see on their floors. A person's department reaches apps as the
 * `departments` claim when they next sign in.
 */
export const departmentsPage = (v: View, adding = false): RemoteNode => {
  const { departments } = v.r;
  const wait = waiting([departments], 'Reading the departments');
  if (wait) return wait;
  const all = departments.value!;
  const levels = v.r.levels.value ?? LEVELS;
  const rows = all
    .map((d) => ({ id: d.id, name: departmentPath(d.id, all), level: levelOf(d.id, all, levels.levels), members: d.members.length, within: d.parentId ? departmentPath(d.parentId, all) : '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [
    quill(
      'quill-table',
      {
        label: 'Departments',
        noun: 'departments',
        filterable: true,
        pageSize: 25,
        columns: [
          { key: 'name', label: 'Department', sortable: true },
          { key: 'level', label: 'Level', sortable: true },
          { key: 'members', label: 'Members', kind: 'number', sortable: true, sortFirst: 'desc' },
          { key: 'within', label: 'Inside', sortable: true },
        ],
        rows,
        empty: 'No departments yet.',
        onOpen: (id: string) => v.on.go(pathOf({ page: 'department', id })),
      },
      [quill('quill-button', { slot: 'actions', label: 'New department', kind: 'secondary', size: 'sm', onPress: () => v.on.go(pathOf({ page: 'department-new' })) })],
    ),
    quill('quill-section', { label: 'Level names' }, [
      quill('quill-notice', { tone: 'info' }, `What each level of department is called, from the top. People see the name on their floor, and a level deeper than the last name takes that one. Up to ${levels.max} levels.`),
      Array.from({ length: levels.max }, (_, i) =>
        quill('quill-text-field', {
          label: i === 0 ? 'At the top' : `Level ${i + 1}`,
          value: levels.levels[i] ?? '',
          ...(i === 0 ? { required: true } : { optional: true }),
          ...(i >= levels.levels.length ? { hint: `Without a name, it’s called ${levels.levels[levels.levels.length - 1] ?? ''}` } : {}),
          onCommit: (typed: string) => {
            const next = Array.from({ length: levels.max }, (_, j) => (j === i ? typed : (levels.levels[j] ?? '')));
            const names = levelsFrom(next);
            if (typeof names === 'string') {
              v.ui.problem = { where: 'levels', words: names };
              return v.on.draw();
            }
            if (names.join('\n') === levels.levels.join('\n')) return;
            v.on.act('levels', async () => v.on.put('levels', await v.api.setLevels(names)));
          },
        }),
      ),
      said(v, 'levels'),
    ]),
    adding ? addQuestion(v, all) : null,
  ];
};

const addQuestion = (v: View, all: Department[]): RemoteNode =>
  quill(
    'quill-dialog',
    {
      ...asking(v, pathOf({ page: 'departments' })),
      eyebrow: 'Departments',
      heading: 'New department',
      actionLabel: 'Add',
      busyLabel: 'Adding',
      onSubmit: (values: Record<string, string>) => {
        const name = (values.name ?? '').trim();
        const parent = values.parent || undefined;
        const problem = nameProblem(all, name, undefined, parent);
        if (problem) {
          v.ui.dialog = { error: problem };
          return v.on.draw();
        }
        let to = pathOf({ page: 'departments' });
        v.on.answer(
          () => to,
          async () => {
            const created = await v.api.addDepartment(name, parent);
            v.on.put('departments', [...(v.r.departments.value ?? []), created]);
            to = pathOf({ page: 'department', id: created.id });
          },
        );
      },
    },
    [
      quill('quill-text-field', { slot: 'fields', name: 'name', label: 'Name', required: true }),
      quill('quill-select', {
        slot: 'fields',
        name: 'parent',
        label: 'Inside',
        optional: true,
        options: [{ value: TOP, label: 'Nowhere: a top-level department' }, ...all.map((d) => ({ value: d.id, label: departmentPath(d.id, all) })).sort((a, b) => a.label.localeCompare(b.label))],
        value: TOP,
      }),
    ],
  );

/** One department, on a page of its own: its name, saved as it changes, and who's in it, added and removed at once. */
export const departmentPage = (v: View, id: string): RemoteNode => {
  const { departments, people } = v.r;
  const wait = waiting([departments, people], 'Reading the department');
  if (wait) return wait;
  const all = departments.value!;
  const d = all.find((x) => x.id === id);
  if (!d) return quill('quill-state', { kind: 'empty', heading: 'There’s no department with that id', body: 'It may have been removed.', action: 'See all departments', size: 'page', onAction: () => v.on.go(pathOf({ page: 'departments' })) });
  const everyone = people.value!;
  const members = everyone.filter((x) => d.members.includes(x.id)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const others = everyone
    .filter((x) => !d.members.includes(x.id))
    .map((x) => ({ value: x.id, label: fullName(x), ...(x.enabled ? {} : { detail: 'Sign-in off' }) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const membership = (person: string, add: boolean) =>
    v.on.act('members', async () => {
      await (add ? v.api.addMember(d.id, person) : v.api.removeMember(d.id, person));
      v.on.put('departments', (v.r.departments.value ?? []).map((x) => (x.id === d.id ? { ...x, members: add ? [...x.members, person] : x.members.filter((m) => m !== person) } : x)));
      v.on.put('people', (v.r.people.value ?? []).map((x) => (x.id === person ? { ...x, departments: add ? [...x.departments, d.id] : x.departments.filter((y) => y !== d.id) } : x)));
    });
  const levels = v.r.levels.value ?? LEVELS;
  return [
    quill('quill-details', {
      items: [
        { label: 'Level', value: levelOf(d.id, all, levels.levels) },
        { label: 'Inside', value: d.parentId ? departmentPath(d.parentId, all) : 'Nowhere: it’s at the top' },
        { label: 'Members', value: count(members.length, 'member', 'members') },
      ],
    }),
    quill('quill-section', { label: 'Its name' }, [
      quill('quill-text-field', {
        label: 'Name',
        value: d.name,
        required: true,
        onCommit: (typed: string) => {
          if (typed.trim() === d.name) return;
          const problem = nameProblem(all, typed, d.id, d.parentId);
          if (problem) {
            v.ui.problem = { where: 'name', words: problem };
            return v.on.draw();
          }
          v.on.act('name', async () => {
            const renamed = await v.api.renameDepartment(d.id, typed.trim());
            v.on.put('departments', (v.r.departments.value ?? []).map((x) => (x.id === d.id ? { ...x, name: renamed.name } : x)));
          });
        },
      }),
      said(v, 'name'),
    ]),
    quill('quill-section', { label: 'Who’s in it', count: members.length }, [
      quill('quill-list', {
        label: 'Members',
        noun: ['member', 'members'],
        density: 'compact',
        items: members.map((m) => ({ id: m.id, title: fullName(m), ...(m.email ? { detail: m.email } : {}), actions: [{ id: 'remove', label: 'Remove' }] })),
        empty: `No one is in ${d.name} yet.`,
        onOpen: (person: string) => v.on.go(pathOf({ page: 'person', id: person })),
        onAction: ({ item }: { item: string }) => membership(item, false),
      }),
      quill('quill-select', { label: 'Add someone', placeholder: 'Choose a person', options: others, empty: 'Everyone is in it already.', onChange: (person: string) => person && membership(person, true) }),
      said(v, 'members'),
    ]),
  ];
};
