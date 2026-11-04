import { i18nBuilder } from 'keycloakify/login';
import type { ThemeName } from '../kc.gen';

// Every word on these pages is Keycloak's own message, so each comes in every language Keycloak has
// (Keycloakify carries them). The theme adds no wording of its own: the names it shows (the product's,
// the organisation's) come from the realm and from Keycloak's environment.
const { useI18n, ofTypeI18n: _ofTypeI18n } = i18nBuilder.withThemeName<ThemeName>().build();

type I18n = typeof _ofTypeI18n;

export { useI18n, type I18n };
