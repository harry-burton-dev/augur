import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { DATABASE_URL, identityDb } from './db.testing.ts';
import { MemoryDirectory } from './directory.ts';
import { TeamDirectory } from './teams.ts';
import { floorsFor, PgWorkspaceStore, slugify, type WorkspaceStore } from './workspaces.ts';

const db = identityDb({ orgName: 'Acme' });

/** The same behaviour from every store. */
const behavesLikeAWorkspaceStore = (make: () => WorkspaceStore, reset: () => Promise<void> = async () => {}) => {
  let store: WorkspaceStore;
  beforeEach(async () => {
    await reset();
    store = make();
  });

  it('has one org, made when first asked for', async () => {
    const [a, b] = await Promise.all([store.org(), store.org()]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ kind: 'org', name: 'Acme', slug: 'org', path: [a.id] });
  });

  it('makes each person’s own floor once, as its own root', async () => {
    const [a, b] = await Promise.all([store.personal('u-1', 'Alex'), store.personal('u-1', 'Alex')]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ kind: 'personal', owner: 'u-1', slug: 'me', path: [a.id] });
    expect(a.parentId).toBeUndefined();
    expect((await store.personal('u-2', 'Sam')).id).not.toBe(a.id);
  });

  it('nests teams under the org, at most five deep', async () => {
    const org = await store.org();
    const finance = await store.createTeam('Finance');
    expect(finance).toMatchObject({ kind: 'team', slug: 'finance', parentId: org.id, path: [org.id, finance.id] });
    let parent = finance;
    for (const name of ['Payroll', 'Pensions', 'Claims', 'Audits']) parent = await store.createTeam(name, parent.id);
    expect(parent.path).toHaveLength(6);
    await expect(store.createTeam('Too deep', parent.id)).rejects.toMatchObject({ status: 400 });
    await expect(store.createTeam('Lost', 'gone')).rejects.toMatchObject({ status: 400 });
    expect((await store.teams()).map((t) => t.name)).toEqual(['Finance', 'Payroll', 'Pensions', 'Claims', 'Audits']);
  });

  it('finds any floor by id', async () => {
    const finance = await store.createTeam('Finance');
    const own = await store.personal('u-1', 'Alex');
    expect(await store.workspace(finance.id)).toEqual(finance);
    expect(await store.workspace(own.id)).toEqual(own);
    expect(await store.workspace('gone')).toBeUndefined();
  });

  it('refuses a sibling’s name, keeps slugs unique and stable', async () => {
    const finance = await store.createTeam('Finance');
    await expect(store.createTeam('finance')).rejects.toMatchObject({ status: 409 });
    const payroll = await store.createTeam('Finance', finance.id);
    expect(payroll.slug).toBe('finance-2');
    expect((await store.createTeam('Me')).slug).toBe('me-2');
    expect(await store.renameTeam(finance.id, 'Money')).toMatchObject({ name: 'Money', slug: 'finance' });
    await expect(store.renameTeam(payroll.id, 'Money')).resolves.toMatchObject({ name: 'Money' });
    await expect(store.renameTeam('gone', 'X')).rejects.toMatchObject({ status: 404 });
  });

  it('adds, re-roles and removes members', async () => {
    const finance = await store.createTeam('Finance');
    await store.setMember(finance.id, 'u-1', 'member');
    await store.setMember(finance.id, 'u-1', 'lead');
    await store.setMember(finance.id, 'u-2', 'member');
    expect(await store.memberships({ workspace: finance.id })).toEqual([
      { workspace: finance.id, person: 'u-1', role: 'lead' },
      { workspace: finance.id, person: 'u-2', role: 'member' },
    ]);
    await store.setMember(finance.id, 'u-1', null);
    expect(await store.memberships({ person: 'u-1' })).toEqual([]);
    await expect(store.setMember('gone', 'u-1', 'member')).rejects.toMatchObject({ status: 404 });
  });

  it('puts people on teams through the positions they hold, and hands a position on whole (ADR 0089)', async () => {
    const port = await store.createTeam('Port Services');
    const master = await store.createPosition(port.id, '  Harbour   master ', 'lead');
    expect(master).toMatchObject({ workspace: port.id, role: 'lead', name: 'Harbour master' });
    expect(master.holder).toBeUndefined();
    // Vacant: it keeps its place, and nobody stands on the team through it.
    expect(await store.memberships({ workspace: port.id })).toEqual([]);
    await store.handOver(master.id, 'u-1');
    expect(await store.memberships({ workspace: port.id })).toEqual([{ workspace: port.id, person: 'u-1', role: 'lead' }]);
    // The next holder has it at once, and the one before doesn't.
    expect(await store.handOver(master.id, 'u-2')).toMatchObject({ id: master.id, holder: 'u-2' });
    expect(await store.memberships({ workspace: port.id })).toEqual([{ workspace: port.id, person: 'u-2', role: 'lead' }]);
    expect(await store.positions({ holder: 'u-1' })).toEqual([]);
    // Taking someone off the team by person leaves a position an admin named, vacant, for the next holder.
    await store.setMember(port.id, 'u-2', null);
    expect(await store.positions({ workspace: port.id })).toEqual([{ id: master.id, workspace: port.id, role: 'lead', name: 'Harbour master' }]);
    expect(await store.updatePosition(master.id, { name: 'Port master', role: 'member' })).toMatchObject({ name: 'Port master', role: 'member' });
    await store.retirePosition(master.id);
    expect(await store.positions({ workspace: port.id })).toEqual([]);
    await expect(store.handOver(master.id, 'u-3')).rejects.toMatchObject({ status: 404 });
    await expect(store.createPosition(port.id, ' ', 'member')).rejects.toMatchObject({ status: 400 });
    await expect(store.createPosition('gone', 'X', 'member')).rejects.toMatchObject({ status: 404 });
  });

  it('counts someone once on a team where they hold two positions, as lead if either leads', async () => {
    const port = await store.createTeam('Port Services');
    const a = await store.createPosition(port.id, 'Berth planner', 'member');
    const b = await store.createPosition(port.id, 'Duty lead', 'lead');
    await store.handOver(a.id, 'u-1');
    await store.handOver(b.id, 'u-1');
    expect(await store.memberships({ person: 'u-1' })).toEqual([{ workspace: port.id, person: 'u-1', role: 'lead' }]);
  });

  it('imports once, parents first, with members', async () => {
    const load = vi.fn(async () => [
      { key: 'kc-payroll', name: 'Payroll', parentKey: 'kc-finance', members: ['u-1'] },
      { key: 'kc-finance', name: 'Finance', members: ['u-2', 'u-2'] },
    ]);
    expect(await store.importOnce('keycloak-groups', load)).toBe(true);
    expect(await store.importOnce('keycloak-groups', load)).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    const [finance, payroll] = await store.teams();
    expect(finance.name).toBe('Finance');
    expect(payroll).toMatchObject({ name: 'Payroll', parentId: finance.id });
    expect(await store.memberships()).toEqual(
      expect.arrayContaining([
        { workspace: payroll.id, person: 'u-1', role: 'member' },
        { workspace: finance.id, person: 'u-2', role: 'member' },
      ]),
    );
    expect(await store.memberships()).toHaveLength(2);
  });

  it('lists the floors someone can stand on: theirs, the org, their teams and those above', async () => {
    const org = await store.org();
    const finance = await store.createTeam('Finance');
    const payroll = await store.createTeam('Payroll', finance.id);
    const legal = await store.createTeam('Legal');
    await store.setMember(payroll.id, 'u-1', 'lead');
    const floors = await floorsFor(store, { id: 'u-1', name: 'Alex' });
    expect(floors.map((f) => [f.name, f.kind, f.role, f.direct])).toEqual([
      ['You', 'personal', 'lead', true],
      ['Acme', 'org', 'member', true],
      ['Finance', 'team', 'member', false],
      ['Payroll', 'team', 'lead', true],
    ]);
    expect(floors[3].path.map((p) => p.name)).toEqual(['Acme', 'Finance', 'Payroll']);
    expect(floors[3].path[0]).toEqual({ id: org.id, kind: 'org', name: 'Acme', slug: 'org' });
    // Teams are named by their level: Department right below the org, Team below that.
    expect(floors.map((f) => f.level)).toEqual([undefined, undefined, 'Department', 'Team']);
    expect(floors[3].path.map((p) => p.level)).toEqual([undefined, 'Department', 'Team']);
    // Being on Finance doesn't put you on Payroll.
    await store.setMember(finance.id, 'u-2', 'member');
    expect((await floorsFor(store, { id: 'u-2', name: 'Sam' })).map((f) => f.name)).toEqual(['You', 'Acme', 'Finance']);
    expect(floors.some((f) => f.id === legal.id)).toBe(false);
  });

  it('names the levels of team, the last name standing for any level deeper', async () => {
    expect(await store.levels()).toEqual(['Department', 'Team']);
    const a = await store.createTeam('Ops');
    const b = await store.createTeam('Fleet', a.id);
    const c = await store.createTeam('Bridge', b.id);
    await store.setMember(c.id, 'u-1', 'member');
    expect((await floorsFor(store, { id: 'u-1', name: 'Alex' })).slice(2).map((f) => f.level)).toEqual(['Department', 'Team', 'Team']);
    expect(await store.setLevels([' Division ', 'Squadron', 'Crew'])).toEqual(['Division', 'Squadron', 'Crew']);
    expect(await store.levels()).toEqual(['Division', 'Squadron', 'Crew']);
    expect((await floorsFor(store, { id: 'u-1', name: 'Alex' })).slice(2).map((f) => f.level)).toEqual(['Division', 'Squadron', 'Crew']);
    await expect(store.setLevels([])).rejects.toThrow(/between 1 and 5/);
    await expect(store.setLevels(['Team', 'team'])).rejects.toThrow(/both be called/);
    await expect(store.setLevels(['  '])).rejects.toThrow(/needs a name/);
    expect(await store.levels()).toEqual(['Division', 'Squadron', 'Crew']);
  });
};

describe.runIf(DATABASE_URL)('PgWorkspaceStore', () => {
  behavesLikeAWorkspaceStore(() => db.workspaces);

  it('takes slugs safely when teams are added at once', async () => {
    const store = new PgWorkspaceStore(db.pool, { orgName: 'Acme' });
    const parent = await store.createTeam('Ops');
    const made = await Promise.all(['A', 'a!', 'A.', 'a?'].map((n) => store.createTeam(n, parent.id)));
    expect(new Set(made.map((t) => t.slug)).size).toBe(4);
  });

  it('makes a position for each place people had on a team before positions, held from when they joined', async () => {
    const finance = await db.workspaces.createTeam('Finance');
    // As an earlier release left it: people on teams directly, and no positions yet.
    await db.pool.query('drop table identity.position_holders, identity.positions');
    await db.pool.query("delete from identity.migrations where id = 'workspaces_004_positions'");
    await db.pool.query(`insert into identity.workspace_members (workspace_id, person, role, added_at) values ($1, 'u-1', 'lead', '2026-01-01'), ($1, 'u-2', 'member', '2026-02-01')`, [finance.id]);
    await db.store.migrate();
    expect(await db.workspaces.memberships({ workspace: finance.id })).toEqual([
      { workspace: finance.id, person: 'u-1', role: 'lead' },
      { workspace: finance.id, person: 'u-2', role: 'member' },
    ]);
    expect((await db.workspaces.positions({ workspace: finance.id })).map((p) => [p.name, p.holder])).toEqual([['Lead', 'u-1'], ['Member', 'u-2']]);
  });

  it('still writes who is on each team the old way, so going back a release finds it as it is now', async () => {
    const port = await db.workspaces.createTeam('Port');
    const old = async () => (await db.pool.query('select person, role from identity.workspace_members where workspace_id = $1 order by person', [port.id])).rows;
    await db.workspaces.setMember(port.id, 'u-1', 'member');
    const master = await db.workspaces.createPosition(port.id, 'Harbour master', 'lead');
    await db.workspaces.handOver(master.id, 'u-2');
    expect(await old()).toEqual([{ person: 'u-1', role: 'member' }, { person: 'u-2', role: 'lead' }]);
    await db.workspaces.handOver(master.id, 'u-1');
    expect(await old()).toEqual([{ person: 'u-1', role: 'lead' }]);
    await db.workspaces.updatePosition(master.id, { role: 'member' });
    expect(await old()).toEqual([{ person: 'u-1', role: 'member' }]);
    await db.workspaces.retirePosition(master.id);
    await db.workspaces.setMember(port.id, 'u-1', null);
    expect(await old()).toEqual([]);
  });

  it('forgets who a deleted person held, and keeps the positions, vacant', async () => {
    const port = await db.workspaces.createTeam('Port');
    const master = await db.workspaces.createPosition(port.id, 'Harbour master', 'lead');
    await db.workspaces.handOver(master.id, 'u-1');
    await db.workspaces.forgetPerson('u-1', 'Deleted person');
    expect((await db.pool.query("select 1 from identity.position_holders where person = 'u-1'")).rowCount).toBe(0);
    expect(await db.workspaces.positions({ workspace: port.id })).toEqual([{ id: master.id, workspace: port.id, role: 'lead', name: 'Harbour master' }]);
  });
});

describe('slugify', () => {
  it('makes a link word from a name', () => {
    expect(slugify('Finance & Ops')).toBe('finance-ops');
    expect(slugify('Économie')).toBe('economie');
    expect(slugify('***')).toBe('team');
  });
});

describe.runIf(DATABASE_URL)('departments as teams', () => {
  const setup = async () => {
    const signIn = new MemoryDirectory();
    const finance = await signIn.createDepartment('Finance');
    const payroll = await signIn.createDepartment('Payroll', finance.id);
    const alex = await signIn.createPerson({ username: 'alex', firstName: 'Alex', lastName: 'R', email: 'a@x.org', roles: [], departments: [payroll.id] }, 'pw');
    const store = db.workspaces;
    return { signIn, store, alex, teams: new TeamDirectory(signIn, store, () => {}) };
  };

  it('copies the sign-in directory’s departments in once, keeping the tree and members', async () => {
    const { signIn, teams, alex } = await setup();
    const [finance, payroll] = await teams.departments();
    expect(finance).toEqual({ id: expect.any(String), name: 'Finance', members: [] });
    expect(payroll).toEqual({ id: expect.any(String), name: 'Payroll', parentId: finance.id, members: [alex.id] });
    await signIn.createDepartment('Later');
    expect((await teams.departments()).map((d) => d.name)).toEqual(['Finance', 'Payroll']);
    expect((await teams.person(alex.id)).departments).toEqual([payroll.id]);
  });

  it('tries the copy again when the sign-in directory couldn’t be read', async () => {
    const { signIn, teams } = await setup();
    const departments = vi.spyOn(signIn, 'departments').mockRejectedValueOnce(new Error('down'));
    expect(await teams.departments()).toEqual([]);
    expect((await teams.departments()).map((d) => d.name)).toEqual(['Finance', 'Payroll']);
    expect(departments).toHaveBeenCalledTimes(2);
  });

  it('keeps membership in identity, not the sign-in directory', async () => {
    const { signIn, teams, alex } = await setup();
    const legal = await teams.createDepartment('Legal');
    await teams.updatePerson(alex.id, { departments: [legal.id], firstName: 'Al' });
    expect(await teams.person(alex.id)).toMatchObject({ firstName: 'Al', departments: [legal.id] });
    expect((await signIn.person(alex.id)).departments).toHaveLength(1);
    await expect(teams.addMember(legal.id, 'nobody')).rejects.toMatchObject({ status: 404 });
    await expect(teams.updatePerson(alex.id, { departments: ['gone'] })).rejects.toMatchObject({ status: 400 });
  });
});

describe.runIf(DATABASE_URL)('GET /v1/me/workspaces', () => {
  it('answers the caller’s floors, with departments copied in first', async () => {
    const signIn = new MemoryDirectory();
    const finance = await signIn.createDepartment('Finance');
    const alex = await signIn.createPerson({ username: 'alex', firstName: 'Alex', lastName: 'R', email: 'a@x.org', roles: [], departments: [finance.id] }, 'pw');
    const app = await db.app({ directory: signIn, workspaces: db.workspaces });
    const res = await app.inject({ method: 'GET', url: '/v1/me/workspaces', headers: callerHeaders({ id: alex.id, name: 'Alex', departments: [], roles: [] }) });
    expect(res.statusCode).toBe(200);
    expect(res.json().workspaces.map((f: { name: string; slug: string }) => `${f.name} @${f.slug}`)).toEqual(['You @me', 'Acme @org', 'Finance @finance']);
    expect((await app.inject({ method: 'GET', url: '/v1/me/workspaces' })).statusCode).toBe(401);
  });
});
