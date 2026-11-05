# Your account

Each person manages themselves in the shell's Account area ([ADR 0036](decisions/0036-account-area-in-the-shell.md)). Who they are lives in Keycloak's user profile; how AUGUR behaves for them lives in identity's preferences ([ADR 0039](decisions/0039-profile-in-keycloak-preferences-in-identity.md)).

## The API

Identity serves the account under `/v1/me/*`, behind the gateway, for the signed-in caller only (`contracts/identity.openapi.yaml`, `platform/services/identity/src/me.ts`). It reaches Keycloak through the admin API with its own client (`platform-identity`, `IDENTITY_RIGHTS` in `realm.ts`), never Keycloak's account REST API.

| Path | What it does |
| --- | --- |
| `GET /me/profile`, `PATCH /me/profile` | Name, job title, phone, pronouns and picture. Fields an organisation sign-in sets at every sign-in (one whose sync mode is `FORCE`) are listed in `managed` and refused with 409 and the sign-in's name. |
| `GET /me/security` | Password, code apps, passkeys, recovery codes, whether their role needs two-step sign-in, linked organisation sign-ins, and the `kc_action` for each change. |
| `GET /me/sessions`, `DELETE /me/sessions/{id}`, `DELETE /me/sessions?keep=` | Where they're signed in, and signing out of one, everywhere else, or everywhere. A session that isn't theirs is not found. |
| `GET /me/sign-ins` | Recent sign-ins, failed sign-ins and changes to how they sign in, from Keycloak's events (kept for `REALM_SIGN_IN_EVENT_DAYS`). |
| `GET /me/preferences`, `PUT /me/preferences` | Motion, density, away (with a message and an end), time zone, and notification choices. |

Without a connected Keycloak, everything but preferences answers 503 and says a deployment admin can connect it.

## Changing a credential

Identity never changes a password, a code app, a passkey, recovery codes or the email address itself. `GET /me/security` names Keycloak's application-initiated action for each (`UPDATE_PASSWORD`, `CONFIGURE_TOTP`, `webauthn-register-passwordless`, `CONFIGURE_RECOVERY_AUTHN_CODES`, `UPDATE_EMAIL`, `delete_credential:<id>`, `idp_link:<alias>`). The shell signs in again with `kc_action` set to it; Keycloak shows its own screen (in AUGUR's sign-in theme) and returns with `kc_action_status`. The realm job turns each of these actions on.

Someone whose role needs two-step sign-in (ADR 0038) can't remove their last code app or passkey: the summary marks it, with the reason. Someone who signs in through their organisation and has no password here is told their password is changed there.
