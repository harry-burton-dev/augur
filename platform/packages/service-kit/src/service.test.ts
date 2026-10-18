import { describe, expect, it } from 'vitest';
import { serviceFromHeaders, serviceHeaders, withoutServiceHeaders } from './service.js';

describe('service credentials', () => {
  it('names the calling service when its token is right', () => {
    expect(serviceFromHeaders(serviceHeaders({ name: 'library', token: 't0ken' }), 't0ken')).toBe('library');
  });

  it('trusts no one with a wrong token, no token, or none configured', () => {
    expect(serviceFromHeaders(serviceHeaders({ name: 'library', token: 'guess' }), 't0ken')).toBeUndefined();
    expect(serviceFromHeaders({}, 't0ken')).toBeUndefined();
    expect(serviceFromHeaders(serviceHeaders({ name: 'library', token: '' }), undefined)).toBeUndefined();
    expect(serviceFromHeaders(serviceHeaders({ name: 'library', token: '' }), '')).toBeUndefined();
  });

  it('strips service headers whatever their case', () => {
    expect(withoutServiceHeaders({ 'X-Service-Token': 't', 'x-service-name': 'n', accept: '*/*' })).toEqual({ accept: '*/*' });
  });
});
