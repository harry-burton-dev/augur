import { describe, expect, it } from 'vitest';
import { callerFromHeaders, callerHeaders, signedInRecently, withoutCallerHeaders, type Caller } from './caller.js';

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

  it('carries when they last entered their password, so a service can ask for a fresh sign-in', () => {
    const fresh: Caller = { ...caller, signedInAt: '2026-10-30T09:00:00.000Z' };
    expect(callerFromHeaders(callerHeaders(fresh))).toEqual(fresh);
    expect(signedInRecently(fresh, 5 * 60_000, Date.parse('2026-10-30T09:04:00Z'))).toBe(true);
    expect(signedInRecently(fresh, 5 * 60_000, Date.parse('2026-10-30T09:06:00Z'))).toBe(false);
    expect(signedInRecently(caller, 5 * 60_000)).toBe(false);
    expect(withoutCallerHeaders({ 'x-user-signed-in-at': fresh.signedInAt, accept: '*/*' })).toEqual({ accept: '*/*' });
  });

  it('reads no caller from a request without one', () => {
    expect(callerFromHeaders({ accept: 'application/json' })).toBeUndefined();
  });

  it('strips caller headers whatever their case', () => {
    expect(withoutCallerHeaders({ 'X-User-Id': 'me', 'x-user-roles': 'admin', 'X-Workspace-Id': 'w1', 'x-workspace-role': 'lead', accept: '*/*' })).toEqual({ accept: '*/*' });
  });
});
