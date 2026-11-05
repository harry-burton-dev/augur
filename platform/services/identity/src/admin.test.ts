import { describe, expect, it, vi } from 'vitest';
import { callerHeaders, type NewAuditEntry } from '@augur/service-kit';
import { MemoryDirectory } from './directory.ts';
import { temporaryPassword, usernameFrom } from './admin.ts';
import { DATABASE_URL, identityDb } from './db.testing.ts';

const db = identityDb();

const admin = callerHeaders({ id: 'admin-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });

const setup = async () => {
  const directory = new MemoryDirectory();
  const audit = vi.fn<(e: NewAuditEntry) => Promise<void>>(async () => undefined);
  const store = db.store;
  const lifecycle = db.lifecycle;
  const app = await db.app({ directory, audit, store });
  const call = async (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object, headers = admin) =>
    app.inject({ method, url: `/v1/admin${url}`, headers, ...(payload ? { payload } : {}) });
  return { app, directory, audit, store, lifecycle, call };
};

describe.runIf(DATABASE_URL)('admin: deployment admins', () => {
  const deployer = callerHeaders({ id: 'admin-9', name: 'Harry', departments: [], roles: ['admin', 'deployment-admin'] });

  it('lets only a deployment admin make one, or change one’s role or sign-in', async () => {
    const { call } = await setup();
    const add = { firstName: 'Ops', lastName: 'Person', email: 'ops@example.org', roles: ['admin', 'deployment-admin'] };
    expect((await call('POST', '/people', add)).statusCode).toBe(403);
    const { person } = (await call('POST', '/people', add, deployer)).json();
    expect(person.roles).toContain('deployment-admin');
    expect((await call('PATCH', `/people/${person.id}`, { roles: ['admin'] })).statusCode).toBe(403);
    expect((await call('PATCH', `/people/${person.id}`, { enabled: false })).statusCode).toBe(403);
    expect((await call('PATCH', `/people/${person.id}`, { email: 'other@example.org' })).statusCode).toBe(403);
    expect((await call('POST', `/people/${person.id}/password`)).statusCode).toBe(403);
    expect((await call('PATCH', `/people/${person.id}`, { lastName: 'Lead', roles: ['deployment-admin', 'admin'] })).statusCode).toBe(200);
    expect((await call('POST', `/people/${person.id}/password`, undefined, deployer)).statusCode).toBe(200);
    expect((await call('PATCH', `/people/${person.id}`, { roles: ['admin'] }, deployer)).statusCode).toBe(200);
  });

  it('keeps an admin from giving the role to someone else', async () => {
    const { call } = await setup();
    const { person } = (await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org' })).json();
    expect((await call('PATCH', `/people/${person.id}`, { roles: ['deployment-admin'] })).statusCode).toBe(403);
    expect((await call('PATCH', `/people/${person.id}`, { enabled: false })).statusCode).toBe(200);
  });
});

describe.runIf(DATABASE_URL)('admin: turning off and leavers (ADR 0040)', () => {
  const add = async (call: Awaited<ReturnType<typeof setup>>['call'], first: string) =>
    (await call('POST', '/people', { firstName: first, lastName: 'Smith', email: `${first.toLowerCase()}@example.org` })).json().person as { id: string };
  const actions = (audit: Awaited<ReturnType<typeof setup>>['audit']) => audit.mock.calls.map(([e]) => [e.action, e.target, e.detail]);

  it('signs someone out everywhere when their sign-in is turned off, and again if asked again', async () => {
    const { call, directory } = await setup();
    const jo = await add(call, 'Jo');
    expect((await call('PATCH', `/people/${jo.id}`, { firstName: 'Joanne' })).statusCode).toBe(200);
    expect(directory.signedOut).toEqual([]);
    expect((await call('PATCH', `/people/${jo.id}`, { enabled: false })).statusCode).toBe(200);
    expect((await call('PATCH', `/people/${jo.id}`, { enabled: false })).statusCode).toBe(200);
    expect(directory.signedOut).toEqual([jo.id, jo.id]);
  });

  it('runs the leaver flow: off, signed out, handed over, the request closed, each step recorded', async () => {
    const { call, directory, audit, store } = await setup();
    const jo = await add(call, 'Jo');
    const sam = await add(call, 'Sam');
    await store.requestLeave(jo.id, 'Moving on in June');
    expect((await call('GET', '/leave-requests')).json()).toEqual([{ person: jo.id, requestedAt: expect.any(String), note: 'Moving on in June' }]);
    audit.mockClear();

    const res = await call('POST', `/people/${jo.id}/leave`, { handOverTo: sam.id, note: ' Agreed with their lead ' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: jo.id, enabled: false });
    expect(directory.signedOut).toEqual([jo.id]);
    expect(actions(audit)).toEqual([
      ['person.disabled', jo.id, { username: 'jo' }],
      ['person.left', jo.id, { username: 'jo', asked: true, handOverTo: sam.id, note: 'Agreed with their lead' }],
    ]);
    expect((await call('GET', '/leave-requests')).json()).toEqual([]);
  });

  it('shows where each account is in its life: invited, active, off and why, left for good', async () => {
    const { call, lifecycle } = await setup();
    const jo = await add(call, 'Jo');
    const sam = await add(call, 'Sam');
    const state = async (id: string) => (await call('GET', `/people/${id}`)).json();
    expect(await state(jo.id)).toMatchObject({ state: 'invited' });
    expect((await state(jo.id)).lastSignInAt).toBeUndefined();

    await lifecycle.signedIn(jo.id, '2026-11-05T09:00:00.000Z');
    await lifecycle.signedIn(jo.id, '2026-11-04T09:00:00.000Z');
    expect(await state(jo.id)).toMatchObject({ state: 'active', joinedAt: '2026-11-05T09:00:00.000Z', lastSignInAt: '2026-11-05T09:00:00.000Z' });

    await call('PATCH', `/people/${jo.id}`, { enabled: false });
    expect(await state(jo.id)).toMatchObject({ state: 'disabled', disabledCause: 'admin' });
    await call('PATCH', `/people/${jo.id}`, { enabled: true });
    expect((await state(jo.id)).disabledCause).toBeUndefined();

    expect((await call('POST', `/people/${jo.id}/leave`, { handOverTo: sam.id })).json()).toMatchObject({ state: 'left', left: { by: 'admin-1', handOverTo: sam.id } });
    const people = (await call('GET', '/people')).json() as { id: string; state: string }[];
    expect(people.find((p) => p.id === jo.id)?.state).toBe('left');
    expect(people.find((p) => p.id === sam.id)?.state).toBe('invited');

    // A leaver doesn't come back, and doesn't leave twice.
    expect((await call('PATCH', `/people/${jo.id}`, { enabled: true })).json().message).toMatch(/leaver doesn’t come back/);
    expect((await call('POST', `/people/${jo.id}/leave`, {})).statusCode).toBe(409);
    expect((await call('PATCH', `/people/${jo.id}`, { firstName: 'Joanne' })).statusCode).toBe(200);
  });

  it('runs it for someone already turned off, and without a hand-over', async () => {
    const { call, audit } = await setup();
    const jo = await add(call, 'Jo');
    await call('PATCH', `/people/${jo.id}`, { enabled: false });
    audit.mockClear();
    expect((await call('POST', `/people/${jo.id}/leave`, {})).statusCode).toBe(200);
    expect(actions(audit)).toEqual([['person.left', jo.id, { username: 'jo', asked: false }]]);
  });

  it('hands over only to someone else who can sign in', async () => {
    const { call, audit } = await setup();
    const jo = await add(call, 'Jo');
    const sam = await add(call, 'Sam');
    await call('PATCH', `/people/${sam.id}`, { enabled: false });
    audit.mockClear();
    const refusal = async (body: object) => (await call('POST', `/people/${jo.id}/leave`, body)).json().message as string;
    expect(await refusal({ handOverTo: jo.id })).toMatch(/someone else/);
    expect(await refusal({ handOverTo: sam.id })).toMatch(/Sam Smith’s sign-in is off/);
    expect(await refusal({ handOverTo: 'nobody' })).toMatch(/isn’t in the directory/);
    // Nothing happened to the leaver while the hand-over was wrong.
    expect(audit).not.toHaveBeenCalled();
    expect((await call('GET', `/people/${jo.id}`)).json().enabled).toBe(true);
  });

  it('keeps an admin off themselves, and a deployment admin for deployment admins', async () => {
    const { call } = await setup();
    expect((await call('POST', '/people/admin-1/leave', {})).statusCode).toBe(409);
    const deployer = callerHeaders({ id: 'admin-9', name: 'Harry', departments: [], roles: ['admin', 'deployment-admin'] });
    const { person } = (await call('POST', '/people', { firstName: 'Ops', lastName: 'Person', email: 'ops@example.org', roles: ['deployment-admin'] }, deployer)).json();
    expect((await call('POST', `/people/${person.id}/leave`, {})).statusCode).toBe(403);
    expect((await call('POST', `/people/${person.id}/leave`, {}, deployer)).statusCode).toBe(200);
    expect((await call('POST', '/people/nobody/leave', {})).statusCode).toBe(404);
  });

  it('is for admins only', async () => {
    const { call } = await setup();
    expect((await call('GET', '/leave-requests', undefined, editor)).statusCode).toBe(403);
    expect((await call('POST', '/people/x/leave', {}, editor)).statusCode).toBe(403);
  });
});

describe.runIf(DATABASE_URL)('admin: invites (ADR 0040)', () => {
  const jo = { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org' };
  const actions = (audit: Awaited<ReturnType<typeof setup>>['audit']) => audit.mock.calls.map(([e]) => [e.action, e.target, e.detail?.method]);

  it('invites by email when email works, with a link for 72 hours and no password', async () => {
    const { call, directory, audit } = await setup();
    directory.emailWorks = true;
    expect((await call('GET', '/lifecycle')).json()).toMatchObject({ email: true, lastDayAhead: 90 });
    const res = await call('POST', '/people', jo);
    expect(res.statusCode).toBe(201);
    const { person, invite, temporaryPassword } = res.json();
    expect(temporaryPassword).toBeUndefined();
    expect(invite).toMatchObject({ method: 'email', sentTo: 'jo@example.org' });
    expect(Date.parse(invite.expiresAt) - Date.now()).toBeGreaterThan(71 * 3_600_000);
    expect(directory.invitesSent).toEqual([{ id: person.id, lifespanSeconds: 72 * 3600 }]);
    expect(person).toMatchObject({ state: 'invited', invite: { method: 'email', count: 1, expired: false } });
    expect(actions(audit)).toEqual([['person.added', person.id, 'email']]);

    // Resend: a new link, recorded, counted.
    const again = await call('POST', `/people/${person.id}/invite`);
    expect(again.statusCode).toBe(200);
    expect(directory.invitesSent).toHaveLength(2);
    expect((await call('GET', `/people/${person.id}`)).json()).toMatchObject({ state: 'invited', invite: { method: 'email', count: 2 } });
    expect(actions(audit).at(-1)).toEqual(['person.invite-resent', person.id, undefined]);
  });

  it('gives a one-time password when email isn’t set up, and refuses an invite it can’t send', async () => {
    const { call, directory } = await setup();
    expect((await call('GET', '/lifecycle')).json()).toMatchObject({ email: false });
    const refused = await call('POST', '/people', { ...jo, start: 'email' });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().message).toMatch(/Email isn’t set up/);
    const res = (await call('POST', '/people', jo)).json();
    expect(res).toMatchObject({ invite: { method: 'temporary-password' }, temporaryPassword: expect.any(String) });
    expect(res.person.invite).toMatchObject({ method: 'temporary-password', count: 0 });
    expect((await call('POST', `/people/${res.person.id}/invite`)).statusCode).toBe(503);
    expect(directory.invitesSent).toEqual([]);
  });

  it('says so when the account is made but the email can’t go', async () => {
    const { call, directory } = await setup();
    directory.emailWorks = true;
    directory.sendInvite = async () => {
      throw new Error('The sign-in service couldn’t send the invite email.');
    };
    const res = await call('POST', '/people', jo);
    expect(res.statusCode).toBe(201);
    expect(res.json().invite).toEqual({ method: 'email', error: 'The sign-in service couldn’t send the invite email.' });
    expect(res.json().person.invite).toMatchObject({ method: 'email', count: 0 });
  });

  it('won’t resend to someone who has set up or left', async () => {
    const { call, directory, lifecycle } = await setup();
    directory.emailWorks = true;
    const { person } = (await call('POST', '/people', jo)).json();
    await lifecycle.signedIn(person.id, new Date().toISOString());
    expect((await call('POST', `/people/${person.id}/invite`)).json().message).toMatch(/already set up/);
    const { person: sam } = (await call('POST', '/people', { firstName: 'Sam', lastName: 'Okafor', email: 'sam@example.org' })).json();
    await call('POST', `/people/${sam.id}/leave`, {});
    expect((await call('POST', `/people/${sam.id}/invite`)).statusCode).toBe(409);
  });
});

describe.runIf(DATABASE_URL)('admin: people', () => {
  it('is for admins only', async () => {
    const { call } = await setup();
    expect((await call('GET', '/people', undefined, editor)).statusCode).toBe(403);
    expect((await call('GET', '/people')).statusCode).toBe(200);
  });

  it('says so when no directory is connected', async () => {
    const app = await db.app();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/people', headers: admin });
    expect(res.statusCode).toBe(503);
  });

  it('adds someone with a one-time password, audited without the password', async () => {
    const { call, audit } = await setup();
    const dept = (await call('POST', '/departments', { name: 'Finance' })).json();
    const res = await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'Jo.Smith@example.org', roles: ['editor'], departments: [dept.id] });
    expect(res.statusCode).toBe(201);
    const { person, temporaryPassword: password } = res.json();
    expect(person).toMatchObject({ username: 'jo.smith', enabled: true, invited: true, roles: ['editor'], departments: [dept.id] });
    expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    const entry = audit.mock.calls.map(([e]) => e).find((e) => e.action === 'person.added')!;
    expect(entry).toMatchObject({ actor: { id: 'admin-1', kind: 'user' }, app: 'identity', target: person.id });
    expect(JSON.stringify(entry)).not.toContain(password);
    // Joining a department on the way in is recorded on it, as the membership routes do.
    expect(audit.mock.calls).toContainEqual([expect.objectContaining({ action: 'department.member-added', target: dept.id, detail: { person: person.id } }), dept.id]);
  });

  it('refuses what it can’t use', async () => {
    const { call } = await setup();
    expect((await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'not-an-email' })).statusCode).toBe(400);
    expect((await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', roles: ['owner'] })).statusCode).toBe(400);
    expect((await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', password: 'x' })).statusCode).toBe(400);
    await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org' });
    const again = await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org' });
    expect(again.statusCode).toBe(409);
    expect(again.json().message).toMatch(/already/);
  });

  it('changes roles, department and sign-in, auditing each kind of change', async () => {
    const { call, audit } = await setup();
    const legal = (await call('POST', '/departments', { name: 'Legal' })).json();
    const { person } = (await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org' })).json();
    const updated = await call('PATCH', `/people/${person.id}`, { roles: ['admin', 'editor'], departments: [legal.id] });
    expect(updated.json()).toMatchObject({ roles: ['admin', 'editor'], departments: [legal.id] });
    const off = await call('PATCH', `/people/${person.id}`, { enabled: false });
    expect(off.json().enabled).toBe(false);
    const actions = audit.mock.calls.map(([e]) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['person.updated', 'person.disabled']));
    const update = audit.mock.calls.map(([e]) => e).find((e) => e.action === 'person.updated')!;
    expect(update.detail).toMatchObject({ roles: { from: [], to: ['admin', 'editor'] } });
  });

  it('records each department someone joins or leaves when their list changes, on that department', async () => {
    const { call, audit } = await setup();
    const legal = (await call('POST', '/departments', { name: 'Legal' })).json();
    const finance = (await call('POST', '/departments', { name: 'Finance' })).json();
    const { person } = (await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', departments: [legal.id] })).json();
    audit.mockClear();
    await call('PATCH', `/people/${person.id}`, { departments: [finance.id] });
    const moves = audit.mock.calls.filter(([e]) => e.action.startsWith('department.member-')).map(([e, floor]) => [e.action, e.target, e.detail, floor]);
    expect(moves).toEqual([
      ['department.member-added', finance.id, { person: person.id }, finance.id],
      ['department.member-removed', legal.id, { person: person.id }, legal.id],
    ]);
    audit.mockClear();
    await call('PATCH', `/people/${person.id}`, { firstName: 'Joanne' });
    expect(audit.mock.calls.map(([e]) => e.action)).toEqual(['person.updated']);
  });

  it('won’t let an admin lock themselves out', async () => {
    const { call, directory } = await setup();
    const { person } = (await call('POST', '/people', { firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', roles: ['admin'] })).json();
    const self = callerHeaders({ id: person.id, name: 'Alex', departments: [], roles: ['admin'] });
    expect((await call('PATCH', `/people/${person.id}`, { enabled: false }, self)).statusCode).toBe(409);
    expect((await call('PATCH', `/people/${person.id}`, { roles: ['editor'] }, self)).statusCode).toBe(409);
    expect((await directory.person(person.id)).roles).toEqual(['admin']);
  });

  it('resets a password to a new one-time one', async () => {
    const { call, audit } = await setup();
    const { person } = (await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org' })).json();
    const res = await call('POST', `/people/${person.id}/password`);
    expect(res.json().temporaryPassword).toMatch(/^\w{4}-\w{4}-\w{4}-\w{4}$/);
    expect(audit.mock.calls.map(([e]) => e.action)).toContain('person.password-reset');
    expect((await call('POST', '/people/nobody/password')).statusCode).toBe(404);
  });
});

describe.runIf(DATABASE_URL)('admin: departments', () => {
  it('creates, renames and refuses a name already taken', async () => {
    const { call, audit } = await setup();
    const finance = (await call('POST', '/departments', { name: 'Finance' })).json();
    await call('POST', '/departments', { name: 'Legal' });
    expect((await call('POST', '/departments', { name: 'finance' })).statusCode).toBe(409);
    expect((await call('PATCH', `/departments/${finance.id}`, { name: 'Legal' })).statusCode).toBe(409);
    expect((await call('PATCH', `/departments/${finance.id}`, { name: 'Money' })).json()).toMatchObject({ name: 'Money' });
    expect((await call('POST', '/departments', { name: 'A/B' })).statusCode).toBe(400);
    expect(audit.mock.calls.map(([e]) => e)).toContainEqual(expect.objectContaining({ action: 'department.renamed', detail: { from: 'Finance', to: 'Money' } }));
  });

  it('puts a department inside another, where the same name can be used again', async () => {
    const { call } = await setup();
    const finance = (await call('POST', '/departments', { name: 'Finance' })).json();
    const payroll = await call('POST', '/departments', { name: 'Payroll', parentId: finance.id });
    expect(payroll.json()).toMatchObject({ name: 'Payroll', parentId: finance.id });
    expect((await call('POST', '/departments', { name: 'Payroll' })).statusCode).toBe(201);
    expect((await call('POST', '/departments', { name: 'payroll', parentId: finance.id })).statusCode).toBe(409);
    expect((await call('POST', '/departments', { name: 'X', parentId: 'gone' })).statusCode).toBe(400);
  });

  it('adds and removes members', async () => {
    const { call } = await setup();
    const dept = (await call('POST', '/departments', { name: 'Finance' })).json();
    const { person } = (await call('POST', '/people', { firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org' })).json();
    expect((await call('PUT', `/departments/${dept.id}/members/${person.id}`)).statusCode).toBe(204);
    expect((await call('GET', '/departments')).json()[0].members).toEqual([person.id]);
    expect((await call('DELETE', `/departments/${dept.id}/members/${person.id}`)).statusCode).toBe(204);
    expect((await call('GET', '/departments')).json()[0].members).toEqual([]);
  });
});

describe.runIf(DATABASE_URL)('admin: levels', () => {
  it('names each level of department, audited, for admins only', async () => {
    const { call, audit } = await setup();
    expect((await call('GET', '/levels')).json()).toEqual({ levels: ['Department', 'Team'], max: 5 });
    expect((await call('GET', '/levels', undefined, editor)).statusCode).toBe(403);
    expect((await call('PUT', '/levels', { levels: ['Division', 'Crew'] })).json()).toEqual({ levels: ['Division', 'Crew'], max: 5 });
    expect((await call('GET', '/levels')).json().levels).toEqual(['Division', 'Crew']);
    expect(audit.mock.calls.map(([e]) => e)).toContainEqual(expect.objectContaining({ action: 'levels.renamed', detail: { from: ['Department', 'Team'], to: ['Division', 'Crew'] } }));
    expect((await call('PUT', '/levels', { levels: [] })).statusCode).toBe(400);
    expect((await call('PUT', '/levels', { levels: ['A', 'B', 'C', 'D', 'E', 'F'] })).statusCode).toBe(400);
    expect((await call('PUT', '/levels', { levels: ['Crew', 'crew'] })).json().message).toMatch(/both be called/);
  });
});

describe('helpers', () => {
  it('makes a username from an email', () => {
    expect(usernameFrom('Jo.Smith+news@example.org')).toBe('jo.smith');
    expect(usernameFrom('__@x.org')).toBe('person');
  });

  it('makes passwords without look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(temporaryPassword()).not.toMatch(/[01ilo]/);
  });
});

describe.runIf(DATABASE_URL)('admin: locked, leaving and idle (ADR 0040)', () => {
  const add = async (call: Awaited<ReturnType<typeof setup>>['call'], email = 'kim@example.org') =>
    (await call('POST', '/people', { firstName: 'Kim', lastName: 'Lee', email })).json().person as { id: string };

  it('shows a lockout and lets an admin lift it', async () => {
    const { call, directory, audit, lifecycle } = await setup();
    const kim = await add(call);
    await lifecycle.signedIn(kim.id, new Date(Date.now() - 3_600_000).toISOString());
    expect((await call('POST', `/people/${kim.id}/unlock`)).statusCode).toBe(409);
    await lifecycle.locked(kim.id, new Date(Date.now() - 60_000).toISOString());
    directory.lockedOut.add(kim.id);
    expect((await call('GET', '/people')).json().find((p: { id: string }) => p.id === kim.id)).toMatchObject({ state: 'active', locked: true });
    expect((await call('GET', `/people/${kim.id}`)).json()).toMatchObject({ locked: true, lockout: { locked: true, failures: 10 } });
    expect((await call('POST', `/people/${kim.id}/unlock`)).statusCode).toBe(204);
    expect(audit.mock.calls.at(-1)![0]).toMatchObject({ action: 'person.unlocked', target: kim.id });
    const after = (await call('GET', `/people/${kim.id}`)).json();
    expect(after.locked).toBeUndefined();
    expect(after.lockout).toMatchObject({ locked: false });
  });

  it('sets the leaver flow for after a last day, moves it, cancels it, and refuses days out of range', async () => {
    const { call, audit } = await setup();
    const kim = await add(call);
    const { today } = (await call('GET', '/lifecycle')).json();
    const later = new Date(Date.parse(`${today}T00:00:00Z`) + 10 * 86_400_000).toISOString().slice(0, 10);
    const res = await call('POST', `/people/${kim.id}/leave`, { lastDay: later, note: 'Moving on' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ enabled: true, leaving: { on: later } });
    expect(audit.mock.calls.at(-1)![0]).toMatchObject({ action: 'person.leave-scheduled', detail: { lastDay: later } });
    expect((await call('POST', `/people/${kim.id}/leave`, { lastDay: '2000-01-01' })).statusCode).toBe(400);
    expect((await call('POST', `/people/${kim.id}/leave`, { lastDay: '2999-01-01' })).statusCode).toBe(400);
    expect((await call('DELETE', `/people/${kim.id}/leave`)).statusCode).toBe(200);
    expect((await call('GET', `/people/${kim.id}`)).json().leaving).toBeUndefined();
    expect(audit.mock.calls.at(-1)![0]).toMatchObject({ action: 'person.leave-cancelled' });
    expect((await call('DELETE', `/people/${kim.id}/leave`)).statusCode).toBe(409);
  });

  it('says when an idle sign-in turns off, or why it won’t', async () => {
    const { call, directory, lifecycle } = await setup();
    const kim = await add(call);
    const at = '2026-10-01T09:00:00.000Z';
    await lifecycle.signedIn(kim.id, at);
    expect((await call('GET', `/people/${kim.id}`)).json().idle).toEqual({ exempt: 'no-email' });
    directory.emailWorks = true;
    expect((await call('GET', `/people/${kim.id}`)).json().idle).toMatchObject({ warnsAt: '2026-11-30T09:00:00.000Z', turnsOffAt: '2026-12-30T09:00:00.000Z' });
    const never = await add(call, 'nev@example.org');
    expect((await call('GET', `/people/${never.id}`)).json().idle).toBeUndefined();
  });
});
