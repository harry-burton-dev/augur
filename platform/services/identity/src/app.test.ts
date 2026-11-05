import { describe, expect, it } from 'vitest';
import { callerCheckFor, callerHeaders, callerSigner, signedCallerHeaders } from '@augur/service-kit';
import { DATABASE_URL, identityDb } from './db.testing.ts';

const db = identityDb();

describe.runIf(DATABASE_URL)('identity', () => {
  it('reports healthy', async () => {
    const app = await db.app();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'identity', version: expect.stringMatching(/^\d+\.\d+\.\d+/), api: 'v1' });
  });

  it('says who the caller is', async () => {
    const app = await db.app();
    const caller = { id: 'u-1', name: 'Alex Rivera', departments: ['Finance'], roles: ['admin'] };
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: callerHeaders(caller) });
    expect(res.json()).toEqual(caller);
  });

  it('believes only the caller the gateway signed, once it checks callers', async () => {
    const gateway = callerSigner();
    const app = await db.app({ callers: callerCheckFor(gateway, 'identity') });
    const caller = { id: 'u-1', name: 'Alex Rivera', departments: ['Finance'], roles: ['admin'] };
    // Anyone on the network could send these; without the gateway's signature they name nobody.
    expect((await app.inject({ remoteAddress: '172.18.0.9', method: 'GET', url: '/v1/me', headers: callerHeaders(caller) })).statusCode).toBe(401);
    const signed = await app.inject({ remoteAddress: '172.18.0.9', method: 'GET', url: '/v1/me', headers: await signedCallerHeaders(gateway, caller, 'identity') });
    expect(signed.json()).toEqual(caller);
    // One signed for an app can't be replayed here.
    expect((await app.inject({ remoteAddress: '172.18.0.9', method: 'GET', url: '/v1/me', headers: await signedCallerHeaders(gateway, caller, 'folio') })).statusCode).toBe(401);
  });

  it('turns away a request that reached it without a caller', async () => {
    const app = await db.app();
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
  });

  it('keeps each person’s preferences, refusing what it does not know', async () => {
    const app = await db.app();
    const alex = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: [] });
    const sam = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: [] });
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences', headers: alex })).json()).toEqual({});
    const prefs = { reduceMotion: true, density: 'compact', areaTitles: false, away: false, recent: ['board', 'home'], muted: ['board'] };
    expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: alex, payload: prefs })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences', headers: alex })).json()).toEqual(prefs);
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences', headers: sam })).json()).toEqual({});
    expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: alex, payload: { theme: 'pink' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: alex, payload: { density: 'tiny' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: alex, payload: { muted: ['board', 'board'] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences' })).statusCode).toBe(401);
  });

  describe('floors', () => {
    const verifyService = async (headers: Record<string, string | string[] | undefined>) =>
      headers.authorization === 'Bearer registry' ? ({ kind: 'platform', name: 'registry' } as const) : headers.authorization === 'Bearer app' ? ({ kind: 'app', app: 'library' } as const) : undefined;
    const tree = async () => {
      const workspaces = db.workspaces;
      const org = await workspaces.org();
      const finance = await workspaces.createTeam('Finance');
      const payroll = await workspaces.createTeam('Payroll', finance.id);
      const legal = await workspaces.createTeam('Legal');
      await workspaces.setMember(payroll.id, 'u-1', 'member');
      await workspaces.setMember(legal.id, 'u-2', 'member');
      const own = await workspaces.personal('u-1', 'Alex');
      return { workspaces, org, finance, payroll, legal, own, app: await db.app({ workspaces, verifyService }) };
    };

    it('tells the platform’s services where a floor sits, and no one else', async () => {
      const { app, org, finance, payroll, own } = await tree();
      const look = (id: string, authorization?: string) => app.inject({ method: 'GET', url: `/v1/workspaces/${id}`, headers: authorization ? { authorization } : {} });
      expect((await look(payroll.id, 'Bearer registry')).json()).toEqual({ id: payroll.id, kind: 'team', path: [org.id, finance.id, payroll.id], org: org.id });
      expect((await look(own.id, 'Bearer registry')).json()).toEqual({ id: own.id, kind: 'personal', path: [own.id], org: org.id });
      expect((await look('nope', 'Bearer registry')).statusCode).toBe(404);
      expect((await look('org', 'Bearer registry')).json()).toEqual({ id: org.id, kind: 'org', path: [org.id], org: org.id });
      expect((await look(payroll.id, 'Bearer app')).statusCode).toBe(403);
      expect((await look(payroll.id)).statusCode).toBe(403);
    });

    it('tells the platform’s services who can stand on a team', async () => {
      const { app, finance, payroll, legal } = await tree();
      const people = (id: string, authorization = 'Bearer registry') => app.inject({ method: 'GET', url: `/v1/workspaces/${id}/people`, headers: { authorization } });
      expect((await people(finance.id)).json()).toEqual({ workspace: finance.id, people: ['u-1'] });
      expect((await people(payroll.id)).json().people).toEqual(['u-1']);
      expect((await people(legal.id)).json().people).toEqual(['u-2']);
      expect((await people('nope')).statusCode).toBe(404);
      expect((await people(legal.id, 'Bearer app')).statusCode).toBe(403);
    });

    it('rolls up a floor to the teams below it that the caller is on', async () => {
      const { app, org, finance, payroll, legal } = await tree();
      const alex = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: [] });
      const rollup = async (id: string) => app.inject({ method: 'GET', url: `/v1/me/workspaces/${id}/rollup`, headers: alex });
      expect((await rollup(finance.id)).json().workspaces.map((w: { id: string }) => w.id)).toEqual([finance.id, payroll.id]);
      expect((await rollup(org.id)).json().workspaces.map((w: { id: string }) => w.id)).toEqual([org.id, finance.id, payroll.id]);
      expect((await rollup(legal.id)).statusCode).toBe(404);
    });
  });
});
