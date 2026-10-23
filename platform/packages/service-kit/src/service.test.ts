import { describe, expect, it, vi } from 'vitest';
import { identifyService, serviceFromHeaders, serviceHeaders, withoutServiceHeaders } from './service.js';

describe('service credentials', () => {
  it('names the calling service when its token is right', async () => {
    expect(serviceFromHeaders(await serviceHeaders({ name: 'library', token: 't0ken' }), 't0ken')).toBe('library');
  });

  it('trusts no one with a wrong token, no token, or none configured', async () => {
    expect(serviceFromHeaders(await serviceHeaders({ name: 'library', token: 'guess' }), 't0ken')).toBeUndefined();
    expect(serviceFromHeaders({}, 't0ken')).toBeUndefined();
    expect(serviceFromHeaders(await serviceHeaders({ name: 'library', token: '' }), undefined)).toBeUndefined();
    expect(serviceFromHeaders(await serviceHeaders({ name: 'library', token: '' }), '')).toBeUndefined();
  });

  it('sends its own sign-in as a bearer token instead of the shared token', async () => {
    expect(await serviceHeaders({ name: 'library', getToken: async () => 'jwt' })).toEqual({ authorization: 'Bearer jwt' });
  });

  it('counts the shared token as a platform service, and otherwise asks the verifier', async () => {
    const verify = vi.fn(async () => ({ kind: 'app' as const, app: 'library' }));
    expect(await identifyService({ 'x-service-token': 't0ken', 'x-service-name': 'registry' }, { token: 't0ken', verify })).toEqual({ kind: 'platform', name: 'registry' });
    expect(verify).not.toHaveBeenCalled();
    expect(await identifyService({ authorization: 'Bearer jwt' }, { token: 't0ken', verify })).toEqual({ kind: 'app', app: 'library' });
    expect(await identifyService({ authorization: 'Bearer jwt' }, {})).toBeUndefined();
  });

  it('strips service headers whatever their case', () => {
    expect(withoutServiceHeaders({ 'X-Service-Token': 't', 'x-service-name': 'n', accept: '*/*' })).toEqual({ accept: '*/*' });
  });
});
