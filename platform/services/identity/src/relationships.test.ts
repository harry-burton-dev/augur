import { describe, expect, it } from 'vitest';
import { MemoryDirectory } from './directory.ts';
import { DATABASE_URL, identityDb } from './db.testing.ts';

const db = identityDb({ orgName: 'Acme' });

const verifyService = async (headers: Record<string, string | string[] | undefined>) =>
  headers.authorization === 'Bearer permissions' ? ({ kind: 'platform', name: 'permissions' } as const) : headers.authorization === 'Bearer app' ? ({ kind: 'app', app: 'library' } as const) : undefined;

describe.runIf(DATABASE_URL)('GET /v1/relationships', () => {
  it('gives the permissions service the floors, positions and holders, and who is in the org', async () => {
    const directory = new MemoryDirectory();
    const jo = await directory.createPerson({ username: 'jo', firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', roles: ['admin', 'publisher'], departments: [] });
    const kim = await directory.createPerson({ username: 'kim', firstName: 'Kim', lastName: 'Lee', email: 'kim@example.org', roles: ['admin', 'deployment-admin'], departments: [] });
    await directory.updatePerson(kim.id, { enabled: false });
    const org = await db.workspaces.org();
    const port = await db.workspaces.createTeam('Port');
    const berths = await db.workspaces.createTeam('Berths', port.id);
    const gone = await db.workspaces.createTeam('Gone');
    const master = await db.workspaces.createPosition(port.id, 'Harbour master', 'lead');
    const planner = await db.workspaces.createPosition(berths.id, 'Berth planner', 'member');
    await db.workspaces.createPosition(gone.id, 'Nobody', 'member');
    await db.workspaces.handOver(master.id, jo.id);
    const own = await db.workspaces.personal(jo.id, 'Jo Smith');
    await db.pool.query('update identity.workspaces set archived_at = now() where id = $1', [gone.id]);

    const app = await db.app({ directory, verifyService });
    const ask = (token?: string) => app.inject({ method: 'GET', url: '/v1/relationships', headers: token ? { authorization: `Bearer ${token}` } : {} });
    expect((await ask()).statusCode).toBe(403);
    expect((await ask('app')).statusCode).toBe(403);
    const res = await ask('permissions');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      org: org.id,
      teams: [
        { id: port.id, parent: org.id },
        { id: berths.id, parent: port.id },
      ],
      personal: [{ id: own.id, owner: jo.id }],
      positions: [
        { id: master.id, team: port.id, role: 'lead', holder: jo.id },
        { id: planner.id, team: berths.id, role: 'member' },
      ],
      people: [jo.id],
      // Kim's sign-in is off, so her roles aren't copied either.
      roles: { admin: [jo.id], 'deployment-admin': [], publisher: [jo.id] },
    });
  });
});
