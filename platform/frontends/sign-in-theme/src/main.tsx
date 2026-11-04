import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KcPage } from './kc.gen';

// Keycloak puts the page's data in window.kcContext when it serves a page of this theme.
createRoot(document.getElementById('root')!).render(
  <StrictMode>{window.kcContext ? <KcPage kcContext={window.kcContext} /> : <p>This page is shown by Keycloak, at sign-in.</p>}</StrictMode>,
);
