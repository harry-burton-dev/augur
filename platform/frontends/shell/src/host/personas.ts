/**
 * "Act as" (ADR 0086, PDR-024): a person who holds an admin persona acts as it for a while, for a reason, after a
 * fresh sign-in. The permissions service keeps the sessions; the shell keeps the live one, sends its persona on
 * calls made through AUGUR's own frontends, and says plainly that the person is acting as it.
 */

/** The header the gateway reads, and checks against a live session, before signing the persona into the caller. */
export const PERSONA_HEADER = 'x-augur-persona';

/** A persona the person holds. Only an admin one needs "Act as"; everyday personas work whenever they're held. */
export interface HeldPersona {
  id: string;
  actAs: boolean;
  /** For an admin persona: the longest session it may have, in minutes. */
  longestMinutes?: number;
}

export interface ActingSession {
  id: string;
  persona: string;
  reason: string;
  startedAt: string;
  endsAt: string;
}

export interface Personas {
  personas: HeldPersona[];
  session?: ActingSession;
}

/** A refusal, with the permissions service's sentence and its reason (`sign_in_again`, `not_admin`, …). */
export class PersonaError extends Error {
  constructor(
    message: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}

export interface PersonaClientOptions {
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
  base?: string;
}

/** The permissions service's persona routes, through the gateway, as the person themselves (never for an app). */
export class PersonaClient {
  private readonly base: string;
  private readonly getToken: () => Promise<string>;
  private readonly fetchImpl: typeof fetch;

  constructor({ getToken, fetchImpl, base = '/api/permissions/v1/personas' }: PersonaClientOptions) {
    this.base = base;
    this.getToken = getToken;
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T | undefined> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: { authorization: `Bearer ${await this.getToken()}`, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new PersonaError('AUGUR can’t be reached right now. Check your connection and try again.');
    }
    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const said = (data as { detail?: string; message?: string; reason?: string; error?: string } | undefined) ?? {};
      throw new PersonaError(said.detail ?? said.message ?? `AUGUR answered ${res.status}. Try again.`, said.reason ?? said.error);
    }
    return data as T;
  }

  async list(): Promise<Personas> {
    return (await this.call<Personas>('GET', '')) ?? { personas: [] };
  }

  async start(persona: string, reason: string, minutes?: number): Promise<ActingSession> {
    const started = await this.call<ActingSession>('POST', `/${encodeURIComponent(persona)}/sessions`, { reason, ...(minutes ? { minutes } : {}) });
    if (!started) throw new PersonaError('AUGUR didn’t say whether it started. Try again.');
    return started;
  }

  async stop(): Promise<void> {
    await this.call('DELETE', '/sessions/current');
  }
}

/**
 * The session the person is acting in, if any, for the shell's parts to follow. It ends itself at its time; a call
 * the gateway refuses with `persona_ended` ends it sooner (`ended`).
 */
export class ActingAs {
  private session: ActingSession | undefined;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly now: () => number = Date.now) {}

  /** The live session, or undefined. Stable between changes, for useSyncExternalStore. */
  readonly current = (): ActingSession | undefined => this.session;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** The persona to send now, if a session is live. */
  persona(): string | undefined {
    if (this.session && Date.parse(this.session.endsAt) <= this.now()) this.ended();
    return this.session?.persona;
  }

  set(session: ActingSession | undefined) {
    clearTimeout(this.timer);
    this.session = session && Date.parse(session.endsAt) > this.now() ? session : undefined;
    if (this.session) this.timer = setTimeout(() => this.ended(), Math.min(Date.parse(this.session.endsAt) - this.now(), 2 ** 31 - 1));
    this.listeners.forEach((l) => l());
  }

  /** The session is over: its time ran out, it was stopped elsewhere, or the gateway said so. */
  ended() {
    if (this.session) this.set(undefined);
  }
}

/** Whether a path goes to AUGUR's gateway on this site, where the persona may be sent. */
const toGateway = (path: string) => {
  try {
    const url = new URL(path, location.href);
    return url.origin === location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

/**
 * `fetchImpl`, sending the live persona on calls to the gateway, and ending the session when the gateway says it
 * has. Only AUGUR's own frontends get this fetch (apps in the platform category); the gateway refuses the persona on
 * a call for any other app.
 */
export const withPersona =
  (fetchImpl: typeof fetch, acting: ActingAs): typeof fetch =>
  async (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const persona = toGateway(path) ? acting.persona() : undefined;
    if (!persona) return fetchImpl(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(PERSONA_HEADER, persona);
    const res = await fetchImpl(input, { ...init, headers });
    if (res.status === 403 && (res.headers.get('content-type') ?? '').includes('json')) {
      const said = (await res
        .clone()
        .json()
        .catch(() => undefined)) as { error?: string } | undefined;
      if (said?.error === 'persona_ended') acting.ended();
    }
    return res;
  };
