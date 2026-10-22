import type { User, Workspace } from '@platform/mfe-sdk';
import { FloorsError, loadFloors } from './floors.js';

/** Who is signed in, the floors they can stand on, and how to get a current token for calling the gateway. */
export interface Session {
  user: User;
  /** Their own floor first, then the org, then their teams. */
  floors: Workspace[];
  getToken(): Promise<string>;
  signOut(): Promise<void>;
}

/** Where the sign-in service sends people back to after they sign in. */
export const CALLBACK_PATH = '/auth/callback';

export class SessionError extends Error {}

/** The parts of an OIDC client the shell uses; oidc-client-ts's UserManager fits it. */
export interface Authenticator {
  getUser(): Promise<SignedIn | null>;
  signinRedirect(args?: { state?: unknown }): Promise<void>;
  signinRedirectCallback(url?: string): Promise<SignedIn>;
  signinSilent(): Promise<SignedIn | null>;
  signoutRedirect(): Promise<void>;
}

export interface SignedIn {
  access_token: string;
  refresh_token?: string;
  expired?: boolean;
  state?: unknown;
}

export interface StartOptions {
  location: Pick<Location, 'pathname' | 'search' | 'href'>;
  history: Pick<History, 'replaceState'>;
  fetchImpl?: typeof fetch;
  /** Where Identity answers "who am I", through the gateway. */
  meUrl?: string;
  /** Where Identity lists the person's floors, through the gateway. */
  floorsUrl?: string;
}

/** Only a path on this site is a safe place to return to after signing in. */
const returnPath = (state: unknown) => (typeof state === 'string' && state.startsWith('/') && !state.startsWith('//') ? state : '/');

/** A usable sign-in, renewed with the refresh token when it has expired. */
const current = async (auth: Authenticator): Promise<SignedIn | null> => {
  const user = await auth.getUser();
  if (user && !user.expired) return user;
  if (!user?.refresh_token) return null;
  return auth.signinSilent().catch(() => null);
};

async function loadMe(fetchImpl: typeof fetch, url: string, token: string): Promise<User> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  } catch {
    throw new SessionError("Can't reach the platform to finish signing in. Try again.");
  }
  if (res.status === 401) throw new SessionError('The platform did not accept your sign-in. Sign in again.');
  if (!res.ok) throw new SessionError(`Signing in failed: the platform answered ${res.status}. Try again.`);
  const me = (await res.json()) as Partial<User>;
  if (typeof me.id !== 'string' || typeof me.name !== 'string') throw new SessionError('The platform sent an answer the shell could not read.');
  return { ...me, id: me.id, name: me.name, departments: me.departments ?? [], roles: me.roles ?? [] };
}

/**
 * Signs the person in. Returns their session, or 'redirecting' when they are on
 * their way to the sign-in page and the shell should render nothing yet.
 */
export async function startSession(
  auth: Authenticator,
  { location, history, fetchImpl = fetch, meUrl = '/api/identity/v1/me', floorsUrl = '/api/identity/v1/me/workspaces' }: StartOptions,
): Promise<Session | 'redirecting'> {
  if (location.pathname === CALLBACK_PATH) {
    let signedIn: SignedIn;
    try {
      signedIn = await auth.signinRedirectCallback(location.href);
    } catch {
      throw new SessionError('Signing in did not finish. Sign in again.');
    }
    history.replaceState(null, '', returnPath(signedIn.state));
  } else if (!(await current(auth))) {
    await auth.signinRedirect({ state: location.pathname + location.search });
    return 'redirecting';
  }

  const getToken = async () => {
    const signedIn = await current(auth);
    if (!signedIn) throw new SessionError('Your session has ended. Sign in again.');
    return signedIn.access_token;
  };
  const token = await getToken();
  const [me, mine] = await Promise.allSettled([loadMe(fetchImpl, meUrl, token), loadFloors(fetchImpl, floorsUrl, token)]);
  // Who they are matters more: its problem is the one to show.
  if (me.status === 'rejected') throw me.reason;
  if (mine.status === 'rejected') throw mine.reason instanceof FloorsError ? new SessionError(mine.reason.message) : mine.reason;
  const user = me.value;
  const floors = mine.value;
  return {
    user,
    floors,
    getToken,
    signOut: () => auth.signoutRedirect(),
  };
}
