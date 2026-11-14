import type { AppManifestEntry, InboxCounts, InboxItem, User, Workspace, WorkspaceRef } from '@augur/mfe-sdk';
import type { Session } from '../host/index.js';
import { isWorkerApp } from '../host/apps3.js';
import type { InPageApp } from '../host/manifest.js';

/**
 * The person signed in to the stand-in shell `pnpm dev:app` opens. They have
 * the role the app needs, plus any asked for with DEV_ROLES.
 */
export const devUser = (app: AppManifestEntry, roles: string[] = []): User => ({
  id: 'dev-person',
  name: 'Dev Person',
  email: 'dev.person@example.test',
  departments: ['Development'],
  roles: [...new Set([...roles, ...(app.requiredRole ? [app.requiredRole] : [])])],
});

const me: WorkspaceRef = { id: 'dev-me', kind: 'personal', name: 'You', slug: 'me' };
const org: WorkspaceRef = { id: 'dev-org', kind: 'org', name: 'Organisation', slug: 'org' };

/** Their own floor and the org's, so an app can be tried on both. */
export const devFloors: Workspace[] = [
  { ...me, path: [me], role: 'lead' },
  { ...org, path: [org], role: 'member' },
];

/** Signed in already, with a token the stand-in's own proxy accepts in place of the gateway. */
export const devSession = (user: User): Session => ({
  user,
  floors: devFloors,
  getToken: async () => 'dev-token',
  signOut: async () => window.location.assign('/'),
  startAction: async () => undefined,
});

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

/** Home, from its build in `frontends/home/dist`, so an app's glance card can be seen where it goes. */
export const devHome: InPageApp = { id: 'home', name: 'Home', route: '/home', entry: '/apps/home/entry.js', version: '0.0.0', sdk: '^2.0.0 || ^3.0.0', icon: 'home', description: 'What needs you', inPage: true };

/**
 * Answers the platform's own endpoints for the shell, so the real shell runs
 * with no platform behind it: the catalogue is Home, this app and any `also`,
 * nothing is in the stream but what the app sends, and preferences last until
 * the page reloads. Anything else (the apps' own services) goes to `real`.
 */
export const standInFetch = (app: AppManifestEntry, real: typeof fetch = (...args) => fetch(...args), also: AppManifestEntry[] = []): typeof fetch => {
  let preferences: unknown = {};
  const account = devAccount();
  const inbox = devInbox(app);
  // On a developer's own machine their app may load into the page on contract 2, as IN_PAGE_APPS allows on a deployment.
  const inPage = (a: AppManifestEntry) => (isWorkerApp(a) ? a : { ...a, inPage: true });
  const catalogue = [...(app.id === devHome.id ? [app] : [devHome, app]), ...also.filter((a) => a.id !== app.id && a.id !== devHome.id)].map(inPage);
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), 'http://stand-in');
    const path = url.pathname;
    if (path === '/api/registry/v1/manifest') return json(catalogue);
    if (path === '/api/identity/v1/me/preferences') {
      if (init?.method !== 'PUT') return json(preferences);
      preferences = JSON.parse(String(init.body ?? '{}'));
      return new Response(null, { status: 204 });
    }
    if (path.startsWith('/api/identity/v1/me/')) {
      const said = account.answer(path.slice('/api/identity/v1/me'.length), init);
      if (said) return said;
    }
    if (path === '/api/events/v1/notifications') return json([]);
    if (path === '/api/events/v1/notifications/stream') {
      // Open until the shell stops listening, with nothing on it but the stand-in inbox's changes.
      let hear: ((e: Event) => void) | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          hear = (e: Event) => controller.enqueue(new TextEncoder().encode(`event: inbox\ndata: ${JSON.stringify((e as CustomEvent).detail)}\n\n`));
          inbox.changes.addEventListener('change', hear);
          init?.signal?.addEventListener('abort', () => {
            inbox.changes.removeEventListener('change', hear!);
            controller.error(new DOMException('Aborted', 'AbortError'));
          });
        },
      });
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    }
    if (path.startsWith('/api/events/v1/inbox')) return inbox.answer(path, url.searchParams, init);
    if (path.startsWith('/api/events/v1/notifications/')) return new Response(null, { status: 204 });
    if (path === '/api/events/v1/domain-events/stream') return devEventStream(url.searchParams.get('topics') ?? '', new Headers(init?.headers).get('x-workspace-id'), init?.signal);
    return real(input, init);
  };
};

/** The window event `pnpm dev:app` turns into a domain event on its stand-in stream. */
export const DEV_EVENT = 'augur:dev-domain-event';

/**
 * The stand-in for the events service's browser stream. Nothing is on it until a domain event is
 * sent from the page, as from the console, to try an app's `refreshOn`:
 * `dispatchEvent(new CustomEvent('augur:dev-domain-event', { detail: { topic: 'folio.document.published', payload: { document: 'd1' } } }))`.
 * Like the real one it carries only the topics asked for, on the floor asked for (the current one unless `workspace` names another).
 */
const devEventStream = (topics: string, floor: string | null, signal?: AbortSignal | null) => {
  const wanted = topics.split(',').filter(Boolean);
  const matches = (topic: string) => wanted.some((w) => (w.endsWith('.*') ? topic.startsWith(w.slice(0, -1)) : topic === w));
  let seq = 0;
  let hear: ((e: Event) => void) | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      hear = (e: Event) => {
        const { topic, payload = {}, workspace = floor } = (e as CustomEvent<{ topic: string; payload?: unknown; workspace?: string }>).detail ?? {};
        if (!topic || !matches(topic) || workspace !== floor) return;
        const event = { seq: String(++seq), topic, id: `dev-${seq}`, publisher: topic.split('.')[0], at: new Date().toISOString(), workspace: { id: floor, path: [floor] }, payload };
        controller.enqueue(new TextEncoder().encode(`event: domain-event\ndata: ${JSON.stringify(event)}\n\n`));
      };
      window.addEventListener(DEV_EVENT, hear);
      controller.enqueue(new TextEncoder().encode(': connected\n\n'));
      signal?.addEventListener('abort', () => {
        window.removeEventListener(DEV_EVENT, hear!);
        controller.error(new DOMException('Aborted', 'AbortError'));
      });
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
};

/** The window event `pnpm dev:app` turns into an item in the stand-in person's inbox. */
export const DEV_INBOX = 'augur:dev-inbox-item';

/**
 * The stand-in for the events service's Inbox, so an app's items can be seen as people will see them.
 * Nothing is in it until an item is sent from the page, as from the console:
 * `dispatchEvent(new CustomEvent('augur:dev-inbox-item', { detail: { title: 'Check claim 42', open: { type: 'claim.open', payload: { id: 42 } } } }))`.
 * Left out, `app` is the app being developed, `kind` its first declared kind, and the owner the stand-in person.
 * Take, give back, decline, hand on and mark done change it as the events service would, and the
 * notification stream says so; items last until the page reloads.
 */
export const devInbox = (app: AppManifestEntry) => {
  const items: InboxItem[] = [];
  const changes = new EventTarget();
  const tell = (id: string, change: 'added' | 'changed' | 'closed') => changes.dispatchEvent(new CustomEvent('change', { detail: { id, change } }));
  let n = 0;
  if (typeof window !== 'undefined')
    window.addEventListener(DEV_INBOX, (e) => {
      const detail = ((e as CustomEvent<Partial<InboxItem>>).detail ?? {}) as Partial<InboxItem>;
      const at = new Date().toISOString();
      const id = detail.id ?? `dev-item-${++n}`;
      items.push({
        app: app.id,
        key: id,
        kind: app.inbox?.kinds[0]?.id ?? 'item',
        owner: { kind: 'person', id: 'dev-person' },
        state: 'open',
        createdAt: at,
        updatedAt: at,
        ...detail,
        id,
        allow: { decline: true, handOn: true, selfComplete: false, ...detail.allow },
      });
      tell(id, 'added');
    });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const open = (i: InboxItem) => i.state === 'open';
  const answer = (path: string, query: URLSearchParams, init?: RequestInit) => {
    const rest = path.slice('/api/events/v1/inbox'.length);
    if (rest === '' || rest === '/') {
      const tab = query.get('tab') ?? 'you';
      return json(
        items.filter((i) => (tab === 'done' ? !open(i) : open(i) && (tab === 'teams' ? i.owner.kind === 'team' && !i.takenBy : i.owner.kind === 'person' || i.takenBy === 'dev-person'))).reverse(),
      );
    }
    if (rest === '/counts') {
      const you = items.filter((i) => open(i) && (i.owner.kind === 'person' || i.takenBy === 'dev-person'));
      const counts: InboxCounts = { you: you.length, teams: items.filter((i) => open(i) && i.owner.kind === 'team' && !i.takenBy).length, overdue: you.filter((i) => i.overdue).length };
      return json(counts);
    }
    const [, id, verb] = rest.split('/').map(decodeURIComponent);
    const item = items.find((i) => i.id === id);
    if (!item) return json({ detail: 'There’s no such item in your inbox.' }, 404);
    if (!verb) return json(item);
    const body = JSON.parse(String(init?.body ?? '{}')) as { note?: string; to?: string };
    const at = new Date().toISOString();
    if (verb === 'take') item.takenBy = 'dev-person';
    else if (verb === 'release') delete item.takenBy;
    else if (verb === 'hand-on') {
      const [kind, to] = (body.to ?? '').split(':');
      item.owner = { kind: kind === 'team' ? 'team' : 'person', id: to ?? '' };
      delete item.takenBy;
    } else if (verb === 'decline' || verb === 'done') {
      Object.assign(item, { state: verb === 'done' ? 'done' : 'declined', closedAt: at, closedBy: 'dev-person', ...(body.note ? { closeNote: body.note } : {}) });
    } else return json({ detail: `The inbox doesn’t ${verb}.` }, 404);
    item.updatedAt = at;
    tell(item.id, open(item) ? 'changed' : 'closed');
    return json(item);
  };
  return { answer, changes };
};

/**
 * The stand-in for identity's account API (`/v1/me/*`), so the Account dialog opens with something in
 * each section: a profile, a password and one code app, two places signed in, and a fortnight of
 * sign-ins with one failed try. Changes to the profile and a request to leave last until the page reloads.
 */
export const devAccount = (now = Date.now()) => {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
  let profile = { username: 'dev.person', firstName: 'Dev', lastName: 'Person', email: 'dev.person@example.test', emailVerified: true, jobTitle: 'Developer', managed: [] as string[], languages: ['en'] };
  let leave: { requestedAt: string; note?: string } | null = null;
  const security = {
    password: { set: true, createdAt: at(24 * 9) },
    codeApps: [{ id: 'dev-otp', type: 'otp', label: 'Phone', createdAt: at(24 * 8), removeAction: 'delete_credential:dev-otp', removable: true }],
    passkeys: [],
    recoveryCodes: null,
    twoStep: { required: false, set: true },
    linked: [],
    canLink: [],
    actions: [
      { id: 'password', action: 'UPDATE_PASSWORD', available: true },
      { id: 'code-app', action: 'CONFIGURE_TOTP', available: true },
      { id: 'passkey', action: 'webauthn-register-passwordless', available: true },
      { id: 'recovery-codes', action: 'CONFIGURE_RECOVERY_AUTHN_CODES', available: true },
      { id: 'email', action: 'UPDATE_EMAIL', available: true },
    ],
    emails: { on: false, address: profile.email, verified: true },
  };
  let sessions = [
    { id: 'dev-session-1', startedAt: at(2), lastSeenAt: at(0), ipAddress: '192.0.2.10', clients: ['shell'] },
    { id: 'dev-session-2', startedAt: at(50), lastSeenAt: at(30), ipAddress: '192.0.2.77', clients: ['shell'] },
  ];
  const signIns = Array.from({ length: 12 }, (_, i) =>
    i === 3
      ? { time: at(i * 26 + 1), kind: 'failed', event: 'LOGIN_ERROR', error: 'invalid_user_credentials', ipAddress: '203.0.113.9', client: 'shell' }
      : { time: at(i * 26 + 1), kind: 'signed-in', event: 'LOGIN', ipAddress: '192.0.2.10', client: 'shell' },
  );
  const answer = (path: string, init?: RequestInit): Response | undefined => {
    const method = init?.method ?? 'GET';
    if (path === '/profile') {
      if (method === 'PATCH') profile = { ...profile, ...(JSON.parse(String(init?.body ?? '{}')) as object) };
      return json(profile);
    }
    if (path === '/security') return json(security);
    if (path === '/sessions' && method === 'GET') return json({ sessions });
    if (path.startsWith('/sessions')) {
      const one = path.split('/')[2];
      const ended = one ? sessions.filter((x) => x.id === decodeURIComponent(one)).length : sessions.length;
      sessions = one ? sessions.filter((x) => x.id !== decodeURIComponent(one)) : [];
      return json({ ended });
    }
    if (path === '/sign-ins') return json({ signIns });
    if (path === '/leave') {
      if (method === 'POST') leave = { requestedAt: new Date(now).toISOString(), ...(JSON.parse(String(init?.body ?? '{}')) as { note?: string }) };
      if (method === 'DELETE') leave = null;
      return method === 'DELETE' ? new Response(null, { status: 204 }) : json(leave ?? {});
    }
    if (path === '/data') return new Response(JSON.stringify({ profile }), { headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="my-data.json"' } });
    return undefined;
  };
  return { answer };
};
