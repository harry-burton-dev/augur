import { createGetKcContextMock } from 'keycloakify/login/KcContext';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kcEnvDefaults, themeNames } from '../kc.gen';
import type { KcContextExtension } from './KcContext';
import KcPage from './KcPage';

const { getKcContextMock } = createGetKcContextMock({
  kcContextExtension: { themeName: themeNames[0], properties: { ...kcEnvDefaults, ORG_NAME: 'Northwind' } } satisfies KcContextExtension,
  kcContextExtensionPerPage: {},
});

let root: Root | undefined;

// Unmounted before the next test: Keycloakify loads the page's language after the first render and
// drops it once the page is gone, so nothing is left to update a torn-down document.
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
});

const render = async (kcContext: Parameters<typeof KcPage>[0]['kcContext']) => {
  const el = document.createElement('div');
  document.body.replaceChildren(el);
  root = createRoot(el);
  await act(async () => root!.render(<KcPage kcContext={kcContext} />));
  // Keycloakify loads each page lazily: wait until the page is in.
  await vi.waitFor(() => expect(el.querySelector('#kc-page-title form, #kc-content form')).not.toBeNull(), { timeout: 5000, interval: 20 });
  await act(async () => undefined);
  return el;
};

describe('the sign-in page', () => {
  it('names the organisation and the product from state, and posts to Keycloak', async () => {
    const el = await render(getKcContextMock({ pageId: 'login.ftl', overrides: { realm: { displayName: 'Product', displayNameHtml: '' }, url: { loginAction: '/sign-in-here' } } }));
    expect(el.querySelector('.augur-eyebrow')?.textContent).toBe('Northwind');
    expect(el.querySelector('.augur-signin-logo')?.getAttribute('src')).toBe('/api/identity/v1/public/organisation/logo');
    expect(el.querySelector('.augur-signin-product')?.textContent).toBe('Product');
    expect(el.querySelector('#kc-page-title')?.textContent).toBe('Sign in to your account');
    expect(el.querySelector('form#kc-form-login')?.getAttribute('action')).toBe('/sign-in-here');
    expect(el.querySelector('#kc-login')?.className).toContain('augur-signin-primary');
  });

  it('names the organisation as Admin → Organisation has it, as text', async () => {
    const el = await render(getKcContextMock({ pageId: 'login.ftl', overrides: { realm: { displayNameHtml: 'Acme &amp; <b>Co</b>' } } }));
    expect(el.querySelector('.augur-eyebrow')?.textContent).toBe('Acme & Co');
    expect(el.querySelector('.augur-eyebrow b')).toBeNull();
  });

  it('shows Keycloak’s message with a shape for its kind, and offers the realm’s languages', async () => {
    const el = await render(
      getKcContextMock({
        pageId: 'login.ftl',
        overrides: {
          message: { type: 'error', summary: 'Nope.' },
          locale: { currentLanguageTag: 'de', supported: [{ languageTag: 'en', label: 'English', url: '/en' }, { languageTag: 'de', label: 'Deutsch', url: '/de' }] },
        },
      }),
    );
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Nope.');
    expect([...el.querySelectorAll('#kc-locale a')].map((a) => a.getAttribute('lang'))).toEqual(['en', 'de']);
  });
});
