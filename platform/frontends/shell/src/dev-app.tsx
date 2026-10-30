import '@augur/ui-kit/tokens.css';
import '@augur/ui-kit/base.css';
import './fonts.ts';
import '@augur/ui-kit';
import './shell.css';
import { createRoot } from 'react-dom/client';
import { Host } from './App.js';
import { devSession, devUser, standInFetch } from './dev-app/standin.js';

// `pnpm dev:app <id>`: the real shell, signed in as a stand-in person, with one
// app in its catalogue (and any in DEV_ALSO). The dev server puts their manifests here.
const app = __DEV_APP__;
const session = devSession(devUser(app, __DEV_ROLES__));

createRoot(document.getElementById('root')!).render(<Host session={session} fetchImpl={standInFetch(app, undefined, __DEV_ALSO__)} />);
