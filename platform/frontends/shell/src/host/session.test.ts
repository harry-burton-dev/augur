import { describe, expect, it, vi } from 'vitest';
import { startSession, SessionError, type Authenticator, type SignedIn } from './session.js';

const me = { id: 'u-1', name: 'Alex Rivera', email: 'alex@example.org', departments: ['Finance'], roles: ['admin'] };

const fakeAuth = (user: SignedIn | null, over: Partial<Authenticator> = {}): Authenticator => ({
  getUser: vi.fn(async () => user),
  signinRedirect: vi.fn(async () => {}),
  signinRedirectCallback: vi.fn(async () => ({ access_token: 'fresh', state: '/library/doc/1?x=1' })),
  signinSilent: vi.fn(async () => ({ access_token: 'renewed' })),
  signoutRedirect: vi.fn(async () => {}),
  ...over,
});

const okFetch = vi.fn(async () => new Response(JSON.stringify(me), { status: 200 })) as unknown as typeof fetch;
const at = (pathname: string, search = '') => ({ pathname, search, href: `http://localhost:5173${pathname}${search}` });

describe('startSession', () => {
  it('sends someone who is not signed in to sign in, remembering where they were', async () => {
    const auth = fakeAuth(null);
    const result = await startSession(auth, { location: at('/library', '?q=1'), history: { replaceState: vi.fn() }, fetchImpl: okFetch });
    expect(result).toBe('redirecting');
    expect(auth.signinRedirect).toHaveBeenCalledWith({ state: '/library?q=1' });
  });

  it('finishes signing in on the callback and returns to where they were', async () => {
    const auth = fakeAuth(null);
    const history = { replaceState: vi.fn() };
    auth.getUser = vi.fn(async () => ({ access_token: 'fresh' }));
    const session = await startSession(auth, { location: at('/auth/callback', '?code=c&state=s'), history, fetchImpl: okFetch });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/library/doc/1?x=1');
    expect(session).toMatchObject({ user: me, workspace: 'Finance' });
  });

  it('never returns to another site after signing in', async () => {
    const auth = fakeAuth({ access_token: 'fresh' }, { signinRedirectCallback: vi.fn(async () => ({ access_token: 'fresh', state: '//evil.example' })) });
    const history = { replaceState: vi.fn() };
    await startSession(auth, { location: at('/auth/callback'), history, fetchImpl: okFetch });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('asks Identity who the person is, with their token', async () => {
    const fetchImpl = vi.fn(okFetch);
    await startSession(fakeAuth({ access_token: 'tok' }), { location: at('/'), history: { replaceState: vi.fn() }, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/api/identity/v1/me', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok' }) }));
  });

  it('renews an expired sign-in with its refresh token', async () => {
    const auth = fakeAuth({ access_token: 'old', refresh_token: 'r', expired: true });
    const session = await startSession(auth, { location: at('/'), history: { replaceState: vi.fn() }, fetchImpl: okFetch });
    expect(session).not.toBe('redirecting');
    expect(auth.signinSilent).toHaveBeenCalled();
  });

  it('says so plainly when the platform turns the sign-in down', async () => {
    const denied = vi.fn(async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    await expect(startSession(fakeAuth({ access_token: 't' }), { location: at('/'), history: { replaceState: vi.fn() }, fetchImpl: denied })).rejects.toThrow(
      new SessionError('The platform did not accept your sign-in. Sign in again.'),
    );
  });

  it('signs out through the sign-in service', async () => {
    const auth = fakeAuth({ access_token: 't' });
    const session = await startSession(auth, { location: at('/'), history: { replaceState: vi.fn() }, fetchImpl: okFetch });
    if (session === 'redirecting') throw new Error('expected a session');
    await session.signOut();
    expect(auth.signoutRedirect).toHaveBeenCalled();
  });
});
