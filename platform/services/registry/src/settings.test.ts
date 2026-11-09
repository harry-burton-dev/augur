import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { DATABASE_URL, registryDb } from './db.testing.ts';
import { exampleManifest, releaseOf } from './release3.testing.ts';
import { missingMessage, missingRequired, settingValueProblem, type DeclaredSetting } from './settings.ts';

const db = registryDb();

const retention: DeclaredSetting = { id: 'retentionDays', label: 'Keep archived notes for', type: 'number', unit: 'days', min: 7, max: 3650, default: 365 };
const theme: DeclaredSetting = { id: 'theme', label: 'Note colour', type: 'enum', options: ['plain', 'warm', 'cool'], default: 'plain' };
const archiveKey: DeclaredSetting = { id: 'archiveKey', label: 'Archive service key', type: 'secret', required: true };

describe('a value for a setting', () => {
  it('refuses a number outside its bounds, saying them', () => {
    expect(settingValueProblem(retention, 30)).toBeUndefined();
    expect(settingValueProblem(retention, 3)).toBe('Keep archived notes for is from 7 to 3650 days: 3 is outside that.');
    expect(settingValueProblem(retention, 4000)).toMatch(/from 7 to 3650 days/);
    expect(settingValueProblem(retention, '30')).toMatch(/is a number/);
  });

  it('takes only one of an enum’s options, a boolean as true or false, and a secret as text', () => {
    expect(settingValueProblem(theme, 'warm')).toBeUndefined();
    expect(settingValueProblem(theme, 'hot')).toBe('Note colour is one of plain, warm, cool.');
    expect(settingValueProblem({ id: 'a', label: 'Sharing', type: 'boolean', default: false }, 'yes')).toMatch(/on or off/);
    expect(settingValueProblem(archiveKey, '')).toMatch(/give its value/);
  });

  it('names each required setting an app can’t start without', () => {
    const missing = missingRequired([retention, archiveKey], () => false);
    expect(missing.map((s) => s.id)).toEqual(['archiveKey']);
    expect(missingMessage('Notes', missing)).toBe('Notes needs Archive service key before it can start. A deployment admin fills it in under Admin → Apps.');
  });
});

const fresh = (at = new Date()) => callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'], signedInAt: at.toISOString() });
const stale = () => fresh(new Date(Date.now() - 11 * 60_000));
const runner = { authorization: 'Bearer platform-updater' };
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer platform-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? { kind: 'platform' as const, name: m[1] } : null;
};

/** The example app with a required secret beside its own settings. */
const withKey = (version = '1.2.0') => {
  const m = exampleManifest();
  return releaseOf('notes', version, { contributes: { ...m.contributes, settings: [...m.contributes.settings, archiveKey] } });
};

describe.runIf(DATABASE_URL)('an app’s settings, as Admin gives them (spec 5.2 to 5.5)', () => {
  const setup = async () => {
    const entries: { action: string; target?: string; detail?: Record<string, unknown> }[] = [];
    const server = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
    const ask = (payload: object, headers = fresh()) => server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers, payload });
    const finish = async (id: string) => {
      await server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner });
      await server.inject({ method: 'POST', url: `/v1/app-runner/jobs/${id}/progress`, headers: runner, payload: { step: 'switch', state: 'done', outcome: 'done' } });
    };
    const set = (setting: string, value: unknown, headers = fresh()) => server.inject({ method: 'PUT', url: `/v1/app-runner/apps/notes/settings/${setting}`, headers, payload: { value } });
    const view = async () => (await server.inject({ method: 'GET', url: '/v1/app-runner/apps', headers: fresh() })).json().installed.find((i: { app: string }) => i.app === 'notes');
    const said = async () => (await server.inject({ method: 'GET', url: '/v1/runner/settings', headers: runner })).json();
    return { server, entries, ask, finish, set, view, said };
  };

  it('refuses an install without a required value, and takes one given with it', async () => {
    const { ask, finish, view, said } = await setup();
    const without = await ask({ action: 'install', release: withKey() });
    expect(without.statusCode).toBe(400);
    expect(without.json().message).toBe('Notes needs Archive service key before it can start. A deployment admin fills it in under Admin → Apps.');
    expect((await ask({ action: 'install', release: withKey(), settings: { archiveKey: 'k-1', retentionDays: 2 } })).json().message).toMatch(/from 7 to 3650 days/);
    expect((await ask({ action: 'install', release: withKey(), settings: { archiveKey: 'k-1', nothing: 1 } })).json().message).toMatch(/has no setting nothing/);
    const job = (await ask({ action: 'install', release: withKey(), settings: { archiveKey: 'k-1', retentionDays: 30 } })).json();
    await finish(job.id);
    expect((await said()).apps.notes).toEqual({ archiveKey: 'k-1', retentionDays: '30' });
    const settings = (await view()).settings;
    expect(settings.find((s: { id: string }) => s.id === 'retentionDays')).toMatchObject({ type: 'number', min: 7, max: 3650, unit: 'days', default: 365, set: true, value: 30 });
    expect(settings.find((s: { id: string }) => s.id === 'theme')).toMatchObject({ type: 'enum', options: ['plain', 'warm', 'cool'], set: false });
  });

  it('keeps a secret, never gives it back, and changes it only for a new value', async () => {
    const { ask, finish, set, view, said, entries } = await setup();
    await finish((await ask({ action: 'install', release: withKey(), settings: { archiveKey: 'k-1' } })).json().id);
    const key = async () => (await view()).settings.find((s: { id: string }) => s.id === 'archiveKey');
    expect(await key()).toMatchObject({ type: 'secret', required: true, set: true, setBy: 'u-1' });
    expect(await key()).not.toHaveProperty('value');
    expect(JSON.stringify(await view())).not.toContain('k-1');
    // A secret needs the password entered just now; going back to nothing isn't possible for a required one.
    expect((await set('archiveKey', 'k-2', stale())).json()).toMatchObject({ error: 'sign_in_again' });
    expect((await set('archiveKey', null)).statusCode).toBe(409);
    expect((await said()).apps.notes.archiveKey).toBe('k-1');
    expect((await set('archiveKey', 'k-2')).statusCode).toBe(200);
    expect((await said()).apps.notes.archiveKey).toBe('k-2');
    // The audit names the setting, never the secret.
    expect(entries.filter((e) => e.action === 'app.setting-set').map((e) => e.detail)).toEqual([{ setting: 'archiveKey' }]);
    expect(JSON.stringify(entries)).not.toContain('k-2');
  });

  it('sets the others to their own type, and back to the default with null', async () => {
    const { ask, finish, set, said, entries } = await setup();
    await finish((await ask({ action: 'install', release: withKey(), settings: { archiveKey: 'k-1' } })).json().id);
    expect((await set('retentionDays', 5000)).json().message).toBe('Keep archived notes for is from 7 to 3650 days: 5000 is outside that.');
    expect((await set('theme', 'hot')).statusCode).toBe(400);
    expect((await set('allowSharing', true, stale())).statusCode).toBe(200);
    expect((await set('theme', 'warm')).statusCode).toBe(200);
    expect((await said()).apps.notes).toMatchObject({ allowSharing: 'true', theme: 'warm' });
    expect((await set('theme', null)).statusCode).toBe(200);
    expect((await said()).apps.notes).not.toHaveProperty('theme');
    expect(entries.filter((e) => e.action === 'app.setting-set').map((e) => e.detail)).toEqual([
      { setting: 'allowSharing', value: true },
      { setting: 'theme', value: 'warm' },
      { setting: 'theme', cleared: true },
    ]);
    expect((await set('nothing', 1)).statusCode).toBe(404);
    expect((await set('theme', 'warm', callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['admin'] }))).statusCode).toBe(403);
  });

  it('keeps a value 30 days after the release it runs stops declaring it, then forgets it', async () => {
    const { ask, finish, set, said } = await setup();
    await finish((await ask({ action: 'install', release: withKey(), settings: { archiveKey: 'k-1' } })).json().id);
    await set('theme', 'warm');
    const m = exampleManifest();
    const without = releaseOf('notes', '1.3.0', { contributes: { ...m.contributes, settings: [archiveKey] } });
    await finish((await ask({ action: 'install', release: without })).json().id);
    expect((await said()).apps.notes.theme).toBe('warm');
    await db.pool.query(`update registry.app_setting_values set removed_at = now() - interval '31 days' where setting = 'theme'`);
    expect((await said()).apps.notes).toEqual({ archiveKey: 'k-1' });
  });

  it('gives the values to the runner alone', async () => {
    const { server } = await setup();
    expect((await server.inject({ method: 'GET', url: '/v1/runner/settings', headers: { authorization: 'Bearer platform-gateway' } })).statusCode).toBe(403);
  });
});
