import { describe, expect, it } from 'vitest';
import { callerFromHeaders, callerHeaders, withoutCallerHeaders, type Caller } from './caller.js';

const caller: Caller = {
  id: 'f3a1',
  name: 'Zoë Brontë-Smith',
  email: 'zoe@example.org',
  departments: ['Finance', 'Research, Policy'],
  roles: ['admin', 'editor'],
};

describe('caller headers', () => {
  it('round-trips a caller, any characters included', () => {
    expect(callerFromHeaders(callerHeaders(caller))).toEqual(caller);
  });

  it('reads no caller from a request without one', () => {
    expect(callerFromHeaders({ accept: 'application/json' })).toBeUndefined();
  });

  it('strips caller headers whatever their case', () => {
    expect(withoutCallerHeaders({ 'X-User-Id': 'me', 'x-user-roles': 'admin', accept: '*/*' })).toEqual({ accept: '*/*' });
  });
});
