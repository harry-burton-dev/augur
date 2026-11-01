import '@augur/kit-common/tokens.css';
import '@augur/kit-common/kit.css';
import '@augur/ui-kit/base.css';
import '@augur/ui-kit';
import './shell.css';
import { UserManager } from 'oidc-client-ts';
import { createRoot } from 'react-dom/client';
import { Host, SignInProblem } from './App.js';
import { CALLBACK_PATH, startSession } from './host/index.js';

// Locally this is the Keycloak realm in infra/keycloak; each deployment sets its own.
// A path (like /sso/realms/platform) means the sign-in service is on this site, wherever it is served.
const auth = new UserManager({
  authority: new URL(import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8180/realms/platform', window.location.origin).href.replace(/\/$/, ''),
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'shell',
  redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  scope: 'openid profile email',
  automaticSilentRenew: true,
});

const root = createRoot(document.getElementById('root')!);

startSession(auth, { location: window.location, history: window.history })
  .then((session) => {
    if (session !== 'redirecting') root.render(<Host session={session} />);
  })
  .catch((err: Error) => {
    root.render(<SignInProblem message={err.message} onSignIn={() => void auth.signinRedirect({ state: '/' })} />);
  });
