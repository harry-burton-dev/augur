import { describe, expect, it } from 'vitest';
import { callerHeaders, GrantsUnavailable } from '@augur/service-kit';
import { MemoryDirectory } from './directory.ts';
import { principalsOf } from './people.ts';
import { DATABASE_URL, identityDb } from './db.testing.ts';

const db = identityDb();

const verifyService = async (headers: Record<string, string | string[] | undefined>) =>
  ({ 'Bearer registry': { kind: 'platform', name: 'registry' } as const, 'Bearer folio': { kind: 'app', app: 'folio' } as const, 'Bearer other': { kind: 'app', app: 'other' } as const })[
    String(headers.authorization)
  ];

const setUp = async (grants = async (app: string) => (app === 'folio' ? (['people:read'] as const) : ([] as const))) => {
  const directory = new MemoryDirectory();
  const workspaces = db.workspaces;
  const org = await workspaces.org();
  const finance = await workspaces.createTeam('Finance');
  const payroll = await workspaces.createTeam('Payroll', finance.id);
  const legal = await workspaces.createTeam('Legal');
  const alex = await directory.createPerson({ username: 'alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', roles: [], departments: [] });
  const sam = await directory.createPerson({ username: 'sam', firstName: 'Sam', lastName: 'Okafor', email: 'sam@example.org', roles: ['deployment-admin'], departments: [] });
  const gone = await directory.createPerson({ username: 'gone', firstName: 'Ola', lastName: 'Gone', email: 'ola@example.org', roles: [], departments: [] });
  await directory.updatePerson(gone.id, { enabled: false });
  const app = await db.app({ workspaces, directory, verifyService, grants });
  await workspaces.setMember(payroll.id, alex.id, 'member');
  await workspaces.setMember(legal.id, alex.id, 'lead');
  return { app, org, finance, payroll, legal, alex, sam };
};

describe.runIf(DATABASE_URL)('people for apps', () => {
  it('works out who someone stands for', () => {
    const teams = [
      { id: 'f', kind: 'team', name: 'Finance', slug: 'finance', path: ['o', 'f'] },
      { id: 'p', kind: 'team', name: 'Payroll', slug: 'payroll', path: ['o', 'f', 'p'] },
    ] as const;
    expect(principalsOf('u-1', [...teams], ['p', 'archived'])).toEqual(['person:u-1', 'team:p', 'tree:f', 'tree:p', 'org']);
    expect(principalsOf('u-2', [...teams], [])).toEqual(['person:u-2', 'org']);
  });

  it('tells an app with people:read who a person stands for', async () => {
    const { app, alex, finance, payroll, legal } = await setUp();
    const principals = (id: string, authorization?: string) => app.inject({ method: 'GET', url: `/v1/people/${id}/principals`, headers: authorization ? { authorization } : {} });
    const res = await principals(alex.id, 'Bearer folio');
    expect(res.statusCode).toBe(200);
    expect(res.json().principals.sort()).toEqual(['org', `person:${alex.id}`, `team:${legal.id}`, `team:${payroll.id}`, `tree:${finance.id}`, `tree:${legal.id}`, `tree:${payroll.id}`].sort());
    expect((await principals('nobody', 'Bearer registry')).json().principals).toEqual(['person:nobody', 'org']);
    expect((await principals(alex.id, 'Bearer other')).statusCode).toBe(403);
    expect((await principals(alex.id)).statusCode).toBe(403);
  });

  it('finds people and teams by name, and names them by id', async () => {
    const { app, alex, sam, finance, payroll } = await setUp();
    const find = (query: string) => app.inject({ method: 'GET', url: `/v1/directory?${query}`, headers: { authorization: 'Bearer folio' } });
    expect((await find('q=riv')).json()).toEqual({ people: [{ id: alex.id, name: 'Alex Rivera', email: 'alex@example.org' }], teams: [] });
    expect((await find('q=sam%40')).json().people.map((p: { id: string }) => p.id)).toEqual([sam.id]);
    // A turned-off sign-in can't be shared with.
    expect((await find('q=ola')).json().people).toEqual([]);
    expect((await find('q=pay')).json().teams).toEqual([{ id: payroll.id, name: 'Payroll', within: ['Finance'], path: [finance.id, payroll.id] }]);
    const named = (await find(`ids=${sam.id},${finance.id},nope`)).json();
    expect(named.people.map((p: { id: string }) => p.id)).toEqual([sam.id]);
    expect(named.teams).toEqual([{ id: finance.id, name: 'Finance', within: [], path: [finance.id] }]);
    expect((await find('q=a&limit=1')).json().people).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/v1/directory?q=a', headers: { authorization: 'Bearer other' } })).statusCode).toBe(403);
  });

  it('lets a signed-in person find people and teams to share with', async () => {
    const { app, alex, sam, finance, payroll, legal } = await setUp();
    const me = callerHeaders({ id: sam.id, name: 'Sam Okafor', departments: [], roles: [] });
    const find = (query: string, headers: Record<string, string> = me) => app.inject({ method: 'GET', url: `/v1/me/directory?${query}`, headers });
    expect((await find('q=RIVÉ')).json()).toEqual({ people: [{ id: alex.id, name: 'Alex Rivera', email: 'alex@example.org' }], teams: [] });
    // Sam is on no team, yet finds them all by name, as on their map; a turned-off sign-in isn't listed.
    expect((await find('q=a')).json().teams.map((t: { id: string }) => t.id)).toEqual([finance.id, legal.id, payroll.id]);
    expect((await find('q=ola')).json().people).toEqual([]);
    expect((await find(`ids=${alex.id},${payroll.id}`)).json()).toEqual({
      people: [{ id: alex.id, name: 'Alex Rivera', email: 'alex@example.org' }],
      teams: [{ id: payroll.id, name: 'Payroll', within: ['Finance'], path: [finance.id, payroll.id] }],
    });
    expect((await find('q=a&limit=99')).statusCode).toBe(400);
    expect((await find('q=a', {})).statusCode).toBe(401);
  });

  it('says who an audience reaches', async () => {
    const { app, alex, sam, finance, payroll, legal } = await setUp();
    const members = (principals: string, authorization = 'Bearer folio') =>
      app.inject({ method: 'GET', url: `/v1/members?principals=${encodeURIComponent(principals)}`, headers: { authorization } });
    expect((await members(`tree:${finance.id}`)).json().people).toEqual([alex.id]);
    expect((await members(`team:${finance.id}`)).json().people).toEqual([]);
    expect((await members(`team:${legal.id},team:${payroll.id}`)).json().people).toEqual([alex.id]);
    // Everyone whose sign-in works, and no one who's been turned off.
    expect((await members('org')).json().people).toEqual([alex.id, sam.id].sort());
    expect((await members(`person:${sam.id},person:nobody`)).json().people).toEqual([sam.id]);
    expect((await members('org', 'Bearer other')).statusCode).toBe(403);
  });

  it('reaches people by role for the platform only', async () => {
    const { app, sam } = await setUp();
    const members = (principals: string, authorization: string) =>
      app.inject({ method: 'GET', url: `/v1/members?principals=${encodeURIComponent(principals)}`, headers: { authorization } });
    expect((await members('role:deployment-admin', 'Bearer registry')).json().people).toEqual([sam.id]);
    expect((await members('role:nobody-holds-this', 'Bearer registry')).json().people).toEqual([]);
    // An app tells people it knows, not every admin.
    expect((await members('role:deployment-admin', 'Bearer folio')).statusCode).toBe(403);
  });

  it('refuses an app while its grants can’t be checked', async () => {
    const { app, alex } = await setUp(async () => {
      throw new GrantsUnavailable('down');
    });
    expect((await app.inject({ method: 'GET', url: `/v1/people/${alex.id}/principals`, headers: { authorization: 'Bearer folio' } })).statusCode).toBe(503);
    // The platform's own services don't need the registry.
    expect((await app.inject({ method: 'GET', url: `/v1/people/${alex.id}/principals`, headers: { authorization: 'Bearer registry' } })).statusCode).toBe(200);
  });
});
