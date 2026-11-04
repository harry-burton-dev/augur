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

const own = { id: 'w-me', kind: 'personal', name: 'You', slug: 'me', path: [{ id: 'w-me', kind: 'personal', name: 'You', slug: 'me' }], role: 'lead' };
const org = { id: 'w-org', kind: 'org', name: 'Acme', slug: 'org', path: [{ id: 'w-org', kind: 'org', name: 'Acme', slug: 'org' }], role: 'member' };
const okFetch = vi.fn(async (url: string) =>
  Response.json(url.endsWith('/me/workspaces') ? { workspaces: [{ ...own, direct: true }, org] } : me),
) as unknown as typeof fetch;
const at = (pathname: string, search = '') => ({ pathname, search, href: `http://localhost:5173${pathname}${search}` });

describe('startSession', () => {
  it('sends someone who is not signed in to sign in, remembering where they were', async () => {
    const auth = fakeAuth(null);
    const result = await startSession(auth, { location: at('/library', '?q=1'), history: { replaceState: vi.fn() }, fetchImpl: okFetch });
    expect(result).toBe('redirecting');
    expect(auth.signinRedirect).toHaveBeenCalledWith({ state: '/library?q=1' });
  });

  it('asks for the password again when an app wants a fresh sign-in, then goes back', async () => {
    const auth = fakeAuth({ access_token: 'current' });
    const result = await startSession(auth, { location: at('/auth/again', '?return=%2Fadmin%2Fupdates%3Fupgrade%3D0.3.0'), history: { replaceState: vi.fn() }, fetchImpl: okFetch });
    expect(result).toBe('redirecting');
    expect(auth.signinRedirect).toHaveBeenCalledWith({ state: '/admin/updates?upgrade=0.3.0', prompt: 'login', max_age: 0 });
    const elsewhere = fakeAuth({ access_token: 'current' });
    await startSession(elsewhere, { location: at('/auth/again', '?return=https://evil.example'), history: { replaceState: vi.fn() }, fetchImpl: okFetch });
    expect(elsewhere.signinRedirect).toHaveBeenCalledWith(expect.objectContaining({ state: '/' }));
  });

  it('keeps each team’s level name for the shell and apps, and nothing else the platform adds', async () => {
    const ops = { id: 'w-ops', kind: 'team', name: 'Ops', slug: 'ops', level: 'Department', path: [org.path[0], { id: 'w-ops', kind: 'team', name: 'Ops', slug: 'ops', level: 'Department' }], role: 'member' };
    const fetchImpl = vi.fn(async (url: string) => Response.json(url.endsWith('/me/workspaces') ? { workspaces: [own, org, { ...ops, direct: false }] } : me)) as unknown as typeof fetch;
    const session = await startSession(fakeAuth({ access_token: 't' }), { location: at('/'), history: { replaceState: vi.fn() }, fetchImpl });
    expect(session !== 'redirecting' && session.floors[2]).toEqual(ops);
  });

  it('finishes signing in on the callback and returns to where they were', async () => {
    const auth = fakeAuth(null);
    const history = { replaceState: vi.fn() };
    auth.getUser = vi.fn(async () => ({ access_token: 'fresh' }));
    const session = await startSession(auth, { location: at('/auth/callback', '?code=c&state=s'), history, fetchImpl: okFetch });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/library/doc/1?x=1');
    expect(session).toMatchObject({ user: me, floors: [own, org] });
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
      new SessionError('AUGUR did not accept your sign-in. Sign in again.'),
    );
  });

  it('can’t start without the person’s floors', async () => {
    const noFloors = vi.fn(async (url: string) => (url.endsWith('/me/workspaces') ? new Response('', { status: 502 }) : Response.json(me))) as unknown as typeof fetch;
    await expect(startSession(fakeAuth({ access_token: 't' }), { location: at('/'), history: { replaceState: vi.fn() }, fetchImpl: noFloors })).rejects.toThrow(/answered 502/);
  });

  it('signs out through the sign-in service', async () => {
    const auth = fakeAuth({ access_token: 't' });
    const session = await startSession(auth, { location: at('/'), history: { replaceState: vi.fn() }, fetchImpl: okFetch });
    if (session === 'redirecting') throw new Error('expected a session');
    await session.signOut();
    expect(auth.signoutRedirect).toHaveBeenCalled();
  });
});
