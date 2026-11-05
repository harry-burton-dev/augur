import { describe, expect, it, vi } from 'vitest';
import { callerHeaders, type NewAuditEntry } from '@augur/service-kit';
import { DATABASE_URL, identityDb } from './db.testing.ts';
import { MemoryDirectory } from './directory.ts';
import { noticeHtml, readPng } from './organisation.ts';

const db = identityDb({ orgName: 'Seeded Org' });

const admin = { id: 'u-admin', name: 'Ada Admin', departments: [], roles: ['admin'] };
const deploymentAdmin = (signedInAt = new Date().toISOString()) => ({ id: 'u-dep', name: 'Dee Deploy', departments: [], roles: ['admin', 'deployment-admin'], signedInAt });

/** A PNG's first bytes: its signature and the IHDR chunk with this width and height. */
const png = (width: number, height: number, extra = 0) => {
  const b = Buffer.alloc(33 + extra);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
};
const person = { id: 'u-1', name: 'Alex Rivera', departments: [], roles: [] };

const setup = async () => {
  const audit = vi.fn<(e: NewAuditEntry) => Promise<void>>(async () => undefined);
  const workspaces = db.workspaces;
  const directory = new MemoryDirectory();
  const app = await db.app({ audit, workspaces, directory, languages: ['en', 'fr'] });
  const read = (who = person) => app.inject({ method: 'GET', url: '/v1/organisation', headers: callerHeaders(who) });
  const change = (body: unknown, who = admin) => app.inject({ method: 'PATCH', url: '/v1/admin/organisation', headers: callerHeaders(who), payload: body as object });
  return { app, audit, workspaces, read, change, directory };
};

describe.runIf(DATABASE_URL)('organisation settings', () => {
  it('starts from the seeded name, UTC, and the name as the sender', async () => {
    const { read } = await setup();
    const res = await read();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      name: 'Seeded Org',
      timeZone: 'UTC',
      sender: { name: 'Seeded Org' },
      idle: { on: true, warningDays: 60, turnOffDays: 90 },
      notice: { on: false, version: 0 },
      languages: ['en', 'fr'],
      defaultLanguage: 'en',
      security: { twoStepForAll: false, leaverRetentionDays: 90, activityRetentionDays: 365 },
    });
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

  it('keeps the idle-account days an admin chooses, and only what they send', async () => {
    const { change, read, audit } = await setup();
    expect((await change({ idle: { turnOffDays: 120 } })).statusCode).toBe(200);
    expect((await read()).json().idle).toEqual({ on: true, warningDays: 60, turnOffDays: 120 });
    await change({ idle: { on: false } });
    expect((await read()).json().idle).toEqual({ on: false, warningDays: 60, turnOffDays: 120 });
    expect(audit.mock.calls[0][0].detail).toEqual({ from: { idle: { on: true, warningDays: 60, turnOffDays: 90 } }, to: { idle: { on: true, warningDays: 60, turnOffDays: 120 } } });
  });

  it('keeps the warning at least a week before the turn-off', async () => {
    const { change } = await setup();
    const res = await change({ idle: { warningDays: 85 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/at least 7 days after the warning/);
    expect((await change({ idle: { warningDays: 3 } })).statusCode).toBe(400);
    expect((await change({ idle: { turnOffDays: 1000 } })).statusCode).toBe(400);
    expect((await change({ idle: { warningDays: 83 } })).statusCode).toBe(200);
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

  it('keeps a PNG logo, serves it to anyone, and audits it by its hash', async () => {
    const { app, read, audit } = await setup();
    const put = (body: Buffer, who = admin) => app.inject({ method: 'PUT', url: '/v1/admin/organisation/logo', headers: { ...callerHeaders(who), 'content-type': 'image/png' }, payload: body });
    expect((await app.inject({ method: 'GET', url: '/v1/public/organisation/logo' })).statusCode).toBe(404);
    expect((await put(png(600, 200), person)).statusCode).toBe(403);
    const res = await put(png(600, 200));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ width: 600, height: 200, url: expect.stringMatching(/^\/api\/identity\/v1\/public\/organisation\/logo\?v=[0-9a-f]{12}$/) });
    expect((await read()).json().logo).toEqual(res.json());
    const got = await app.inject({ method: 'GET', url: '/v1/public/organisation/logo' });
    expect(got.statusCode).toBe(200);
    expect(got.headers).toMatchObject({ 'content-type': 'image/png', 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=300' });
    expect(got.rawPayload.equals(png(600, 200))).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/v1/public/organisation/logo', headers: { 'if-none-match': got.headers.etag as string } })).statusCode).toBe(304);
    expect(audit.mock.calls[0][0]).toMatchObject({ action: 'organisation.changed', detail: { from: { logo: null }, to: { logo: res.json().sha256 } } });
    expect((await app.inject({ method: 'DELETE', url: '/v1/admin/organisation/logo', headers: callerHeaders(admin) })).statusCode).toBe(204);
    expect((await read()).json().logo).toBeUndefined();
    expect((await app.inject({ method: 'GET', url: '/v1/public/organisation/logo' })).statusCode).toBe(404);
  });

  it('refuses a logo that isn’t a PNG of a size sign-in pages can show', async () => {
    const { app } = await setup();
    const put = (body: Buffer) => app.inject({ method: 'PUT', url: '/v1/admin/organisation/logo', headers: { ...callerHeaders(admin), 'content-type': 'image/png' }, payload: body });
    expect((await put(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(30).fill(0)]))).json().message).toMatch(/JPEG/);
    expect((await put(png(2000, 200))).statusCode).toBe(400);
    expect((await put(png(200, 10))).statusCode).toBe(400);
    expect((await put(png(200, 100, 300 * 1024))).statusCode).toBe(413);
  });

  it('turns the sign-in notice on only with a title and text, and keeps the words out of Activity', async () => {
    const { change, read, audit } = await setup();
    expect((await change({ notice: { on: true } })).statusCode).toBe(400);
    const res = await change({ notice: { on: true, title: 'Before you start', text: 'Be kind.\n\nKeep secrets.' } });
    expect(res.statusCode).toBe(200);
    expect((await read()).json().notice).toMatchObject({ on: true, title: 'Before you start', text: 'Be kind.\n\nKeep secrets.', version: 0, changedBy: 'u-admin' });
    expect(JSON.stringify(audit.mock.calls[0][0].detail)).not.toContain('Keep secrets');
    expect(audit.mock.calls[0][0].detail.to.notice).toEqual({ on: true, title: 'Before you start', version: 0, textLength: 23 });
  });

  it('asks everyone to accept the notice again, and says how many', async () => {
    const { change, directory, audit, read } = await setup();
    await directory.createPerson({ username: 'alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', roles: [], departments: [] });
    expect((await change({ notice: { askAgain: true } })).statusCode).toBe(400);
    const res = await change({ notice: { on: true, title: 'Notice', text: 'Read me.', askAgain: true } });
    expect(res.statusCode).toBe(200);
    expect((await read()).json().notice.version).toBe(1);
    expect(directory.asked.size).toBeGreaterThan(0);
    expect([...directory.asked.values()].every((a) => a.has('TERMS_AND_CONDITIONS'))).toBe(true);
    expect(audit.mock.calls.at(-1)![0]).toMatchObject({ action: 'organisation.notice-asked', detail: { version: 1, people: directory.asked.size } });
  });

  it('offers the languages an admin chooses, with a default among them', async () => {
    const { change, read } = await setup();
    expect((await change({ languages: ['en', 'xx'] })).statusCode).toBe(400);
    expect((await change({ defaultLanguage: 'de' })).statusCode).toBe(400);
    expect((await change({ languages: ['en', 'de'], defaultLanguage: 'de' })).statusCode).toBe(200);
    expect((await read()).json()).toMatchObject({ languages: ['en', 'de'], defaultLanguage: 'de' });
    // Taking the default away falls back to the first one offered.
    await change({ languages: ['fr', 'en'] });
    expect((await read()).json()).toMatchObject({ languages: ['fr', 'en'], defaultLanguage: 'fr' });
  });

  it('lets only a deployment admin who just entered their password change security and retention', async () => {
    const { change, read } = await setup();
    const security = { security: { twoStepForAll: true, leaverRetentionDays: 30 } };
    expect((await change(security)).statusCode).toBe(403);
    const stale = await change(security, deploymentAdmin(new Date(Date.now() - 11 * 60_000).toISOString()));
    expect(stale.statusCode).toBe(401);
    expect(stale.json().error).toBe('sign_in_again');
    expect((await change(security, deploymentAdmin())).statusCode).toBe(200);
    expect((await read()).json().security).toEqual({ twoStepForAll: true, leaverRetentionDays: 30, activityRetentionDays: 365 });
    expect((await change({ security: { activityRetentionDays: 30 } }, deploymentAdmin())).statusCode).toBe(400);
  });

  it('tells AUGUR’s own services the retention policy, and nobody else', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/v1/organisation/policy', headers: callerHeaders(admin) })).statusCode).toBe(403);
  });
});

describe('the logo and the notice, as sign-in pages get them', () => {
  it('reads a PNG’s size from its header, and names what else it is', () => {
    expect(readPng(png(300, 64))).toEqual({ width: 300, height: 64 });
    expect(readPng(Buffer.from('GIF89a and more bytes to pass 24'))).toEqual({ refused: expect.stringMatching(/isn’t a PNG/) });
    expect(readPng(png(300, 64).subarray(0, 20))).toEqual({ refused: expect.stringMatching(/isn’t a PNG/) });
  });

  it('escapes the notice and makes a paragraph of each block', () => {
    expect(noticeHtml('Hello <b>you</b>\r\n\r\nLine one\nline two')).toBe('<p>Hello &lt;b&gt;you&lt;/b&gt;</p><p>Line one<br>line two</p>');
  });
});
