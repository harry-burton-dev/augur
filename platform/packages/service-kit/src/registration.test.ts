import { describe, expect, it, vi } from 'vitest';
import { registerApp, RegistrationError } from './registration.js';

const manifest = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.1.0' };
const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe('registerApp', () => {
  it('puts the manifest to the registry with the registration token', async () => {
    const fetchImpl = vi.fn(async () => reply(201));
    await registerApp({ registryUrl: 'http://registry:8082/', token: 's3cret', manifest, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('http://registry:8082/apps/library', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-registration-token': 's3cret' },
      body: JSON.stringify(manifest),
    });
  });

  it('retries while the registry is starting', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(reply(503))
      .mockResolvedValueOnce(reply(200));
    await registerApp({ registryUrl: 'http://r', token: 't', manifest, retryMs: 1, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('gives up at once when the registry refuses, saying why', async () => {
    const fetchImpl = vi.fn(async () => reply(409, { message: 'Home already lives at /.' }));
    await expect(registerApp({ registryUrl: 'http://r', token: 't', manifest, retryMs: 1, fetchImpl })).rejects.toThrow(
      new RegistrationError('Could not register library: the registry answered 409: Home already lives at /.'),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
