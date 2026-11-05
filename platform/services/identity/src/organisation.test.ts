import { describe, expect, it, vi } from 'vitest';
import { callerHeaders, type NewAuditEntry } from '@augur/service-kit';
import { DATABASE_URL, identityDb } from './db.testing.ts';

const db = identityDb({ orgName: 'Seeded Org' });

const admin = { id: 'u-admin', name: 'Ada Admin', departments: [], roles: ['admin'] };
const person = { id: 'u-1', name: 'Alex Rivera', departments: [], roles: [] };

const setup = async () => {
  const audit = vi.fn<(e: NewAuditEntry) => Promise<void>>(async () => undefined);
  const workspaces = db.workspaces;
  const app = await db.app({ audit, workspaces });
  const read = (who = person) => app.inject({ method: 'GET', url: '/v1/organisation', headers: callerHeaders(who) });
  const change = (body: unknown, who = admin) => app.inject({ method: 'PATCH', url: '/v1/admin/organisation', headers: callerHeaders(who), payload: body as object });
  return { app, audit, workspaces, read, change };
};

describe.runIf(DATABASE_URL)('organisation settings', () => {
  it('starts from the seeded name, UTC, and the name as the sender', async () => {
    const { read } = await setup();
    const res = await read();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ name: 'Seeded Org', timeZone: 'UTC', sender: { name: 'Seeded Org' } });
  });

  it('is only read by someone signed in or a service', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/v1/organisation' })).statusCode).toBe(401);
  });

  it('lets an admin change only what is sent, renames the floor, and audits before and after', async () => {
    const { change, read, audit, workspaces } = await setup();
    const res = await change({ name: 'Acme Ltd', timeZone: 'Europe/London' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Acme Ltd', timeZone: 'Europe/London', sender: { name: 'Acme Ltd' }, updatedBy: 'u-admin' });
    expect((await workspaces.org()).name).toBe('Acme Ltd');
    expect((await read()).json()).toMatchObject({ name: 'Acme Ltd', timeZone: 'Europe/London' });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0]).toMatchObject({
      action: 'organisation.changed',
      target: 'organisation',
      detail: { from: { name: 'Seeded Org', timeZone: 'UTC' }, to: { name: 'Acme Ltd', timeZone: 'Europe/London' } },
    });
  });

  it('sets and takes away the sender address', async () => {
    const { change, read } = await setup();
    expect((await change({ sender: { name: 'Acme', address: 'no-reply@acme.example' } })).statusCode).toBe(200);
    expect((await read()).json().sender).toEqual({ name: 'Acme', address: 'no-reply@acme.example' });
    await change({ sender: { name: 'Acme', address: null } });
    expect((await read()).json().sender).toEqual({ name: 'Acme' });
  });

  it('records nothing when nothing changes', async () => {
    const { change, audit } = await setup();
    expect((await change({ name: 'Seeded Org' })).statusCode).toBe(200);
    expect(audit).not.toHaveBeenCalled();
  });

  it('refuses an unknown time zone, a slash in the name, a two-line sender and a bad address', async () => {
    const { change } = await setup();
    expect((await change({ timeZone: 'Mars/Olympus' })).statusCode).toBe(400);
    expect((await change({ name: 'A/B' })).statusCode).toBe(400);
    expect((await change({ name: '   ' })).statusCode).toBe(400);
    expect((await change({ sender: { name: 'Acme\r\nBcc: x@y.z', address: null } })).statusCode).toBe(400);
    expect((await change({ sender: { name: 'Acme', address: 'not an address' } })).statusCode).toBe(400);
    expect((await change({})).statusCode).toBe(400);
    expect((await change({ colour: 'red' })).statusCode).toBe(400);
  });

  it('lets only an admin change them or list the time zones', async () => {
    const { change, app } = await setup();
    expect((await change({ name: 'Mine now' }, person)).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/v1/admin/organisation/time-zones', headers: callerHeaders(person) })).statusCode).toBe(403);
    const zones = await app.inject({ method: 'GET', url: '/v1/admin/organisation/time-zones', headers: callerHeaders(admin) });
    expect(zones.json()[0]).toBe('UTC');
    expect(zones.json()).toContain('Europe/London');
  });
});
