import { describe, expect, it, vi } from 'vitest';
import { callerHeaders, type NewAuditEntry } from '@platform/service-kit';
import { buildApp } from './app.ts';
import { MemoryDirectory } from './directory.ts';
import { temporaryPassword, usernameFrom } from './admin.ts';

const admin = callerHeaders({ id: 'admin-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });

const setup = async () => {
  const directory = new MemoryDirectory();
  const audit = vi.fn<(e: NewAuditEntry) => Promise<void>>(async () => undefined);
  const app = await buildApp({ directory, audit });
  const call = async (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object, headers = admin) =>
    app.inject({ method, url: `/v1/admin${url}`, headers, ...(payload ? { payload } : {}) });
  return { app, directory, audit, call };
};

describe('admin: people', () => {
  it('is for admins only', async () => {
    const { call } = await setup();
    expect((await call('GET', '/people', undefined, editor)).statusCode).toBe(403);
    expect((await call('GET', '/people')).statusCode).toBe(200);
  });

  it('says so when no directory is connected', async () => {
    const app = await buildApp();
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
    expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    const entry = audit.mock.calls.map(([e]) => e).find((e) => e.action === 'person.added')!;
    expect(entry).toMatchObject({ actor: { id: 'admin-1', kind: 'user' }, app: 'identity', target: person.id });
    expect(JSON.stringify(entry)).not.toContain(password);
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
    expect(res.json().temporaryPassword).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    expect(audit.mock.calls.map(([e]) => e.action)).toContain('person.password-reset');
    expect((await call('POST', '/people/nobody/password')).statusCode).toBe(404);
  });
});

describe('admin: departments', () => {
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

describe('helpers', () => {
  it('makes a username from an email', () => {
    expect(usernameFrom('Jo.Smith+news@example.org')).toBe('jo.smith');
    expect(usernameFrom('__@x.org')).toBe('person');
  });

  it('makes passwords without look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(temporaryPassword()).not.toMatch(/[01ilo]/);
  });
});
