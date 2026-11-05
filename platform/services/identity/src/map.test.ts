import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { DATABASE_URL, identityDb } from './db.testing.ts';

const db = identityDb({ orgName: 'Acme' });

/** Acme: Finance (Payroll, Treasury) and Legal. Alex is on Payroll, Sam leads Payroll, Priya leads Finance, Lee is on Legal. */
const acme = async () => {
  const workspaces = db.workspaces;
  const finance = await workspaces.createTeam('Finance');
  const payroll = await workspaces.createTeam('Payroll', finance.id);
  const treasury = await workspaces.createTeam('Treasury', finance.id);
  const legal = await workspaces.createTeam('Legal');
  await workspaces.setMember(payroll.id, 'alex', 'member');
  await workspaces.setMember(payroll.id, 'sam', 'lead');
  await workspaces.setMember(finance.id, 'priya', 'lead');
  await workspaces.setMember(treasury.id, 'tom', 'member');
  await workspaces.setMember(legal.id, 'lee', 'lead');
  const app = await db.app({ workspaces });
  return { app, finance, payroll, treasury, legal };
};
const as = (id: string, roles: string[] = []) => callerHeaders({ id, name: id, departments: [], roles });

describe.runIf(DATABASE_URL)('your map', () => {
  it('opens the floors you stand on, saying why, and shows every other team as a closed door', async () => {
    const { app, finance, payroll, treasury, legal } = await acme();
    const map = (await app.inject({ method: 'GET', url: '/v1/me/map', headers: as('alex') })).json();
    expect(map.floors.map((f: { name: string }) => f.name)).toEqual(['Acme', 'Finance', 'Payroll', 'You']);
    const [org, fin, pay, own] = map.floors;
    expect(org).toMatchObject({ kind: 'org', depth: 0, why: { kind: 'org' } });
    expect(fin).toMatchObject({ id: finance.id, depth: 1, open: true, why: { kind: 'inside', via: { id: payroll.id, name: 'Payroll' } }, people: 4 });
    expect(pay).toMatchObject({ id: payroll.id, parentId: finance.id, depth: 2, why: { kind: 'member', role: 'member' }, people: 2, leads: [{ id: 'sam' }] });
    expect(pay.members).toEqual([{ id: 'sam', name: 'sam', role: 'lead' }, { id: 'alex', name: 'alex', role: 'member' }]);
    expect(own).toMatchObject({ kind: 'personal', name: 'You', why: { kind: 'own' }, people: 1 });
    // Closed doors carry a name, a place and who can let you in, and nothing about who's inside.
    expect(map.closed).toEqual([
      { id: treasury.id, name: 'Treasury', parentId: finance.id, depth: 2, leads: [] },
      { id: legal.id, name: 'Legal', parentId: expect.any(String), depth: 1, leads: [{ id: 'lee', name: 'lee' }] },
    ]);
    expect(JSON.stringify(map.closed)).not.toContain('tom');
    expect(map.principals).toEqual(['person:alex', `team:${payroll.id}`, ...[finance.id, payroll.id].sort().map((id) => `tree:${id}`), 'org']);
  });

  it('lets a lead see into the teams inside theirs, without standing on them', async () => {
    const { app, payroll, treasury, finance } = await acme();
    const map = (await app.inject({ method: 'GET', url: '/v1/me/map', headers: as('priya') })).json();
    const byName = Object.fromEntries(map.floors.map((f: { name: string }) => [f.name, f]));
    expect(byName.Finance).toMatchObject({ open: true, why: { kind: 'member', role: 'lead' } });
    expect(byName.Payroll).toMatchObject({ id: payroll.id, open: false, why: { kind: 'leads-above', team: { id: finance.id, name: 'Finance' } } });
    expect(byName.Treasury.members).toEqual([{ id: 'tom', name: 'tom', role: 'member' }]);
    expect(map.closed.map((t: { id: string }) => t.id)).not.toContain(treasury.id);
    expect(map.closed.map((t: { name: string }) => t.name)).toEqual(['Legal']);
  });

  it('lets an admin see into every team, still standing only on their own', async () => {
    const { app } = await acme();
    const map = (await app.inject({ method: 'GET', url: '/v1/me/map', headers: as('ada', ['admin']) })).json();
    expect(map.closed).toEqual([]);
    expect(map.floors.filter((f: { open: boolean }) => !f.open).map((f: { name: string }) => f.name)).toEqual(['Finance', 'Payroll', 'Treasury', 'Legal']);
    expect(map.floors.find((f: { name: string }) => f.name === 'Legal').why).toEqual({ kind: 'admin' });
  });

  it('needs a caller', async () => {
    const { app } = await acme();
    expect((await app.inject({ method: 'GET', url: '/v1/me/map' })).statusCode).toBe(401);
  });
});
