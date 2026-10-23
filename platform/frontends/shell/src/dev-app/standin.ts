import type { AppManifestEntry, User, Workspace, WorkspaceRef } from '@augur/mfe-sdk';
import type { Session } from '../host/index.js';

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
});

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

/** Home, from its build in `frontends/home/dist`, so an app's glance card can be seen where it goes. */
export const devHome: AppManifestEntry = { id: 'home', name: 'Home', route: '/home', entry: '/apps/home/entry.js', version: '0.0.0', sdk: '^1.0.0', icon: 'home', description: 'What needs you' };

/**
 * Answers the platform's own endpoints for the shell, so the real shell runs
 * with no platform behind it: the catalogue is Home and this app, nothing is
 * in the stream but what the app sends, and preferences last until the page
 * reloads. Anything else (the app's own service) goes to `real`.
 */
export const standInFetch = (app: AppManifestEntry, real: typeof fetch = (...args) => fetch(...args)): typeof fetch => {
  let preferences: unknown = {};
  const catalogue = app.id === devHome.id ? [app] : [devHome, app];
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), 'http://stand-in');
    const path = url.pathname;
    if (path === '/api/registry/v1/manifest') return json(catalogue);
    if (path === '/api/identity/v1/me/preferences') {
      if (init?.method !== 'PUT') return json(preferences);
      preferences = JSON.parse(String(init.body ?? '{}'));
      return new Response(null, { status: 204 });
    }
    if (path === '/api/events/v1/notifications') return json([]);
    if (path === '/api/events/v1/notifications/stream') {
      // Open until the shell stops listening, with nothing ever on it.
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
        },
      });
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    }
    if (path.startsWith('/api/events/v1/notifications/')) return new Response(null, { status: 204 });
    return real(input, init);
  };
};
