import { Icon, type IconName } from '@augur/kit-common';
import { kcSanitize } from 'keycloakify/lib/kcSanitize';
import { useInitialize } from 'keycloakify/login/Template.useInitialize';
import type { TemplateProps } from 'keycloakify/login/TemplateProps';
import { getKcClsx } from 'keycloakify/login/lib/kcClsx';
import { useSetClassName } from 'keycloakify/tools/useSetClassName';
import { useEffect } from 'react';
import type { I18n } from './i18n';
import type { KcContext } from './KcContext';

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
  // The product's name is the realm's display name; the organisation's comes from Keycloak's
  // environment (vite.config.ts). Neither is written here.
  const product = realm.displayName || realm.name;
  const org = properties.ORG_NAME;
  const logo = properties.ORG_LOGO_URL;

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
          {logo ? <img className="augur-signin-logo" src={logo} alt={org} /> : null}
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
