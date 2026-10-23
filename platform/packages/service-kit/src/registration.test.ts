import { describe, expect, it, vi } from 'vitest';
import { registerApp } from './registration.js';
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
    });
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
