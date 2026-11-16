// The kit's own CSS (tokens, Common, Quill) is linked from the kit bundle, before this (vite.config.ts).
import '@augur/shell-kit/kit.css';
import './shell.css';
import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { createRoot } from 'react-dom/client';
import { Host, SignInProblem } from './App.js';
import { CALLBACK_PATH, SILENT_CALLBACK_PATH, startSession } from './host/index.js';
import { startTelemetry } from './host/telemetry.js';

// Locally this is the Keycloak realm in infra/keycloak; each deployment sets its own.
// A path (like /sso/realms/platform) means the sign-in service is on this site, wherever it is served.
const auth = new UserManager({
  authority: new URL(import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8180/realms/platform', window.location.origin).href.replace(/\/$/, ''),
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'shell',
  redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
  silent_redirect_uri: `${window.location.origin}${SILENT_CALLBACK_PATH}`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  scope: 'openid profile email',
  // Renewed when a call needs a token (session.ts), one renewal at a time: the sign-in service takes each refresh
  // token once, so a timer renewing beside it would race it.
  automaticSilentRenew: false,
  // Tokens are kept in this page's memory only, never in its storage, where any script on this origin could read
  // them (PER-453). A reload or a new tab asks the sign-in service again (session.ts). Only a sign-in's passing
  // state (its PKCE verifier) is kept in storage, to survive the trip to the sign-in page.
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
});

// Releases before PER-453 kept the sign-in in session storage (oidc-client-ts's `oidc.user:` keys): take it out.
for (const key of Object.keys(window.sessionStorage)) if (key.startsWith('oidc.user:')) window.sessionStorage.removeItem(key);

if (window.location.pathname === SILENT_CALLBACK_PATH) {
  // This page in the hidden frame: hand the sign-in service's answer to the page that asked, and draw nothing.
  void auth.signinSilentCallback().catch(() => undefined);
} else {
  const root = createRoot(document.getElementById('root')!);

  startSession(auth, { location: window.location, history: window.history })
    .then((session) => {
      if (session === 'redirecting') return;
      root.render(<Host session={session} />);
      // Browser errors and traces, when this deployment collects them (ADR 0059). Never in the way of the first screen.
      void startTelemetry({ getToken: () => session.getToken(), version: __SHELL_VERSION__ });
    })
    .catch((err: Error) => {
      root.render(<SignInProblem message={err.message} onSignIn={() => void auth.signinRedirect({ state: '/' })} />);
    });
}
