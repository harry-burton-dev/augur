import { Icon, type IconName } from '@augur/kit-common';
import { kcSanitize } from 'keycloakify/lib/kcSanitize';
import { useInitialize } from 'keycloakify/login/Template.useInitialize';
import type { TemplateProps } from 'keycloakify/login/TemplateProps';
import { getKcClsx } from 'keycloakify/login/lib/kcClsx';
import { useSetClassName } from 'keycloakify/tools/useSetClassName';
import { useEffect, useState } from 'react';
import type { I18n } from './i18n';
import type { KcContext } from './KcContext';

/** The logo an admin keeps in Admin → Organisation; it answers 404 when there is none, and the page shows no logo. */
const ORGANISATION_LOGO = '/api/identity/v1/public/organisation/logo';

/** The words of a bit of HTML, never its markup. */
const textOf = (html: string | undefined) => (html ? (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim() : '');

const MESSAGE_ICON: Record<'success' | 'warning' | 'error' | 'info', IconName> = {
  success: 'check',
  warning: 'warning',
  error: 'error',
  info: 'info',
};

/**
 * Every sign-in page's frame: the organisation, the page's title, Keycloak's message for it, the page
 * itself, and the product's name with the languages underneath. Keycloakify's own pages (DefaultPage) fill
 * it; sign-in.css gives their forms Common's look.
 */
export default function Template(props: TemplateProps<KcContext, I18n>) {
  const { displayInfo = false, displayMessage = true, headerNode, socialProvidersNode = null, infoNode = null, documentTitle, kcContext, i18n, doUseDefaultCss, classes, children } = props;
  const { kcClsx } = getKcClsx({ doUseDefaultCss, classes });
  const { msg, msgStr, currentLanguage, enabledLanguages } = i18n;
  const { realm, auth, url, message, isAppInitiatedAction, properties } = kcContext;
  // The product's name is the realm's display name, which the realm job sets from ORG_PRODUCT_NAME (so
  // emails' subjects agree). The organisation's is the realm's HTML display name, which the realm job sets from
  // Admin → Organisation, else Keycloak's environment (vite.config.ts). The logo is the one kept in Admin →
  // Organisation, served without a sign-in, unless ORG_LOGO_URL names another. Neither is written here.
  const product = realm.displayName || realm.name;
  const org = textOf(realm.displayNameHtml) || properties.ORG_NAME;
  const logo = properties.ORG_LOGO_URL || ORGANISATION_LOGO;
  const [logoMissing, setLogoMissing] = useState(false);

  useEffect(() => {
    document.title = documentTitle ?? msgStr('loginTitle', product);
  }, [documentTitle, msgStr, product]);
  useSetClassName({ qualifiedName: 'html', className: 'augur-signin-html' });
  useSetClassName({ qualifiedName: 'body', className: 'augur-signin-body' });

  const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });
  if (!isReadyToRender) return null;

  const showMessage = displayMessage && message !== undefined && (message.type !== 'warning' || !isAppInitiatedAction);
  const showUsername = auth !== undefined && auth.showUsername && !auth.showResetCredentials;

  return (
    <div className="augur-signin">
      <main className="augur-signin-card">
        <header className="augur-signin-head">
          {logo && !logoMissing ? <img className="augur-signin-logo" src={logo} alt={org} onError={() => setLogoMissing(true)} /> : null}
          <div className="augur-heading" data-size="s">
            {org ? <div className="augur-eyebrow">{org}</div> : null}
            <h1 className="augur-title" id="kc-page-title">
              {headerNode}
            </h1>
          </div>
          {showUsername ? (
            <div id="kc-username" className="augur-signin-username">
              <span id="kc-attempted-username">{auth.attemptedUsername}</span>
              <a id="reset-login" href={url.loginRestartFlowUrl} className="augur-signin-quiet">
                <Icon name="back" size={16} />
                {msg('restartLoginTooltip')}
              </a>
            </div>
          ) : null}
        </header>

        {showMessage ? (
          <div className="augur-signin-message" data-type={message.type} role={message.type === 'error' ? 'alert' : 'status'}>
            <Icon name={MESSAGE_ICON[message.type]} size={18} />
            <span className={kcClsx('kcAlertTitleClass')} dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
          </div>
        ) : null}

        <div id="kc-content" className="augur-signin-content">
          {children}
          {auth !== undefined && auth.showTryAnotherWayLink ? (
            <form id="kc-select-try-another-way-form" action={url.loginAction} method="post">
              <input type="hidden" name="tryAnotherWay" value="on" />
              <button type="submit" id="try-another-way" className="augur-signin-link">
                {msg('doTryAnotherWay')}
              </button>
            </form>
          ) : null}
          {socialProvidersNode}
          {displayInfo ? (
            <div id="kc-info" className="augur-signin-info">
              {infoNode}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="augur-signin-foot">
        <span className="augur-signin-product">{product}</span>
        {enabledLanguages.length > 1 ? (
          <details className="augur-signin-languages" id="kc-locale">
            <summary aria-label={msgStr('languages')}>
              {currentLanguage.label}
              <Icon name="chevron-down" size={14} />
            </summary>
            <ul>
              {enabledLanguages.map(({ languageTag, label, href }) => (
                <li key={languageTag}>
                  <a href={href} lang={languageTag} aria-current={languageTag === currentLanguage.languageTag ? 'true' : undefined}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </footer>
    </div>
  );
}
