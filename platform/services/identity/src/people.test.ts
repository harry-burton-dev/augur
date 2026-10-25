import { describe, expect, it } from 'vitest';
import { GrantsUnavailable } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { MemoryDirectory } from './directory.ts';
import { principalsOf } from './people.ts';
import { MemoryWorkspaceStore } from './workspaces.ts';

const verifyService = async (headers: Record<string, string | string[] | undefined>) =>
  ({ 'Bearer registry': { kind: 'platform', name: 'registry' } as const, 'Bearer folio': { kind: 'app', app: 'folio' } as const, 'Bearer other': { kind: 'app', app: 'other' } as const })[
    String(headers.authorization)
  ];

const setUp = async (grants = async (app: string) => (app === 'folio' ? (['people:read'] as const) : ([] as const))) => {
  const directory = new MemoryDirectory();
  const workspaces = new MemoryWorkspaceStore();
  const org = await workspaces.org();
  const finance = await workspaces.createTeam('Finance');
  const payroll = await workspaces.createTeam('Payroll', finance.id);
  const legal = await workspaces.createTeam('Legal');
  const alex = await directory.createPerson({ username: 'alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', roles: [], departments: [] });
  const sam = await directory.createPerson({ username: 'sam', firstName: 'Sam', lastName: 'Okafor', email: 'sam@example.org', roles: [], departments: [] });
  const gone = await directory.createPerson({ username: 'gone', firstName: 'Ola', lastName: 'Gone', email: 'ola@example.org', roles: [], departments: [] });
  await directory.updatePerson(gone.id, { enabled: false });
  const app = await buildApp({ workspaces, directory, verifyService, grants });
  await workspaces.setMember(payroll.id, alex.id, 'member');
  await workspaces.setMember(legal.id, alex.id, 'lead');
  return { app, org, finance, payroll, legal, alex, sam };
};

describe('people for apps', () => {
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
    expect((await find('q=pay')).json().teams).toEqual([{ id: payroll.id, name: 'Payroll', within: ['Finance'] }]);
    const named = (await find(`ids=${sam.id},${finance.id},nope`)).json();
    expect(named.people.map((p: { id: string }) => p.id)).toEqual([sam.id]);
    expect(named.teams).toEqual([{ id: finance.id, name: 'Finance', within: [] }]);
    expect((await find('q=a&limit=1')).json().people).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/v1/directory?q=a', headers: { authorization: 'Bearer other' } })).statusCode).toBe(403);
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
