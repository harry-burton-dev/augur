# @augur/sign-in-theme

## 0.1.0

### Minor Changes

- 16cd6fa: Sign-in pages and emails in AUGUR's look (ADR 0041). Keycloak now runs from AUGUR's own image, which carries a Keycloakify theme built from Common's tokens and parts: every Keycloak sign-in page and email, showing the organisation's name (`ORG_NAME`) and, if set, its logo (`ORG_LOGO_URL`), with the product's name from the realm. The realm job turns the theme on when Keycloak has it and offers the languages in `REALM_LANGUAGES` (default `en`).
