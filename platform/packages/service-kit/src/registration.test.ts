import { describe, expect, it, vi } from 'vitest';
import { appSettings, registerApp } from './registration.js';
import { ServiceCallError } from './service.js';

const manifest = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.1.0', sdk: '^1.0.0' };
const credentials = { name: 'library', getToken: async () => 's3cret' };
const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe('registerApp', () => {
  it('puts the manifest to the registry as the calling service', async () => {
    const fetchImpl = vi.fn(async () => reply(201));
    await registerApp({ registryUrl: 'http://registry:8082/', credentials, manifest, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('http://registry:8082/v1/apps/library', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: 'Bearer s3cret' },
      body: JSON.stringify(manifest),
      signal: expect.any(AbortSignal),
    });
  });

  it('leaves registering to the app runner when it runs the app', async () => {
    const fetchImpl = vi.fn(async () => reply(201));
    expect(await registerApp({ registryUrl: 'http://r', credentials, manifest, fetchImpl, env: { APP_REGISTERED_BY: 'runner' } })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await registerApp({ registryUrl: 'http://r', credentials, manifest, fetchImpl, env: {} })).toBe(true);
  });

  it('retries while the registry is starting', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(reply(503))
      .mockResolvedValueOnce(reply(200));
    await registerApp({ registryUrl: 'http://r', credentials, manifest, retryMs: 1, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('gives up at once when the registry refuses, saying why', async () => {
    const fetchImpl = vi.fn(async () => reply(409, { message: 'Home already lives at /.' }));
    await expect(registerApp({ registryUrl: 'http://r', credentials, manifest, retryMs: 1, fetchImpl })).rejects.toThrow(
      new ServiceCallError('Could not register library with the registry: it answered 409: Home already lives at /.'),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('appSettings', () => {
  it('reads the app’s settings as itself, by id', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { settings: [{ id: 'retentionDays', label: 'Keep for', type: 'integer', min: 1, max: 365, default: 30, value: 90 }] }));
    expect(await appSettings({ registryUrl: 'http://registry:8082/', credentials, app: 'library', fetchImpl })).toEqual({ retentionDays: 90 });
    expect(fetchImpl).toHaveBeenCalledWith('http://registry:8082/v1/apps/library/settings', { headers: { authorization: 'Bearer s3cret' }, signal: expect.any(AbortSignal) });
  });

  it('says why when the registry can’t say', async () => {
    const refused = vi.fn(async () => reply(403, { message: 'Only an admin or the app itself can see its settings.' }));
    await expect(appSettings({ registryUrl: 'http://r', credentials, app: 'library', fetchImpl: refused })).rejects.toThrow(
      new ServiceCallError("Could not read library's settings from the registry: it answered 403: Only an admin or the app itself can see its settings."),
    );
    const down = vi.fn(async () => Promise.reject(new TypeError('fetch failed')));
    await expect(appSettings({ registryUrl: 'http://r', credentials, app: 'library', fetchImpl: down })).rejects.toThrow(/fetch failed/);
  });
});
