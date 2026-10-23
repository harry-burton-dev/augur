import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { MemoryDirectory } from './directory.ts';
import { PgPreferenceStore } from './store.ts';
import { TeamDirectory } from './teams.ts';
import { floorsFor, MemoryWorkspaceStore, PgWorkspaceStore, slugify, type WorkspaceStore } from './workspaces.ts';

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
    // Being on Finance doesn't put you on Payroll.
    await store.setMember(finance.id, 'u-2', 'member');
    expect((await floorsFor(store, { id: 'u-2', name: 'Sam' })).map((f) => f.name)).toEqual(['You', 'Acme', 'Finance']);
    expect(floors.some((f) => f.id === legal.id)).toBe(false);
  });
};

describe('MemoryWorkspaceStore', () => behavesLikeAWorkspaceStore(() => new MemoryWorkspaceStore({ orgName: 'Acme' })));

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('PgWorkspaceStore', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query('drop schema if exists identity cascade');
    await new PgPreferenceStore(pool).migrate();
  });
  afterAll(() => pool.end());

  behavesLikeAWorkspaceStore(
    () => new PgWorkspaceStore(pool, { orgName: 'Acme' }),
    async () => void (await pool.query('truncate identity.workspace_members, identity.imports, identity.workspaces')),
  );

  it('takes slugs safely when teams are added at once', async () => {
    const store = new PgWorkspaceStore(pool, { orgName: 'Acme' });
    const parent = await store.createTeam('Ops');
    const made = await Promise.all(['A', 'a!', 'A.', 'a?'].map((n) => store.createTeam(n, parent.id)));
    expect(new Set(made.map((t) => t.slug)).size).toBe(4);
  });
});

describe('slugify', () => {
  it('makes a link word from a name', () => {
    expect(slugify('Finance & Ops')).toBe('finance-ops');
    expect(slugify('Économie')).toBe('economie');
    expect(slugify('***')).toBe('team');
  });
});

describe('departments as teams', () => {
  const setup = async () => {
    const signIn = new MemoryDirectory();
    const finance = await signIn.createDepartment('Finance');
    const payroll = await signIn.createDepartment('Payroll', finance.id);
    const alex = await signIn.createPerson({ username: 'alex', firstName: 'Alex', lastName: 'R', email: 'a@x.org', roles: [], departments: [payroll.id] }, 'pw');
    const store = new MemoryWorkspaceStore({ orgName: 'Acme' });
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

describe('GET /v1/me/workspaces', () => {
  it('answers the caller’s floors, with departments copied in first', async () => {
    const signIn = new MemoryDirectory();
    const finance = await signIn.createDepartment('Finance');
    const alex = await signIn.createPerson({ username: 'alex', firstName: 'Alex', lastName: 'R', email: 'a@x.org', roles: [], departments: [finance.id] }, 'pw');
    const app = await buildApp({ directory: signIn, workspaces: new MemoryWorkspaceStore({ orgName: 'Acme' }) });
    const res = await app.inject({ method: 'GET', url: '/v1/me/workspaces', headers: callerHeaders({ id: alex.id, name: 'Alex', departments: [], roles: [] }) });
    expect(res.statusCode).toBe(200);
    expect(res.json().workspaces.map((f: { name: string; slug: string }) => `${f.name} @${f.slug}`)).toEqual(['You @me', 'Acme @org', 'Finance @finance']);
    expect((await app.inject({ method: 'GET', url: '/v1/me/workspaces' })).statusCode).toBe(401);
  });
});
