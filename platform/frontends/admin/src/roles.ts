import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { departmentPath, fullName, type Department, type MadeRole, type Person, type RoleGrant, type RoleHolder } from './api.js';
import { asking, off, said, waiting } from './common.js';
import { day } from './parts.js';
import { quill } from './quill.js';
import { pathOf } from './routes.js';
import type { View } from './view.js';

/** The org, as a role's scope and as where it gives something; the permissions service reads `this` as this deployment's org. */
const ORG = 'org:this';

/** What each thing a role can give reads as; anything the service adds later shows by its own name. */
export const RELATIONS: Record<string, string> = {
  lead: 'Lead it',
  member: 'Be a member of it',
  settler: 'Settle its disputes',
  raiser: 'Raise its beliefs to the floor above',
  publisher: 'Publish for the org',
  audit_reader: 'Read the org’s Activity',
};
export const relationWords = (relation: string) => RELATIONS[relation] ?? relation;

/** Everything a page names: people, departments and the org's floor. */
export interface Names {
  people: Person[];
  departments: Department[];
  org: { id: string; name: string };
}

/** Where a role is for, or where something is given: the org, or a department by its path. */
export const placeName = (object: string, n: Names): string => {
  const [type, id = ''] = object.split(':');
  if (type === 'org') return n.org.name;
  return n.departments.some((d) => d.id === id) ? departmentPath(id, n.departments) : 'a floor that’s gone';
};

/** Who a grant is to, as a person reads it. */
export const holderName = (subject: string, n: Names): string => {
  const [who, set] = subject.split('#');
  const [type, id = ''] = (who ?? '').split(':');
  if (type === 'person') {
    const p = n.people.find((x) => x.id === id);
    return p ? fullName(p) : 'someone no longer here';
  }
  if (type === 'floor' && set === 'member') return `Everyone in ${placeName(`floor:${id}`, n)}`;
  if (type === 'persona') return `Whoever holds the position ${id}`;
  if (type === 'role') return 'The holders of another role';
  return subject;
};

/** The day a role given until a date stops: the end of that day, in UTC. */
export const endOf = (date: string) => `${date}T23:59:59.000Z`;

/** Why a role's name wouldn't work: empty, too long, or another of the same name made for the same place. */
export const roleNameProblem = (roles: MadeRole[], name: string, scope: string): string | undefined => {
  const n = name.trim();
  if (!n) return 'A role needs a name.';
  if (n.length > 80) return 'A role’s name can be up to 80 characters.';
  const clash = roles.find((r) => r.scope === scope && r.name.toLowerCase() === n.toLowerCase());
  return clash ? `There is already a role called “${clash.name}” there.` : undefined;
};

/** Why a grant can't be made from what's typed: who and why are needed, and a date can't be past. */
export const grantProblem = (draft: { why?: string; until?: string }, today: string): string | undefined => {
  if ((draft.why ?? '').trim().length < 3) return 'Say why, in a few words. It’s recorded with the grant.';
  if (draft.until && draft.until < today) return 'That day has passed. Choose one still to come, or leave it empty.';
  return undefined;
};

const today = () => new Date().toISOString().slice(0, 10);

const names = (v: View): Names | undefined => {
  const people = v.r.people.value;
  const departments = v.r.departments.value;
  const org = v.r.floor.value;
  return people && departments && org ? { people, departments, org } : undefined;
};

const placeOptions = (n: Names) => [
  { value: ORG, label: `${n.org.name}, the whole org` },
  ...n.departments.map((d) => ({ value: `floor:${d.id}`, label: departmentPath(d.id, n.departments) })).sort((a, b) => a.label.localeCompare(b.label)),
];

const ABOUT =
  'A role made here is a set of holders: people, or everyone in a department. It gives them what you say on the org or on a department, and a grant can end on a day. It isn’t one of the sign-in roles People gives, such as admin. Making and giving roles for the org needs your admin persona: if you’re turned down, choose Act as in Account, Sign-in and security, and try again.';

/** The roles made for the org and each department. Each opens a page of its own. */
export const rolesPage = (v: View, adding = false): RemoteNode => {
  const wait = waiting([v.r.madeRoles, v.r.people, v.r.departments, v.r.floor], 'Reading the roles');
  if (wait) return wait;
  const n = names(v)!;
  const all = v.r.madeRoles.value!;
  const rows = all.map((r) => ({ id: r.id, name: r.name, for: placeName(r.scope, n), made: day(r.madeAt) })).sort((a, b) => a.name.localeCompare(b.name));
  return [
    quill('quill-notice', { tone: 'info' }, ABOUT),
    quill(
      'quill-table',
      {
        label: 'Roles',
        noun: 'roles',
        filterable: true,
        pageSize: 25,
        columns: [
          { key: 'name', label: 'Role', sortable: true },
          { key: 'for', label: 'Made for', sortable: true },
          { key: 'made', label: 'Made', sortable: true },
        ],
        rows,
        empty: 'No roles made yet.',
        onOpen: (id: string) => v.on.go(pathOf({ page: 'role', id })),
      },
      [quill('quill-button', { slot: 'actions', label: 'New role', kind: 'secondary', size: 'sm', onPress: () => v.on.go(pathOf({ page: 'role-new' })) })],
    ),
    adding ? newRole(v, all, n) : null,
  ];
};

const newRole = (v: View, all: MadeRole[], n: Names): RemoteNode =>
  quill(
    'quill-dialog',
    {
      ...asking(v, pathOf({ page: 'roles' })),
      eyebrow: 'Roles',
      heading: 'New role',
      summary: 'Name it for the job it does, such as Night cover. You give it to people, and say what it gives them, on its own page.',
      actionLabel: 'Make it',
      busyLabel: 'Making',
      onSubmit: (values: Record<string, string>) => {
        const name = (values.name ?? '').trim();
        const scope = values.scope || ORG;
        // The service keeps the org's roles under the org's own id.
        const problem = roleNameProblem(all, name, scope === ORG ? `org:${n.org.id}` : scope);
        if (problem) {
          v.ui.dialog = { error: problem };
          return v.on.draw();
        }
        const [type, id = ''] = scope.split(':') as ['org' | 'floor', string];
        let to = pathOf({ page: 'roles' });
        v.on.answer(
          () => to,
          async () => {
            const made = await v.api.makeRole(name, { type, id });
            v.on.put('madeRoles', [...(v.r.madeRoles.value ?? []), made]);
            to = pathOf({ page: 'role', id: made.id });
          },
        );
      },
    },
    [
      quill('quill-text-field', { slot: 'fields', name: 'name', label: 'Name', required: true, maxLength: 80 }),
      quill('quill-select', { slot: 'fields', name: 'scope', label: 'Made for', hint: 'Whoever manages it can give the role and change it.', options: placeOptions(n), value: ORG }),
    ],
  );

/** One role on a page of its own: who holds it and until when, what it gives and where, each taken back from here. */
export const rolePage = (v: View, id: string, takeBack?: string): RemoteNode => {
  const detail = v.r.role(id);
  const wait = waiting([detail, v.r.people, v.r.departments, v.r.floor], 'Reading the role');
  if (wait) {
    if (detail.error && /exist/.test(detail.error))
      return quill('quill-state', { kind: 'empty', heading: 'There’s no role with that id', body: 'It may have been removed.', action: 'See all roles', size: 'page', onAction: () => v.on.go(pathOf({ page: 'roles' })) });
    return wait;
  }
  const n = names(v)!;
  const { role, holders, gives, offers } = detail.value!;
  const nameOf = (person: string) => holderName(`person:${person}`, n);
  const until = (g: RoleGrant) => (g.expiresAt ? `Until ${day(g.expiresAt)}` : 'For good');
  const d = v.ui.draft;
  const again = () => v.on.again(`role:${id}`);

  const give = () => {
    const problem = !d.holder ? 'Choose who to give it to.' : grantProblem(d, today());
    if (problem) {
      v.ui.problem = { where: 'holders', words: problem };
      return v.on.draw();
    }
    const [type, who = ''] = d.holder!.split(':') as [RoleHolder['type'], string];
    v.on.act('holders', async () => {
      await v.api.giveRole(role.id, { type, id: who }, d.why!.trim(), type === 'person' && d.until ? endOf(d.until) : undefined);
      v.ui.draft = {};
      again();
      v.ui.done = { where: 'holders', words: 'Given. It works from their next request.' };
    });
  };
  const addGive = () => {
    const [kind, relation = ''] = (d.relation ?? '').split(':');
    const on = kind === 'org' ? ORG : d.on;
    const problem = !relation ? 'Choose what it gives.' : !on ? 'Choose the department it gives that in.' : grantProblem({ why: d.why2 }, today());
    if (problem) {
      v.ui.problem = { where: 'gives', words: problem };
      return v.on.draw();
    }
    const [type, at = ''] = on!.split(':') as ['org' | 'floor', string];
    v.on.act('gives', async () => {
      await v.api.roleGives(role.id, relation, { type, id: at }, d.why2!.trim());
      v.ui.draft = {};
      again();
      v.ui.done = { where: 'gives', words: 'Given to everyone who holds the role.' };
    });
  };

  const people = n.people
    .filter((p) => p.enabled)
    .map((p) => ({ value: `person:${p.id}`, label: fullName(p) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const departments = n.departments.map((x) => ({ value: `floor:${x.id}`, label: `Everyone in ${departmentPath(x.id, n.departments)}` })).sort((a, b) => a.label.localeCompare(b.label));
  const forPerson = d.holder?.startsWith('person:');
  const what = [
    ...offers.org.map((r) => ({ value: `org:${r}`, label: `${relationWords(r)}, for ${n.org.name}` })),
    ...offers.floor.map((r) => ({ value: `floor:${r}`, label: `${relationWords(r)}, in a department` })),
  ];

  return [
    quill('quill-details', {
      items: [
        { label: 'Made for', value: placeName(role.scope, n) },
        { label: 'Made by', value: `${nameOf(role.madeBy)}${role.madeAs ? ', as their admin persona' : ''}` },
        { label: 'Made', value: day(role.madeAt) },
      ],
    }),
    quill('quill-section', { label: 'Who holds it', count: holders.length }, [
      quill('quill-list', {
        label: 'Holders',
        noun: ['holder', 'holders'],
        density: 'compact',
        items: holders.map((g) => ({ id: g.id, title: holderName(g.subject, n), meta: until(g), detail: `${g.reason}. Given by ${nameOf(g.giver)} on ${day(g.madeAt)}`, actions: [{ id: 'take-back', label: 'Take back' }] })),
        empty: `No one holds ${role.name} yet.`,
        onAction: ({ item }: { item: string }) => v.on.go(pathOf({ page: 'role', id, takeBack: item })),
      }),
      quill('quill-select', {
        label: 'Give it to',
        placeholder: 'Choose a person or a department',
        options: [...people, ...departments],
        value: d.holder ?? '',
        hint: 'Positions can be chosen here once Admin lists them.',
        onChange: (x: string) => ((d.holder = x), x.startsWith('person:') || (d.until = undefined), v.on.draw()),
      }),
      quill('quill-date-field', {
        label: 'Until',
        optional: true,
        value: d.until ?? '',
        empty: 'For good',
        ...off(!forPerson && (d.holder ? 'Everyone in a department holds it for good. Give it to people to make it end.' : 'Choose a person first.')),
        hint: 'It stops at the end of that day, UTC.',
        onChange: (x: string) => ((d.until = x || undefined), v.on.draw()),
      }),
      quill('quill-text-field', { label: 'Why', value: d.why ?? '', maxLength: 300, hint: 'Recorded with the grant, and shown in Activity.', onChange: (x: string) => void (d.why = x) }),
      quill('quill-button', { label: 'Give it', kind: 'secondary', size: 'sm', onPress: give }),
      said(v, 'holders'),
    ]),
    quill('quill-section', { label: 'What it gives', count: gives.length }, [
      quill('quill-list', {
        label: 'What it gives',
        noun: ['thing it gives', 'things it gives'],
        density: 'compact',
        items: gives.map((g) => ({ id: g.id, title: `${relationWords(g.relation)}: ${placeName(g.object, n)}`, detail: `${g.reason}. Given by ${nameOf(g.giver)} on ${day(g.madeAt)}`, actions: [{ id: 'take-back', label: 'Take back' }] })),
        empty: `${role.name} gives nothing yet. Its holders have only what they had already.`,
        onAction: ({ item }: { item: string }) => v.on.go(pathOf({ page: 'role', id, takeBack: item })),
      }),
      quill('quill-select', { label: 'Give its holders', placeholder: 'Choose what', options: what, value: d.relation ?? '', onChange: (x: string) => ((d.relation = x), v.on.draw()) }),
      quill('quill-select', {
        label: 'In',
        placeholder: 'Choose a department',
        options: n.departments.map((x) => ({ value: `floor:${x.id}`, label: departmentPath(x.id, n.departments) })).sort((a, b) => a.label.localeCompare(b.label)),
        value: d.on ?? '',
        empty: 'There are no departments yet.',
        ...off(!d.relation?.startsWith('floor:') && (d.relation ? `That one is for ${n.org.name} as a whole.` : 'Choose what it gives first.')),
        onChange: (x: string) => ((d.on = x), v.on.draw()),
      }),
      quill('quill-text-field', { label: 'Why', value: d.why2 ?? '', maxLength: 300, hint: 'Recorded with the grant, and shown in Activity.', onChange: (x: string) => void (d.why2 = x) }),
      quill('quill-notice', { tone: 'info' }, 'You can give only what you could give yourself, where you manage it. A role never makes anyone an admin.'),
      quill('quill-button', { label: 'Give it', kind: 'secondary', size: 'sm', onPress: addGive }),
      said(v, 'gives'),
    ]),
    takeBack ? takeBackQuestion(v, id, [...holders, ...gives].find((g) => g.id === takeBack), n, role.name) : null,
  ];
};

const takeBackQuestion = (v: View, role: string, g: RoleGrant | undefined, n: Names, name: string): RemoteNode => {
  const back = pathOf({ page: 'role', id: role });
  if (!g) return quill('quill-dialog', { ...asking(v, back), heading: 'It was already taken back', cancelLabel: 'Close' }, quill('quill-notice', { tone: 'info' }, 'Someone took it back, or it ended. Nothing to do.'));
  const holder = g.object === `role:${role}`;
  return quill(
    'quill-dialog',
    {
      ...asking(v, back),
      size: 'glance',
      danger: true,
      eyebrow: name,
      heading: holder ? `Take ${name} back from ${holderName(g.subject, n)}?` : `Stop ${name} giving “${relationWords(g.relation)}”?`,
      summary: 'Anything they gave that they could give only because of it is taken back too. It’s recorded in Activity.',
      actionLabel: 'Take it back',
      busyLabel: 'Taking it back',
      cancelLabel: 'Keep it',
      onSubmit: (values: Record<string, string>) => {
        const why = (values.why ?? '').trim();
        if (why.length < 3) {
          v.ui.dialog = { error: 'Say why, in a few words. It’s recorded.' };
          return v.on.draw();
        }
        v.on.answer(back, async () => {
          await v.api.takeBack(g.id, why);
          v.on.again(`role:${role}`);
        });
      },
    },
    [quill('quill-text-field', { slot: 'fields', name: 'why', label: 'Why', required: true, maxLength: 300 })],
  );
};
