import { describe, expect, it, vi } from 'vitest';
import { identifyService, serviceHeaders } from './service.js';

describe('service credentials', () => {
  it('sends its own sign-in as a bearer token', async () => {
    expect(await serviceHeaders({ name: 'library', getToken: async () => 'jwt' })).toEqual({ authorization: 'Bearer jwt' });
  });

  it('asks the verifier who is calling, and trusts no one without one', async () => {
    const verify = vi.fn(async () => ({ kind: 'app' as const, app: 'library' }));
    expect(await identifyService({ authorization: 'Bearer jwt' }, verify)).toEqual({ kind: 'app', app: 'library' });
    expect(await identifyService({ authorization: 'Bearer jwt' }, undefined)).toBeUndefined();
  });
});
