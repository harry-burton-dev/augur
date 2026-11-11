import type { AppContext, FrameState, Intent, RemoteElement, RemoteNode } from '@augur/mfe-sdk/sdk3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { describe as sentence, namesFrom, queryFor, rangeFor, FIRST_FILTERS } from './activity.js';
import { departmentPath, type AuditEntry, type CatalogueApp, type Department, type Person } from './api.js';
import { appEyebrow, appStatus, floorStatus, floorTree, inboxWords, kindOf, kindWords, refusedKindNote, scopeWords, uploadChoices } from './apps-model.js';
import { levelsFrom, nameProblem } from './departments.js';
import start from './entry.js';
import { daysProblem, languageLabel, orgNameProblem, securityChange, zoneLabel } from './organisation.js';
import { endOf, grantProblem, holderName, placeName, roleNameProblem } from './roles.js';
import { pathOf, routeFor, type Route } from './routes.js';

// The shell, as Admin sees it from its worker: what it draws, what it sets on its pane, where it moves, the
// intents it raises, the files it saves and whether it asked for the password again. Its `ctx.fetch` ends at
// `answer`, standing in for the gateway and identity, the registry and events behind it.
type Answer = (method: string, path: string, body?: unknown) => [number, unknown] | undefined;

const finance: Department = { id: 'd-1', name: 'Finance', members: ['u-1'] };
const payroll: Department = { id: 'd-2', name: 'Payroll', parentId: 'd-1', members: [] };
const alex: Person = { id: 'u-1', username: 'alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', enabled: true, invited: false, roles: ['admin'], departments: ['d-1'] };
const sam: Person = { id: 'u-2', username: 'sam', firstName: 'Sam', lastName: 'Okafor', email: 'sam@example.org', enabled: false, invited: false, roles: [], departments: [] };
const library: CatalogueApp = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.2.0', sdk: '^3.0.0', platform: false, enabled: true, scopes: ['notifications:send'], registeredBy: 'library' };
const catalogue: CatalogueApp[] = [
  { id: 'admin', name: 'Admin', route: '/admin', entry: '/apps/admin/0.20.0/sandbox.js', version: '0.20.0', sdk: '^3.0.0', platform: true, enabled: true, icon: 'admin' },
  { id: 'upgrades', name: 'Deployment', route: '/upgrades', entry: '/apps/upgrades/0.2.0/sandbox.js', version: '0.2.0', sdk: '^3.0.0', platform: true, enabled: true, icon: 'download' },
];
const org = {
  name: 'Northwind',
  timeZone: 'UTC',
  sender: { name: 'Northwind' },
  idle: { on: true, warningDays: 60, turnOffDays: 90 },
  notice: { on: false, version: 0 },
  languages: ['en'],
  defaultLanguage: 'en',
  security: { twoStepForAll: false, leaverRetentionDays: 90, activityRetentionDays: 365 },
};

/** Identity, the registry and events, answering each read as a test gives it, and anything else not found. */
const services =
  (more: Answer = () => undefined, people: Person[] = [alex, sam]): Answer =>
  (method, path, body) => {
    const said = more(method, path, body);
    if (said) return said;
    if (path === '/api/identity/v1/admin/people' && method === 'GET') return [200, people];
    if (path === '/api/identity/v1/admin/departments') return [200, [finance, payroll]];
    if (path === '/api/identity/v1/admin/roles') return [200, [{ name: 'admin' }, { name: 'editor' }, { name: 'deployment-admin' }]];
    if (path === '/api/identity/v1/admin/levels') return [200, method === 'PUT' ? { levels: (body as { levels: string[] }).levels, max: 5 } : { levels: ['Department', 'Team'], max: 5 }];
    if (path === '/api/identity/v1/admin/leave-requests') return [200, []];
    if (path === '/api/identity/v1/admin/lifecycle') return [200, { email: false, today: '2026-11-11' }];
    if (path === '/api/identity/v1/organisation') return [200, org];
    if (path === '/api/identity/v1/admin/organisation/time-zones') return [200, ['UTC', 'Europe/London']];
    if (path === '/api/identity/v1/admin/organisation/languages') return [200, ['en', 'fr']];
    if (path === '/api/identity/v1/me/workspaces') return [200, { workspaces: [{ id: 'o', kind: 'org', name: 'Northwind' }] }];
    if (path === '/api/registry/v1/apps') return [200, [...catalogue, library]];
    if (path.startsWith('/api/events/v1/audit')) return [200, []];
    return [404, { message: 'Not here.' }];
  };

const fakeShell = (answer: Answer, path = '/') => {
  const shell = {
    screen: undefined as RemoteNode,
    pane: {} as FrameState,
    moved: [] as string[],
    calls: [] as { method: string; path: string; body?: unknown }[],
    raised: [] as Intent[],
    saved: [] as string[],
    signedInAgain: 0,
    drop: (_files: File[]): unknown => undefined,
  };
  let navigated: (path: string) => void = () => undefined;
  const root = (put: (node: RemoteNode) => void) => ({ render: put, clear: () => put(null) });
  const ctx: AppContext = {
    person: { id: 'u-1', name: 'Alex Rivera' },
    workspace: { id: 'o', kind: 'org', name: 'Northwind' },
    path,
    surface: 'screen',
    onNavigate: (h) => {
      navigated = h;
      return () => undefined;
    },
    navigate: (p) => void shell.moved.push(p),
    fetch: async (p, init) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
      shell.calls.push({ method, path: p, ...(body === undefined ? {} : { body }) });
      const [status, data] = answer(method, p, body) ?? [404, {}];
      return status === 204 ? new Response(null, { status }) : Response.json(data, { status });
    },
    frame: {
      screen: root((node) => (shell.screen = node)),
      about: () => root(() => undefined),
      card: root(() => undefined),
      set: (state) => Object.assign(shell.pane, state),
      under: () => undefined,
      onCommand: () => () => undefined,
    },
    files: {
      upload: async () => new Response(null, { status: 501 }),
      download: async (p) => {
        shell.saved.push(p);
        if (p.includes('fail')) throw new Error('Only an admin can export the whole audit log.');
        return undefined;
      },
      onDrop: (h) => {
        shell.drop = h;
        return () => undefined;
      },
    },
    raise: async (intent) => void shell.raised.push(intent),
    request: async () => Promise.reject(new Error('No app answers that here.')),
    notify: () => undefined,
    signInAgain: () => void shell.signedInAgain++,
    previewOn: () => false,
  };
  return { ctx, shell, move: (p: string) => navigated(p) };
};

/** Every element in a tree, depth first. */
const elements = (node: RemoteNode): RemoteElement[] => (Array.isArray(node) ? node.flatMap(elements) : node && typeof node === 'object' ? [node, ...elements(node.children)] : []);
const text = (node: RemoteNode) => JSON.stringify(node);
const find = (node: RemoteNode, type: string, where: (props: Record<string, unknown>) => boolean = () => true) => elements(node).find((e) => e.type === type && where(e.props ?? {}));
const labelled = (node: RemoteNode, type: string, label: string) => find(node, type, (p) => p.label === label);
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};
const handler = (e: RemoteElement | undefined, name: string) => {
  expect(e, `nothing to ${name}`).toBeTruthy();
  return (e?.props?.[name] as (detail?: unknown) => void) ?? (() => undefined);
};

const open = async (answer: Answer, path = '/') => {
  const shell = fakeShell(answer, path);
  await start(shell.ctx);
  await settle();
  return shell;
};

afterEach(() => vi.restoreAllMocks());

describe('routes', () => {
  it('reads every page and question back from its path, and opens People for anything else', () => {
    const routes: Route[] = [
      { page: 'people' },
      { page: 'person-new' },
      { page: 'person', id: 'u 1' },
      { page: 'person', id: 'u-2', ask: 'delete' },
      { page: 'departments' },
      { page: 'department-new' },
      { page: 'department', id: 'd-1' },
      { page: 'roles' },
      { page: 'role-new' },
      { page: 'role', id: 'r-1' },
      { page: 'role', id: 'r-1', takeBack: 'g-1' },
      { page: 'organisation' },
      { page: 'organisation', ask: { key: 'activityRetentionDays', value: '400' } },
      { page: 'apps' },
      { page: 'app', id: 'library' },
      { page: 'activity' },
      { page: 'entry', id: '42' },
    ];
    for (const r of routes) expect(routeFor(pathOf(r))).toEqual(r);
    expect(routeFor('/')).toEqual({ page: 'people' });
    // Status and Dev to production moved to Deployment.
    expect(routeFor('/updates')).toEqual({ page: 'people' });
    expect(routeFor('/organisation/security/made-up/1')).toEqual({ page: 'organisation' });
  });
});

describe('People', () => {
  it('lists everyone with their department’s full name and sign-in, drawing only Quill by name, and opens each on a page of their own', async () => {
    const { shell } = await open(services());
    expect(shell.pane).toMatchObject({ title: 'People', layout: 'focus', width: 'wide' });
    expect(elements(shell.screen).every((e) => e.type.startsWith('quill-'))).toBe(true);
    const table = labelled(shell.screen, 'quill-table', 'People');
    expect(table?.props?.rows).toMatchObject([
      { id: 'u-1', name: 'Alex Rivera', department: 'Finance', signIn: 'Active' },
      { id: 'u-2', name: 'Sam Okafor', department: '', signIn: 'Off' },
    ]);
    handler(table, 'onOpen')('u-2');
    expect(shell.moved.at(-1)).toBe('/people/u-2');
    expect(shell.pane.title).toBe('Sam Okafor');
    expect(find(shell.screen, 'quill-dialog')).toBeUndefined();
  });

  it('adds a person from a question of its own, shows their one-time password once and opens their page', async () => {
    const added = { ...sam, id: 'u-3', firstName: 'Jo', lastName: 'Bloggs', email: 'jo@example.org', enabled: true, invited: true, roles: ['editor'], departments: ['d-2'] };
    const { shell } = await open(services((m, p) => (m === 'POST' && p === '/api/identity/v1/admin/people' ? [201, { person: added, temporaryPassword: 'abcd-efgh-jkmn' }] : undefined)), '/people/new');
    const dialog = find(shell.screen, 'quill-dialog');
    expect(dialog?.props).toMatchObject({ heading: 'Add a person' });
    // Email isn't set up here, so an invite can't be chosen, and says why.
    expect(text(labelled(dialog?.children, 'quill-select', 'How they start'))).toContain('Email isn’t set up');
    handler(labelled(shell.screen, 'quill-checkbox-group', 'Roles'), 'onChange')(['editor']);
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({ firstName: 'Jo', lastName: 'Bloggs', email: 'nope', department: 'd-2' });
    expect(find(shell.screen, 'quill-dialog')?.props?.error).toMatch(/missing something/);
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({ firstName: 'Jo', lastName: 'Bloggs', email: 'jo@example.org', department: 'd-2', start: 'temporary-password' });
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')?.body).toEqual({ start: 'temporary-password', firstName: 'Jo', lastName: 'Bloggs', email: 'jo@example.org', roles: ['editor'], departments: ['d-2'] });
    expect(shell.moved.at(-1)).toBe('/people/u-3');
    expect(labelled(shell.screen, 'quill-text-field', 'One-time password')?.props).toMatchObject({ value: 'abcd-efgh-jkmn', readOnly: true });
  });

  it('saves their details as each changes, and keeps their other departments', async () => {
    const both = { ...alex, departments: ['d-1', 'd-2'] };
    const { shell } = await open(services((m, p, body) => (m === 'PATCH' ? [200, { ...both, ...(body as object) }] : undefined), [both, sam]), '/people/u-1');
    handler(labelled(shell.screen, 'quill-text-field', 'First name'), 'onCommit')('Alexis');
    await settle();
    expect(shell.calls.filter((c) => c.method === 'PATCH').at(-1)).toEqual({ method: 'PATCH', path: '/api/identity/v1/admin/people/u-1', body: { firstName: 'Alexis' } });
    expect(shell.pane.title).toBe('Alexis Rivera');
    handler(labelled(shell.screen, 'quill-text-field', 'Email'), 'onCommit')('alex@');
    expect(text(shell.screen)).toContain('That email is missing something');
    handler(labelled(shell.screen, 'quill-select', 'Department'), 'onChange')('');
    await settle();
    expect(shell.calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ departments: ['d-2'] });
    handler(labelled(shell.screen, 'quill-checkbox-group', 'Roles'), 'onChange')(['admin', 'editor']);
    await settle();
    expect(shell.calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ roles: ['admin', 'editor'] });
  });

  it('won’t let an admin turn off their own sign-in or run the leaver flow on themselves, and says why', async () => {
    const { shell } = await open(services(), '/people/u-1');
    expect(labelled(shell.screen, 'quill-ask-twice', 'Turn off their sign-in')?.props).toMatchObject({ disabled: true, reason: 'You can’t turn off your own sign-in.' });
    expect(text(labelled(shell.screen, 'quill-ask-twice', 'They’re leaving'))).toContain('You can’t run the leaver flow on yourself');
  });

  it('turns a sign-in on and gives a new one-time password at once, saying what each did where it was pressed', async () => {
    const { shell } = await open(
      services((m, p) => (m === 'PATCH' ? [200, { ...sam, enabled: true }] : m === 'POST' && p.endsWith('/password') ? [200, { temporaryPassword: 'pqrs-tuvw' }] : undefined)),
      '/people/u-2',
    );
    handler(labelled(shell.screen, 'quill-button', 'Turn their sign-in on'), 'onPress')();
    await settle();
    expect(shell.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ enabled: true });
    expect(text(shell.screen)).toContain('Sign-in turned on: they can sign in again.');
    handler(labelled(shell.screen, 'quill-ask-twice', 'Give them a new one-time password'), 'onPress')();
    await settle();
    expect(labelled(shell.screen, 'quill-text-field', 'One-time password')?.props?.value).toBe('pqrs-tuvw');
  });

  it('runs the leaver flow with who takes on their work, and says what happened', async () => {
    const { shell } = await open(services((m, p) => (m === 'POST' && p.endsWith('/leave') ? [200, { ...sam, state: 'left', left: { at: '2026-11-11T10:00:00Z', handOverTo: 'u-1' } }] : undefined)), '/people/u-2');
    handler(labelled(shell.screen, 'quill-select', 'Hand their work to'), 'onChange')('u-1');
    handler(labelled(shell.screen, 'quill-text-field', 'Note for Activity'), 'onChange')(' Moving on ');
    handler(labelled(shell.screen, 'quill-ask-twice', 'They’re leaving'), 'onPress')();
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', path: '/api/identity/v1/admin/people/u-2/leave', body: { handOverTo: 'u-1', note: 'Moving on' } });
    expect(text(shell.screen)).toContain('apps are handing what they own to Alex Rivera');
    expect(labelled(shell.screen, 'quill-ask-twice', 'They’re leaving')).toBeUndefined();
  });

  it('deletes a leaver’s account only for a deployment admin, from a question that asks for the password again', async () => {
    const leaver = { ...sam, state: 'left' as const, left: { at: '2026-11-01T10:00:00Z', by: 'u-1' } };
    const plain = await open(services(undefined, [alex, leaver]), '/people/u-2');
    expect(text(labelled(plain.shell.screen, 'quill-button', 'Delete their account now'))).toContain('Only a deployment admin can do this');
    const boss = { ...alex, roles: ['admin', 'deployment-admin'] };
    let fresh = false;
    const { shell } = await open(
      services((m) => (m === 'DELETE' ? (fresh ? [200, { deleted: true }] : [401, { error: 'sign_in_again', message: 'Enter your password again.' }]) : undefined), [boss, leaver]),
      '/people/u-2',
    );
    handler(labelled(shell.screen, 'quill-button', 'Delete their account now'), 'onPress')();
    expect(shell.moved.at(-1)).toBe('/people/u-2/delete');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.signedInAgain).toBe(1);
    fresh = true;
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.moved.at(-1)).toBe('/people');
    expect(labelled(shell.screen, 'quill-table', 'People')?.props?.rows).toHaveLength(1);
    expect(text(shell.screen)).toContain('Sam Okafor’s account was deleted.');
  });

  it('says so when nobody has that id', async () => {
    const { shell } = await open(services(), '/people/u-9');
    expect(find(shell.screen, 'quill-state')?.props).toMatchObject({ kind: 'empty', heading: 'Nobody here has that id' });
  });
});

describe('Departments', () => {
  it('names a department with the ones it sits inside, and says why a name won’t work', () => {
    expect(departmentPath('d-2', [finance, payroll])).toBe('Finance / Payroll');
    expect(nameProblem([finance, payroll], 'fin/ance')).toMatch(/can’t have a \//);
    expect(nameProblem([finance, payroll], ' finance ')).toMatch(/already a department called “Finance”/);
    expect(nameProblem([finance, payroll], 'Finance', undefined, 'd-1')).toBeUndefined();
    expect(levelsFrom(['Division', '', 'Crew', '', ''])).toMatch(/can’t be left without a name/);
    expect(levelsFrom(['Division', 'Squadron', '', '', ''])).toEqual(['Division', 'Squadron']);
  });

  it('says each department’s level, and renames a level where it’s shown', async () => {
    const { shell } = await open(services(), '/departments');
    expect(labelled(shell.screen, 'quill-table', 'Departments')?.props?.rows).toMatchObject([
      { name: 'Finance', level: 'Department' },
      { name: 'Finance / Payroll', level: 'Team', within: 'Finance' },
    ]);
    handler(labelled(shell.screen, 'quill-text-field', 'Level 4'), 'onCommit')('Crew');
    expect(text(shell.screen)).toMatch(/can’t be left without a name/);
    expect(shell.calls.some((c) => c.method === 'PUT')).toBe(false);
    handler(labelled(shell.screen, 'quill-text-field', 'At the top'), 'onCommit')('Division');
    await settle();
    expect(shell.calls.find((c) => c.method === 'PUT')?.body).toEqual({ levels: ['Division', 'Team'] });
    expect(labelled(shell.screen, 'quill-table', 'Departments')?.props?.rows).toMatchObject([{ level: 'Division' }, { level: 'Team' }]);
  });

  it('adds a department from a question of its own and opens it', async () => {
    const { shell } = await open(services((m, p) => (m === 'POST' && p.endsWith('/departments') ? [201, { id: 'd-3', name: 'Audit', parentId: 'd-1', members: [] }] : undefined)), '/departments/new');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({ name: 'Payroll', parent: 'd-1' });
    expect(find(shell.screen, 'quill-dialog')?.props?.error).toMatch(/already a department called “Payroll”/);
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({ name: 'Audit', parent: 'd-1' });
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Audit', parentId: 'd-1' });
    expect(shell.moved.at(-1)).toBe('/departments/d-3');
    expect(shell.pane.title).toBe('Audit');
  });

  it('renames a department and adds and removes its members, each at once', async () => {
    const { shell } = await open(services((m, p, body) => (m === 'PATCH' ? [200, { ...finance, ...(body as object) }] : p.includes('/members/') ? [204, null] : undefined)), '/departments/d-1');
    expect(labelled(shell.screen, 'quill-list', 'Members')?.props?.items).toMatchObject([{ id: 'u-1', title: 'Alex Rivera' }]);
    handler(labelled(shell.screen, 'quill-text-field', 'Name'), 'onCommit')('Money');
    await settle();
    expect(shell.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ name: 'Money' });
    expect(shell.pane.title).toBe('Money');
    handler(labelled(shell.screen, 'quill-select', 'Add someone'), 'onChange')('u-2');
    await settle();
    expect(shell.calls.find((c) => c.method === 'PUT')?.path).toBe('/api/identity/v1/admin/departments/d-1/members/u-2');
    handler(labelled(shell.screen, 'quill-list', 'Members'), 'onAction')({ item: 'u-1', action: 'remove' });
    await settle();
    expect(shell.calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/identity/v1/admin/departments/d-1/members/u-1');
    expect(labelled(shell.screen, 'quill-list', 'Members')?.props?.items).toMatchObject([{ id: 'u-2', title: 'Sam Okafor' }]);
  });
});

describe('Roles', () => {
  const night = { id: 'r-1', name: 'Night cover', scope: 'org:o', madeBy: 'u-1', madeAs: 'admin.u-1', madeAt: '2026-11-10T09:00:00Z' };
  const payrollRole = { id: 'r-2', name: 'Payroll checks', scope: 'floor:d-2', madeBy: 'u-1', madeAt: '2026-11-10T10:00:00Z' };
  const toSam = { id: 'g-1', giver: 'u-1', subject: 'person:u-2', relation: 'assignee', object: 'role:r-1', reason: 'Covering nights', madeAt: '2026-11-10T11:00:00Z', expiresAt: '2026-12-01T23:59:59.000Z' };
  const settles = { id: 'g-2', giver: 'u-1', subject: 'role:r-1#assignee', relation: 'settler', object: 'floor:d-1', reason: 'Night disputes', madeAt: '2026-11-10T12:00:00Z' };
  const offers = { floor: ['lead', 'member', 'settler', 'raiser'], org: ['publisher', 'audit_reader'] };
  const permissions =
    (more: Answer = () => undefined): Answer =>
    (method, path, body) =>
      more(method, path, body) ??
      (path === '/api/permissions/v1/roles?scope=org%3Athis'
        ? [200, { roles: [night] }]
        : path === '/api/permissions/v1/roles?scope=floor%3Ad-2'
          ? [200, { roles: [payrollRole] }]
          : path === '/api/permissions/v1/roles?scope=floor%3Ad-1'
            ? [403, { error: 'forbidden', message: 'You can see the roles only of floors you stand on.' }]
            : path === '/api/permissions/v1/roles/r-1' && method === 'GET'
              ? [200, { role: night, holders: [toSam], gives: [settles], offers }]
              : services()(method, path, body));
  const names = { people: [alex, sam], departments: [finance, payroll], org: { id: 'o', name: 'Northwind' } };

  it('names who holds a role and where it gives, says why a name or a grant won’t do, and ends on the day chosen', () => {
    expect(holderName('person:u-2', names)).toBe('Sam Okafor');
    expect(holderName('floor:d-2#member', names)).toBe('Everyone in Finance / Payroll');
    expect(holderName('persona:berth-planner#holder', names)).toBe('Whoever holds the position berth-planner');
    expect(holderName('person:gone', names)).toBe('someone no longer here');
    expect(placeName('org:o', names)).toBe('Northwind');
    expect(placeName('floor:d-1', names)).toBe('Finance');
    expect(roleNameProblem([night], ' night COVER ', 'org:o')).toMatch(/already a role called “Night cover”/);
    expect(roleNameProblem([night], 'Night cover', 'floor:d-1')).toBeUndefined();
    expect(roleNameProblem([], '  ', 'org:o')).toMatch(/needs a name/);
    expect(grantProblem({ why: 'no' }, '2026-11-11')).toMatch(/Say why/);
    expect(grantProblem({ why: 'Covering', until: '2026-11-10' }, '2026-11-11')).toMatch(/passed/);
    expect(grantProblem({ why: 'Covering', until: '2026-11-11' }, '2026-11-11')).toBeUndefined();
    expect(endOf('2026-12-01')).toBe('2026-12-01T23:59:59.000Z');
  });

  it('lists the org’s roles and each department’s it can read, and makes a new one from a question of its own', async () => {
    const made = { ...payrollRole, id: 'r-3', name: 'Auditors', scope: 'floor:d-1' };
    const { shell } = await open(permissions((m, p) => (m === 'POST' && p === '/api/permissions/v1/roles' ? [201, made] : undefined)), '/roles');
    expect(shell.pane).toMatchObject({ title: 'Roles', width: 'wide' });
    expect(text(shell.screen)).toContain('sign-in roles People gives');
    expect(labelled(shell.screen, 'quill-table', 'Roles')?.props?.rows).toMatchObject([
      { id: 'r-1', name: 'Night cover', for: 'Northwind' },
      { id: 'r-2', name: 'Payroll checks', for: 'Finance / Payroll' },
    ]);
    handler(find(labelled(shell.screen, 'quill-table', 'Roles')?.children, 'quill-button'), 'onPress')();
    const dialog = find(shell.screen, 'quill-dialog');
    expect(dialog?.props).toMatchObject({ heading: 'New role' });
    handler(dialog, 'onSubmit')({ name: 'night cover', scope: 'org:this' });
    expect(find(shell.screen, 'quill-dialog')?.props?.error).toMatch(/already a role/);
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({ name: 'Auditors', scope: 'floor:d-1' });
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Auditors', scope: { type: 'floor', id: 'd-1' } });
    expect(shell.moved.at(-1)).toBe('/roles/r-3');
  });

  it('shows who holds a role and what it gives, gives it until a day, and lets a department hold it only for good', async () => {
    const { shell } = await open(permissions((m, p) => (m === 'POST' && p === '/api/permissions/v1/roles/r-1/holders' ? [201, { ...toSam, id: 'g-3' }] : undefined)), '/roles/r-1');
    expect(shell.pane.title).toBe('Night cover');
    expect(labelled(shell.screen, 'quill-list', 'Holders')?.props?.items).toMatchObject([{ id: 'g-1', title: 'Sam Okafor', detail: expect.stringContaining('Covering nights') }]);
    expect(labelled(shell.screen, 'quill-list', 'What it gives')?.props?.items).toMatchObject([{ id: 'g-2', title: 'Settle its disputes: Finance' }]);
    handler(labelled(shell.screen, 'quill-select', 'Give it to'), 'onChange')('floor:d-2');
    expect(labelled(shell.screen, 'quill-date-field', 'Until')?.props).toMatchObject({ disabled: true, reason: expect.stringContaining('for good') });
    handler(labelled(shell.screen, 'quill-select', 'Give it to'), 'onChange')('person:u-1');
    expect(labelled(shell.screen, 'quill-date-field', 'Until')?.props?.disabled).toBeUndefined();
    handler(labelled(shell.screen, 'quill-date-field', 'Until'), 'onChange')('2099-01-31');
    handler(find(shell.screen, 'quill-text-field', (p) => p.label === 'Why'), 'onChange')('Weekend cover');
    handler(find(shell.screen, 'quill-button', (p) => p.label === 'Give it'), 'onPress')();
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')?.body).toEqual({ to: { type: 'person', id: 'u-1' }, reason: 'Weekend cover', expiresAt: '2099-01-31T23:59:59.000Z' });
    expect(text(shell.screen)).toContain('Given. It works from their next request.');
  });

  it('says why the service turned a gift down where it was pressed', async () => {
    const { shell } = await open(
      permissions((m, p) => (m === 'POST' && p === '/api/permissions/v1/roles/r-1/gives' ? [403, { error: 'forbidden', message: 'You can give Night cover only what you could give yourself, where you manage it.' }] : undefined)),
      '/roles/r-1',
    );
    handler(labelled(shell.screen, 'quill-select', 'Give its holders'), 'onChange')('org:publisher');
    expect(labelled(shell.screen, 'quill-select', 'In')?.props).toMatchObject({ disabled: true, reason: 'That one is for Northwind as a whole.' });
    handler(find(shell.screen, 'quill-text-field', (p) => p.label === 'Why' && p.value === ''), 'onChange')('x');
    const press = () => handler(elements(shell.screen).filter((e) => e.type === 'quill-button' && e.props?.label === 'Give it').at(-1), 'onPress')();
    press();
    expect(text(shell.screen)).toContain('Say why');
    shellWhy(shell.screen, 'Publishes the rota');
    press();
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')?.body).toEqual({ relation: 'publisher', on: { type: 'org', id: 'this' }, reason: 'Publishes the rota' });
    expect(text(shell.screen)).toContain('only what you could give yourself');
  });

  it('takes a grant back from a question at its own path, with why', async () => {
    const { shell } = await open(permissions((m) => (m === 'DELETE' ? [204, null] : undefined)), '/roles/r-1');
    handler(labelled(shell.screen, 'quill-list', 'Holders'), 'onAction')({ item: 'g-1', action: 'take-back' });
    expect(shell.moved.at(-1)).toBe('/roles/r-1/take-back/g-1');
    const dialog = find(shell.screen, 'quill-dialog');
    expect(dialog?.props).toMatchObject({ heading: 'Take Night cover back from Sam Okafor?', danger: true });
    handler(dialog, 'onSubmit')({ why: 'Back on days' });
    await settle();
    expect(shell.calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/permissions/v1/grants/g-1?reason=Back+on+days');
    expect(shell.moved.at(-1)).toBe('/roles/r-1');
  });
});

/** Types into the second Why on a role's page: what its holders are given. */
const shellWhy = (screen: RemoteNode, why: string) => handler(elements(screen).filter((e) => e.type === 'quill-text-field' && e.props?.label === 'Why').at(-1), 'onChange')(why);

describe('Organisation', () => {
  it('names time zones and languages, and checks names and days as identity does', () => {
    expect(zoneLabel('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe('America/New York, UTC-5');
    expect(zoneLabel('UTC')).toBe('UTC');
    expect(zoneLabel('Not/AZone')).toBe('Not/AZone');
    expect(languageLabel('fr')).toBe('French, fr');
    expect(daysProblem(7, 723, '3')).toBeTruthy();
    expect(daysProblem(7, 723, '6.5')).toBeTruthy();
    expect(daysProblem(7, 723, '60')).toBeUndefined();
    expect(orgNameProblem('North/wind')).toBeTruthy();
    expect(orgNameProblem('Northwind')).toBeUndefined();
    expect(securityChange({ key: 'twoStepForAll', value: 'on' })).toEqual({ twoStepForAll: true });
    expect(securityChange({ key: 'activityRetentionDays', value: '30' })).toMatch(/from 90 to 3650/);
    expect(securityChange({ key: 'leaverRetentionDays', value: '30' })).toEqual({ leaverRetentionDays: 30 });
  });

  it('saves each setting where it’s shown, and says why a value won’t do', async () => {
    const { shell } = await open(services((m, p, body) => (m === 'PATCH' && p === '/api/identity/v1/admin/organisation' ? [200, { ...org, ...(body as object) }] : undefined)), '/organisation');
    expect(shell.pane).toMatchObject({ title: 'Organisation', width: 'read' });
    expect(find(shell.screen, 'quill-dialog')).toBeUndefined();
    handler(labelled(shell.screen, 'quill-text-field', 'Name'), 'onCommit')('North/wind');
    expect(text(shell.screen)).toContain('can’t have a / in it');
    handler(labelled(shell.screen, 'quill-text-field', 'Name'), 'onCommit')('Northwind Trading');
    await settle();
    expect(shell.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ name: 'Northwind Trading' });
    expect(labelled(shell.screen, 'quill-text-field', 'Name')?.props?.value).toBe('Northwind Trading');
    handler(labelled(shell.screen, 'quill-text-field', 'Sender address'), 'onCommit')('augur@northwind.example');
    await settle();
    expect(shell.calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ sender: { name: 'Northwind', address: 'augur@northwind.example' } });
    handler(labelled(shell.screen, 'quill-text-field', 'Turn off after (days)'), 'onCommit')('3');
    expect(text(shell.screen)).toContain('Whole days, from 14 to 730.');
    handler(labelled(shell.screen, 'quill-checkbox-group', 'Offered'), 'onChange')([]);
    expect(text(shell.screen)).toContain('Offer at least one language.');
    handler(labelled(shell.screen, 'quill-checkbox-group', 'Offered'), 'onChange')(['fr']);
    await settle();
    expect(shell.calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ languages: ['fr'], defaultLanguage: 'fr' });
    // The sign-in notice can't be shown before it has words.
    expect(labelled(shell.screen, 'quill-select', 'Notice')?.props).toMatchObject({ disabled: true, reason: 'Give it a title and text first.' });
  });

  it('keeps security and retention for a deployment admin, asking at its own path and again after the password', async () => {
    const plain = await open(services(), '/organisation');
    expect(labelled(plain.shell.screen, 'quill-select', 'Two steps')?.props).toMatchObject({ disabled: true });
    expect(text(labelled(plain.shell.screen, 'quill-select', 'Two steps'))).toContain('Only a deployment admin can change these.');
    let fresh = false;
    const boss = { ...alex, roles: ['admin', 'deployment-admin'] };
    const { shell } = await open(
      services((m, _p, body) => (m === 'PATCH' ? (fresh ? [200, { ...org, security: { ...org.security, ...(body as { security: object }).security } }] : [401, { error: 'sign_in_again', message: 'Enter your password again.' }]) : undefined), [boss, sam]),
      '/organisation',
    );
    handler(labelled(shell.screen, 'quill-text-field', 'Keep Activity (days)'), 'onCommit')('30');
    expect(text(shell.screen)).toContain('Whole days, from 90 to 3650.');
    handler(labelled(shell.screen, 'quill-text-field', 'Keep Activity (days)'), 'onCommit')('400');
    expect(shell.moved.at(-1)).toBe('/organisation/security/activityRetentionDays/400');
    expect(find(shell.screen, 'quill-dialog')?.props).toMatchObject({ heading: 'Keep Activity 400 days?', danger: true });
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.signedInAgain).toBe(1);
    fresh = true;
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ security: { activityRetentionDays: 400 } });
    expect(shell.moved.at(-1)).toBe('/organisation');
    expect(labelled(shell.screen, 'quill-text-field', 'Keep Activity (days)')?.props?.value).toBe('400');
  });

  it('takes a PNG chosen for the logo, and says why anything else won’t do', async () => {
    const { shell } = await open(services((m, p) => (m === 'PUT' && p.endsWith('/logo') ? [200, { url: '/logo.png', width: 64, height: 32 }] : undefined)), '/organisation');
    expect(labelled(shell.screen, 'quill-file-button', 'Choose a PNG')?.props).toMatchObject({ accept: ['image/png'] });
    await shell.drop([new File(['x'], 'logo.jpg', { type: 'image/jpeg' })]);
    expect(text(shell.screen)).toContain('That isn’t a PNG.');
    await shell.drop([new File(['png'], 'logo.png', { type: 'image/png' })]);
    await settle();
    expect(shell.calls.find((c) => c.method === 'PUT')?.path).toBe('/api/identity/v1/admin/organisation/logo');
    expect(text(shell.screen)).toContain('A PNG, 64 by 32');
    expect(labelled(shell.screen, 'quill-button', 'Remove the logo')).toBeTruthy();
  });

  it('says why when the settings can’t be read', async () => {
    const { shell } = await open(services((_m, p) => (p === '/api/identity/v1/organisation' ? [503, { message: 'Identity isn’t answering.' }] : undefined)), '/organisation');
    expect(find(shell.screen, 'quill-state')?.props).toMatchObject({ kind: 'error', body: 'Identity isn’t answering.' });
  });
});

describe('Apps', () => {
  it('says why an app won’t open, what it may do, and what kind it is', () => {
    expect(appStatus({ ...library, sdk: '^2.0.0' }, '1.0.0')).toMatchObject({ status: 'warning', label: 'Won’t open', why: 'It works with AUGUR SDK ^2.0.0; this deployment has 1.0.0.' });
    expect(appStatus(library, '3.0.0')).toMatchObject({ status: 'done', label: 'On' });
    expect(appStatus({ ...library, enabled: false, blocked: 'x' }).label).toBe('Off');
    expect(appStatus({ ...library, blocked: 'Not allowed.' })).toMatchObject({ status: 'warning', label: 'Blocked' });
    expect(scopeWords(['notifications:send', 'audit:write'])).toBe('Notify people, Write to the activity log');
    expect(scopeWords(undefined)).toBe('Nothing beyond registering itself');
    const kinds = { kinds: [{ id: 'assignment', label: 'Assigned to you' }, { id: 'review', label: 'To review' }] };
    expect(inboxWords({ scopes: ['inbox:write'], grantedScopes: ['inbox:write'], inbox: kinds })).toBe('Assigned to you, To review');
    expect(inboxWords({ scopes: ['inbox:write'], grantedScopes: [], inbox: kinds })).toMatch(/until it’s allowed to put work in people’s inboxes/);
    const explorer = { ...library, id: 'auspex', name: 'Explorer', category: 'platform' as const, ships: true, pillar: true };
    const mandate = { ...library, id: 'mandate', name: 'Mandate', category: 'pillar' as const, registeredBy: 'mandate' };
    const rogue = { ...library, categoryRefused: { asked: 'pillar', why: 'x' } };
    expect([catalogue[0]!, explorer, mandate, rogue].map((a) => kindWords(a).label)).toEqual(['Platform app', 'Platform app', 'Pillar app', 'App']);
    expect(appEyebrow(catalogue[0]!)).toBe('Platform app · built into AUGUR');
    expect(appEyebrow(explorer)).toBe('Platform app · ships with AUGUR');
    expect(appEyebrow(mandate)).toBe('Pillar app · registered by mandate');
    expect(appEyebrow({ ...library, pillar: true, registeredBy: undefined })).toBe('Ships with AUGUR');
    expect(kindOf({ ...library, category: 'tool' as never })).toBeUndefined();
    expect(refusedKindNote(rogue)).toBe('Its manifest says it’s a pillar app. Only apps that ship with AUGUR or come from its app feed can be one, so it’s listed as an app.');
  });

  it('offers only lower upload limits, and lays floors out as a tree, deciding each as the registry does', () => {
    expect(uploadChoices({ maxUpload: 25 }).map((c) => c.value)).toEqual(['asked', '10', '5', '1']);
    const tree = floorTree({ id: 'o', name: 'Acme' }, [payroll, finance]);
    expect(tree.map((f) => [f.name, f.path.length])).toEqual([
      ['Acme', 1],
      ['Finance', 2],
      ['Payroll', 3],
    ]);
    const names = new Map(tree.map((f) => [f.id, f.name]));
    expect(floorStatus(library, tree[2]!, [{ workspace: 'd-1', state: 'blocked', carriesOn: true } as never], names)).toEqual({ on: false, words: 'Off: blocked by Finance' });
    expect(floorStatus(library, tree[2]!, [{ workspace: 'o', state: 'off', carriesOn: true } as never], names)).toEqual({ on: false, words: 'Off, as Acme' });
    expect(floorStatus(library, tree[0]!, [], names)).toEqual({ on: true, words: 'On' });
  });

  it('lists every app with its kind, opens each on its own page, and sends what the server runs to Deployment', async () => {
    const { shell } = await open(services(), '/apps');
    expect(labelled(shell.screen, 'quill-table', 'Apps')?.props?.rows).toMatchObject([{ name: 'Admin', kind: 'Platform app', source: 'AUGUR' }, { name: 'Deployment' }, { name: 'Library', kind: 'App', source: 'library' }]);
    handler(labelled(shell.screen, 'quill-table', 'Apps'), 'onOpen')('library');
    await settle();
    expect(shell.moved.at(-1)).toBe('/apps/library');
    expect(shell.pane.title).toBe('Library');
    const server = find(shell.screen, 'quill-notice', (p) => p.action === 'Open it in Deployment');
    expect(text(server)).toContain('Its versions, rolling it back, its sign-in');
    handler(server, 'onAction')();
    await settle();
    expect(shell.raised).toEqual([{ type: 'deployment.app.open', payload: { app: 'library' } }]);
    // Admin never reads the app runner, the event deliveries, where apps load from or an app's kept versions.
    expect(shell.calls.some((c) => /app-runner|deliveries|origins|versions/.test(c.path))).toBe(false);
  });

  it('turns an app off after asking twice, and sets where it’s on floor by floor', async () => {
    const { shell } = await open(
      services((m, p, body) => {
        if (m === 'PATCH') return [200, { ...library, ...(body as object) }];
        if (p === '/api/registry/v1/apps/library/floors' && m === 'GET') return [200, []];
        if (m === 'PUT' && p.includes('/floors/')) return [200, { rules: [{ workspace: 'd-1', state: (body as { state: string }).state, carriesOn: true }] }];
        return undefined;
      }),
      '/apps/library',
    );
    handler(labelled(shell.screen, 'quill-ask-twice', 'Turn it off'), 'onPress')();
    await settle();
    expect(shell.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ enabled: false });
    expect(labelled(shell.screen, 'quill-button', 'Offer it to people')).toBeTruthy();
    expect(labelled(shell.screen, 'quill-select', 'Finance')?.props?.hint).toBe('Off: the app is turned off');
    handler(labelled(shell.screen, 'quill-select', 'Finance'), 'onChange')('blocked');
    await settle();
    expect(shell.calls.find((c) => c.method === 'PUT')).toEqual({ method: 'PUT', path: '/api/registry/v1/apps/library/floors/d-1', body: { state: 'blocked' } });
    expect(labelled(shell.screen, 'quill-select', 'Finance')?.props?.value).toBe('blocked');
  });

  it('explains a refused kind on the app’s page', async () => {
    const rogue = { ...library, categoryRefused: { asked: 'platform', why: 'x' } };
    const { shell } = await open(services((_m, p) => (p === '/api/registry/v1/apps' ? [200, [...catalogue, rogue]] : p.endsWith('/floors') ? [200, []] : undefined)), '/apps/library');
    expect(text(find(shell.screen, 'quill-notice', (p) => p.tone === 'warning'))).toContain('Its manifest says it’s a platform app.');
  });
});

describe('Activity', () => {
  const names = namesFrom([alex, sam], [finance, payroll], [{ id: 'library', name: 'Library' } as CatalogueApp]);
  const entry = (action: string, extra: Partial<AuditEntry> = {}): AuditEntry => ({ id: '1', at: '2026-10-22T10:00:00.000Z', actor: { id: 'u-1', kind: 'user' }, app: 'identity', action, ...extra });

  it('writes each change as a sentence with people’s, departments’ and apps’ names', () => {
    expect(sentence(entry('department.member-added', { target: 'd-1', detail: { person: 'u-2' } }), names)).toBe('Alex Rivera added Sam Okafor to Finance');
    expect(sentence(entry('person.updated', { target: 'u-2', detail: { roles: { from: [], to: ['admin'] }, firstName: {}, lastName: {} } }), names)).toBe('Alex Rivera changed Sam Okafor’s roles and name');
    expect(sentence(entry('app.updated', { app: 'registry', target: 'library', detail: { version: '0.3.0', heldAt: '0.1.0' } }), names)).toBe('Library registered version 0.3.0, kept but not used while it’s held at 0.1.0');
    expect(sentence(entry('app.blocked', { app: 'registry', target: 'library', detail: { workspace: 'd-1' } }), names)).toBe('Alex Rivera blocked Library for Finance and every team below it');
    expect(sentence(entry('organisation.changed', { target: 'organisation', detail: { from: { name: 'Old' }, to: { name: 'Northwind' } } }), names)).toBe('Alex Rivera renamed the organisation to Northwind');
    expect(sentence(entry('organisation.changed', { target: 'organisation', detail: { from: {}, to: { timeZone: 'Europe/London', sender: { name: 'N' } } } }), names)).toBe('Alex Rivera changed the organisation’s time zone and email sender');
    expect(sentence(entry('document.published', { app: 'library', target: 'doc-7' }), names)).toBe('Alex Rivera: document.published (doc-7)');
  });

  it('writes sign-ins, leavers and Activity’s own upkeep as sentences', () => {
    const signIn = (action: string, detail: Record<string, unknown> = {}) => sentence(entry(action, { actor: { id: 'u-2', kind: 'user' }, target: 'u-2', detail: { kind: 'sign-in', ...detail } }), names);
    expect(signIn('sign-in.succeeded', { method: 'password' })).toBe('Sam Okafor signed in');
    expect(signIn('sign-in.succeeded', { method: 'federated' })).toBe('Sam Okafor signed in through the organisation’s sign-in');
    expect(signIn('sign-in.failed')).toBe('Someone failed to sign in as Sam Okafor');
    expect(sentence(entry('sign-in.failed-unknown', { actor: { id: 'identity', kind: 'service' }, detail: { kind: 'sign-in', count: 4 } }), names)).toBe('4 times, someone tried to sign in with a name nobody has');
    expect(sentence(entry('person.left', { target: 'u-2', detail: { handOverTo: 'u-1' } }), names)).toBe('Alex Rivera marked Sam Okafor as a leaver, handing their work to Alex Rivera');
    expect(sentence(entry('person.disabled', { actor: { id: 'keycloak', kind: 'service' }, target: 'u-2', detail: { outside: true, cause: 'idle', days: 90 } }), names)).toBe('Sam Okafor’s sign-in was turned off after 90 days without a sign-in');
    expect(sentence(entry('person.deleted', { target: 'u-2', detail: { now: true } }), names)).toBe('Alex Rivera deleted a leaver’s account; only its id is kept');
    expect(sentence(entry('audit.pruned', { app: 'events', actor: { id: 'events', kind: 'service' }, detail: { removed: 12, keepDays: 365 } }), names)).toBe('12 entries older than 365 days were removed');
  });

  it('turns a period into a time range, and the filters into a query', () => {
    const now = new Date(2026, 9, 22, 15, 30);
    expect(rangeFor('today', now)).toEqual({ since: new Date(2026, 9, 22).toISOString() });
    expect(rangeFor('week', now)).toEqual({ since: new Date(2026, 9, 16).toISOString() });
    expect(rangeFor('all', now)).toEqual({});
    expect(rangeFor('custom', now, '2026-10-01', '2026-10-02')).toEqual({ since: new Date(2026, 9, 1).toISOString(), until: new Date(2026, 9, 3).toISOString() });
    expect(queryFor({ ...FIRST_FILTERS, who: 'u-2', kind: 'sign-in', period: 'all' }, '7', now)).toEqual({ kind: 'sign-in', person: 'u-2', before: '7', limit: 50 });
  });

  it('asks for the last week’s changes, writes each as a sentence, pages to older ones, and opens each on its own page', async () => {
    const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => entry('person.password-reset', { id: String(from - i), target: 'u-2' }));
    const { shell } = await open(services((_m, p) => (p.startsWith('/api/events/v1/audit') ? [200, p.includes('before=') ? page(50, 3) : page(100, 50)] : undefined)), '/activity');
    const first = new URL(shell.calls.find((c) => c.path.includes('/audit'))!.path, 'http://x');
    expect(first.searchParams.get('limit')).toBe('50');
    expect(first.searchParams.get('kind')).toBe('change');
    expect(first.searchParams.get('since')).toBeTruthy();
    const table = () => labelled(shell.screen, 'quill-table', 'Activity');
    expect((table()?.props?.rows as { what: string }[])[0]?.what).toBe('Alex Rivera gave Sam Okafor a new password');
    handler(find(shell.screen, 'quill-more'), 'onMore')();
    await settle();
    expect(shell.calls.at(-1)!.path).toContain('before=51');
    expect(table()?.props?.rows).toHaveLength(53);
    expect(find(shell.screen, 'quill-more')).toBeUndefined();
    handler(table(), 'onOpen')('99');
    expect(shell.moved.at(-1)).toBe('/activity/99');
    expect(find(shell.screen, 'quill-details')?.props?.items).toEqual(expect.arrayContaining([{ label: 'Action', value: 'person.password-reset' }]));
  });

  it('asks again when a filter changes, and saves everything the filters show as a CSV file', async () => {
    const { shell } = await open(services(), '/activity');
    handler(labelled(shell.screen, 'quill-select', 'Who'), 'onChange')('u-2');
    await settle();
    const asked = new URL(shell.calls.filter((c) => c.path.includes('/audit')).at(-1)!.path, 'http://x');
    expect(asked.searchParams.get('actor')).toBe('u-2');
    handler(find(shell.screen, 'quill-button', (p) => p.label === 'Download CSV'), 'onPress')();
    await settle();
    const saved = new URL(shell.saved[0]!, 'http://x');
    expect(saved.pathname).toBe('/api/events/v1/audit/export');
    expect(saved.searchParams.get('actor')).toBe('u-2');
    expect(saved.searchParams.has('limit')).toBe(false);
    handler(labelled(shell.screen, 'quill-select', 'When'), 'onChange')('custom');
    expect(find(shell.screen, 'quill-state')?.props?.heading).toBe('Choose a day to start or end at');
  });
});
