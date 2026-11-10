import '@augur/kit-common/fonts.css';
import '@augur/kit-common/tokens.css';
import './sign-in.css';
import type { ClassKey } from 'keycloakify/login';
import DefaultPage from 'keycloakify/login/DefaultPage';
import { lazy, Suspense } from 'react';
import { useI18n } from './i18n';
import type { KcContext } from './KcContext';
import Template from './Template';

const UserProfileFormFields = lazy(() => import('keycloakify/login/UserProfileFormFields'));

/**
 * Keycloak's sign-in pages, each Keycloakify's own (so every page Keycloak can show is covered and stays
 * in step with Keycloak), in AUGUR's frame (Template) and the Endstate look (sign-in.css, from Common's tokens, with Common's typefaces).
 * Keycloak's default stylesheet isn't loaded.
 */
export default function KcPage({ kcContext }: { kcContext: KcContext }) {
  const { i18n } = useI18n({ kcContext });
  return (
    <Suspense>
      <DefaultPage
        kcContext={kcContext}
        i18n={i18n}
        classes={classes}
        Template={Template}
        doUseDefaultCss={false}
        UserProfileFormFields={UserProfileFormFields}
        doMakeUserConfirmPassword
      />
    </Suspense>
  );
}

// Keycloakify's pages name their parts with these keys; sign-in.css styles the classes they map to.
export const classes = {
  kcFormClass: 'augur-signin-form',
  kcFormGroupClass: 'augur-signin-group',
  kcFormGroupErrorClass: 'augur-signin-group-error',
  kcLabelWrapperClass: 'augur-signin-label-wrapper',
  kcLabelClass: 'augur-signin-label',
  kcInputWrapperClass: 'augur-signin-input-wrapper',
  kcInputClass: 'augur-signin-input',
  kcTextareaClass: 'augur-signin-input',
  kcInputGroup: 'augur-signin-input-group',
  kcInputErrorMessageClass: 'augur-signin-error',
  kcInputHelperTextBeforeClass: 'augur-signin-hint',
  kcInputHelperTextAfterClass: 'augur-signin-hint',
  kcFormPasswordVisibilityButtonClass: 'augur-signin-reveal',
  kcFormSettingClass: 'augur-signin-setting',
  kcFormOptionsWrapperClass: 'augur-signin-options',
  kcFormButtonsClass: 'augur-signin-actions',
  kcButtonClass: 'augur-signin-button',
  kcButtonPrimaryClass: 'augur-signin-primary',
  kcButtonDefaultClass: 'augur-signin-secondary',
  kcButtonSecondaryClass: 'augur-signin-secondary',
  kcButtonBlockClass: 'augur-signin-block',
  kcFormSocialAccountSectionClass: 'augur-signin-providers',
  kcFormSocialAccountListClass: 'augur-signin-provider-list',
  kcFormSocialAccountListButtonClass: 'augur-signin-provider',
  kcSelectAuthListClass: 'augur-signin-choices',
  kcSelectAuthListItemClass: 'augur-signin-choice',
  kcSelectAuthListItemTitle: 'augur-signin-choice-title',
  kcSelectAuthListItemDescriptionClass: 'augur-signin-choice-detail',
  kcLoginOTPListClass: 'augur-signin-otp-choice',
  kcLoginOTPListInputClass: 'augur-signin-otp-input',
  kcLoginOTPListItemTitleClass: 'augur-signin-choice-title',
  kcRecoveryCodesList: 'augur-signin-codes',
  kcRecoveryCodesActions: 'augur-signin-actions',
  kcRecoveryCodesWarning: 'augur-signin-warning',
  kcSrOnlyClass: 'augur-signin-sr-only',
} satisfies { [key in ClassKey]?: string };
