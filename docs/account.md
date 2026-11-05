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
| `GET /me/preferences`, `PUT /me/preferences` | Motion, density, away (with a message and an end), time zone, notification choices, pinned apps and the floor to start on. |

Without a connected Keycloak, everything but preferences answers 503 and says a deployment admin can connect it.

## Changing a credential

Identity never changes a password, a code app, a passkey, recovery codes or the email address itself. `GET /me/security` names Keycloak's application-initiated action for each (`UPDATE_PASSWORD`, `CONFIGURE_TOTP`, `webauthn-register-passwordless`, `CONFIGURE_RECOVERY_AUTHN_CODES`, `UPDATE_EMAIL`, `delete_credential:<id>`, `idp_link:<alias>`). The shell signs in again with `kc_action` set to it; Keycloak shows its own screen (in AUGUR's sign-in theme) and returns with `kc_action_status`. The realm job turns each of these actions on.

Someone whose role needs two-step sign-in (ADR 0038) can't remove their last code app or passkey: the summary marks it, with the reason. Someone who signs in through their organisation and has no password here is told their password is changed there.

## The Account area in the shell

Account on the shell's arc opens the Account area (`platform/frontends/shell/src/account/`) over whatever is on screen, in an app's frame, at `?account=<section>`, so a reload or a trip to one of Keycloak's screens comes back to the same section. Escape or Close puts the screen back as it was. Settings is no longer a separate view: its switches are under Appearance.

| Section | What's in it |
| --- | --- |
| Profile | Name, job title, phone and pronouns, saved as each field is left; the email address, changed on Keycloak's screen; away, with what it says and when it ends; sign out. |
| Sign-in and security | Password, code apps, passkeys and recovery codes, each changed on Keycloak's screen; the organisation sign-ins to link; where you're signed in, with sign out there or everywhere else (the shell knows its own session by the `sid` claim in its token); recent sign-ins. |
| Notifications | Email for things that need you, a digest, quiet hours, and On Home or Quiet for each app and each kind of notification it names. AUGUR doesn't send email yet, and the section says so. |
| Appearance | Reduce motion, area titles, toasts and density. |
| Language and region | Time zone (the browser's unless chosen). English only for now, and it says so. |
| Home and apps | The floor AUGUR opens on at its front door (`startFloor`; their own unless chosen, and a floor that is no longer theirs says so); pinned apps, first on Home and in the list of apps (`pinned`); recent apps, with a way to clear them; and each app's own settings. |
| About and help | What's running, and the keys. |

Privacy and data is still to come (PER-193). An app that names its kinds of notification in its manifest (`notifications.kinds`) lists them under it, each On Home or Quiet (`quietKinds`, as `<app>:<kind>`); a quiet kind lands in the stream without a pulse, uncounted, and never on Home or as a toast.

Coming back from Keycloak's screen, the shell's sign-in callback adds `kc_action_status` to the address it returns to, and the section says once whether the change was made.

### An app's own settings

An app adds settings for each person with a `settings` surface in its manifest, like a Home card (`{ "floor": "personal", "slot": "settings", "module": "./Settings" }`), and exports that module in its entry's `surfaces`. Home and apps shows one section per app on the floor that has one: the surface for this kind of floor, or else its personal one. The shell mounts it with the same context as the app, so the app keeps the choices in its own service. A surface that fails to mount says so in its section and leaves the others alone.
