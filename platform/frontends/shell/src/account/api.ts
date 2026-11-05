/**
 * Identity's account API (`/v1/me/*`, docs/account.md), as the Account area calls it through the
 * gateway. The shapes follow contracts/identity.openapi.yaml.
 */

export const PROFILE_FIELDS = ['firstName', 'lastName', 'email', 'jobTitle', 'phone', 'pronouns', 'picture', 'locale'] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export interface Profile {
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  emailVerified: boolean;
  jobTitle?: string;
  phone?: string;
  pronouns?: string;
  picture?: string;
  locale?: string;
  managed: ProfileField[];
  managedBy?: string;
}
export type ProfileChanges = Partial<Pick<Profile, 'firstName' | 'lastName' | 'jobTitle' | 'phone' | 'pronouns' | 'picture'>>;

export interface HeldCredential {
  id: string;
  type: string;
  label?: string;
  createdAt?: string;
  removeAction: string;
  removable: boolean;
  reason?: string;
}

export type AccountActionId = 'password' | 'code-app' | 'passkey' | 'recovery-codes' | 'email';

export interface Security {
  password: { set: boolean; createdAt?: string; managedBy?: string };
  codeApps: HeldCredential[];
  passkeys: HeldCredential[];
  recoveryCodes: HeldCredential | null;
  twoStep: { required: boolean; set: boolean; reason?: string };
  linked: { provider: string; name: string; username?: string }[];
  canLink: { alias: string; name: string; action: string }[];
  actions: { id: AccountActionId; action: string; available: boolean; reason?: string }[];
}

export interface AccountSession {
  id: string;
  startedAt: string;
  lastSeenAt: string;
  ipAddress?: string;
  clients: string[];
  rememberMe?: boolean;
}

export interface SignIn {
  time: string;
  kind: 'signed-in' | 'failed' | 'changed';
  event: string;
  ipAddress?: string;
  client?: string;
  error?: string;
}

export interface LeaveRequest {
  requestedAt: string;
  note?: string;
}

/** A refusal from identity, with the sentence it gave. */
export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The sign-in session a token belongs to (its `sid` claim), so the list can say which one is this. */
export function sessionOf(token: string): string | undefined {
  const part = token.split('.')[1];
  if (!part) return undefined;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const sid = (JSON.parse(json) as { sid?: unknown }).sid;
    return typeof sid === 'string' ? sid : undefined;
  } catch {
    return undefined;
  }
}

export interface AccountApiOptions {
  /** Identity through the gateway. */
  base?: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

/** The calls the Account area makes. Each refusal throws an AccountError carrying identity's sentence. */
export class AccountApi {
  private readonly base: string;
  private readonly getToken: () => Promise<string>;
  private readonly fetchImpl: typeof fetch;

  constructor({ base = '/api/identity/v1', getToken, fetchImpl }: AccountApiOptions) {
    this.base = base;
    this.getToken = getToken;
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: { authorization: `Bearer ${await this.getToken()}`, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AccountError('AUGUR can’t be reached right now. Check your connection and try again.', 0);
    }
    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const said = (data as { detail?: string; message?: string } | undefined) ?? {};
      throw new AccountError(said.detail ?? said.message ?? `AUGUR answered ${res.status}. Try again.`, res.status);
    }
    return data as T;
  }

  profile() {
    return this.call<Profile>('GET', '/me/profile');
  }

  updateProfile(changes: ProfileChanges) {
    return this.call<Profile>('PATCH', '/me/profile', changes);
  }

  security() {
    return this.call<Security>('GET', '/me/security');
  }

  async sessions() {
    return (await this.call<{ sessions: AccountSession[] }>('GET', '/me/sessions')).sessions;
  }

  async endSession(id: string) {
    await this.call('DELETE', `/me/sessions/${encodeURIComponent(id)}`);
  }

  /** Signs out everywhere, or everywhere but `keep`. */
  async endSessions(keep?: string) {
    return (await this.call<{ ended: number }>('DELETE', `/me/sessions${keep ? `?keep=${encodeURIComponent(keep)}` : ''}`)).ended;
  }

  async signIns(max = 20) {
    return (await this.call<{ signIns: SignIn[] }>('GET', `/me/sign-ins?max=${max}`)).signIns;
  }

  /** Whether they've asked to leave, and when. */
  async leaveRequest() {
    const said = await this.call<Partial<LeaveRequest>>('GET', '/me/leave');
    return said.requestedAt ? (said as LeaveRequest) : null;
  }

  /** Asks an administrator to close their account. Asking again keeps the first time. */
  async requestLeave(note?: string) {
    return this.call<LeaveRequest>('POST', '/me/leave', note ? { note } : {});
  }

  async withdrawLeave() {
    await this.call('DELETE', '/me/leave');
  }

  /** A copy of what AUGUR keeps about them, as a JSON file to save. */
  async myData(): Promise<{ blob: Blob; name: string }> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}/me/data`, { headers: { authorization: `Bearer ${await this.getToken()}` } });
    } catch {
      throw new AccountError('AUGUR can’t be reached right now. Check your connection and try again.', 0);
    }
    if (!res.ok) {
      const said = ((await res.json().catch(() => undefined)) as { detail?: string; message?: string } | undefined) ?? {};
      throw new AccountError(said.detail ?? said.message ?? `AUGUR answered ${res.status}. Try again.`, res.status);
    }
    const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'my-data.json';
    return { blob: await res.blob(), name };
  }

  /** The current token's sign-in session. */
  async currentSession() {
    return sessionOf(await this.getToken());
  }
}
