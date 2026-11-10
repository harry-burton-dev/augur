# @augur/sign-in-theme

## 0.2.0

### Minor Changes

- 9eccfb9: Sign-in no longer asks admins and deployment admins for a one-time code. The realm job takes the two-step role out of `admin` and `deployment-admin`; code apps and passkeys stay on offer to everyone, and Admin → Organisation can still ask everyone for one ("Optional" or "Everyone"). Account and Admin say so in those words. The sign-in pages and emails move to the Endstate look on Common 0.15: the shell's still horizon and band, one solid square panel, Keycap buttons, Well fields and Instrument Sans, in the horizon greys.

## 0.1.1

### Patch Changes

- 7723745: Admin → Organisation's settings grow (ADR 0042): the organisation's logo (a PNG, served to sign-in pages without a sign-in), a sign-in notice shown as Keycloak's Terms and Conditions step with "ask everyone again", the languages offered and the default, and, for a deployment admin who just entered their password, two steps for everyone and how long leavers and Activity are kept. AUGUR's own services read the retention at `GET /v1/organisation/policy`. The realm job applies the notice, languages, two steps for everyone and the organisation's name to Keycloak; the sign-in pages show the name and logo kept in Admin.

  Admin → Organisation shows and changes them: a Logo section (drop a PNG), Sign-in notice, Languages, and Security and retention, which says who can change it and asks for the password again when it's needed. Activity says what changed in words.

## 0.1.0

### Minor Changes

- 16cd6fa: Sign-in pages and emails in AUGUR's look (ADR 0041). Keycloak now runs from AUGUR's own image, which carries a Keycloakify theme built from Common's tokens and parts: every Keycloak sign-in page and email, showing the organisation's name (`ORG_NAME`) and, if set, its logo (`ORG_LOGO_URL`), with the product's name from the realm. The realm job turns the theme on when Keycloak has it and offers the languages in `REALM_LANGUAGES` (default `en`).
