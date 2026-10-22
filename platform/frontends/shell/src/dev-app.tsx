import '@platform/ui-kit/tokens.css';
import '@platform/ui-kit/base.css';
import '@platform/ui-kit';
import './shell.css';
import { createRoot } from 'react-dom/client';
import { Host } from './App.js';
import { devSession, devUser, standInFetch } from './dev-app/standin.js';

// `pnpm dev:app <id>`: the real shell, signed in as a stand-in person, with one
// app in its catalogue. The dev server puts the app's manifest here.
const app = __DEV_APP__;
const session = devSession(devUser(app, __DEV_ROLES__));

createRoot(document.getElementById('root')!).render(<Host session={session} fetchImpl={standInFetch(app)} />);
