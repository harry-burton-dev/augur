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

  it('round-trips the floor a request is for', () => {
    const onFinance: Caller = { ...caller, workspace: { id: 'w1', kind: 'team', role: 'lead' } };
    expect(callerFromHeaders(callerHeaders(onFinance))).toEqual(onFinance);
    expect(callerFromHeaders({ ...callerHeaders(caller), 'x-workspace-id': 'w1', 'x-workspace-kind': 'cellar' })?.workspace).toBeUndefined();
  });

  it('reads no caller from a request without one', () => {
    expect(callerFromHeaders({ accept: 'application/json' })).toBeUndefined();
  });

  it('strips caller headers whatever their case', () => {
    expect(withoutCallerHeaders({ 'X-User-Id': 'me', 'x-user-roles': 'admin', 'X-Workspace-Id': 'w1', 'x-workspace-role': 'lead', accept: '*/*' })).toEqual({ accept: '*/*' });
  });
});
