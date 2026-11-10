# Your account

Each person manages themselves in the shell's Account dialog (ADR 0036). Who they are lives in Keycloak's user profile; how AUGUR behaves for them lives in identity's preferences (ADR 0039).

## The API

Identity serves the account under `/v1/me/*`, behind the gateway, for the signed-in caller only (`contracts/identity.openapi.yaml`, `platform/services/identity/src/me.ts`). It reaches Keycloak through the admin API with its own client (`platform-identity`, `IDENTITY_RIGHTS` in `realm.ts`), never Keycloak's account REST API.

| Path | What it does |
| --- | --- |
| `GET /me/profile`, `PATCH /me/profile` | Name, job title, phone, pronouns, picture and language (`locale`, one of the `languages` the deployment offers, from `REALM_LANGUAGES`). Fields an organisation sign-in sets at every sign-in (one whose sync mode is `FORCE`) are listed in `managed` and refused with 409 and the sign-in's name. |
| `GET /me/security` | Password, code apps, passkeys, recovery codes, whether they must sign in with a second step, linked organisation sign-ins, and the `kc_action` for each change. |
| `GET /me/sessions`, `DELETE /me/sessions/{id}`, `DELETE /me/sessions?keep=` | Where they're signed in, and signing out of one, everywhere else, or everywhere. A session that isn't theirs is not found. |
| `GET /me/sign-ins` | Recent sign-ins, failed sign-ins and changes to how they sign in, from Keycloak's events (kept for `REALM_SIGN_IN_EVENT_DAYS`). |
| `GET /me/preferences`, `PUT /me/preferences` | Motion, density, away (with a message and an end), time zone, notification choices, pinned apps and the floor to start on. |
| `GET /me/leave`, `POST /me/leave`, `DELETE /me/leave` | Asking to leave, with a note, and taking it back. People don't delete their own account (ADR 0040): admins are told once (a notification that needs them, from Admin) and an admin's leaver flow closes it ([people.md](people.md)). Each is recorded in Activity. |
| `GET /me/data` | A copy of what AUGUR keeps about them, as a JSON file: profile, credentials (their kind and label, never a secret), linked sign-ins, sessions, sign-ins, preferences, the request to leave, and from events their notifications, inbox and Activity (`GET /v1/people/{id}/data`, which only identity may call). A part it can't read is named in `missing`, with why. Apps' own content, such as documents, isn't in it yet. Each download is recorded in Activity. |

Without a connected Keycloak, everything but preferences answers 503 and says a deployment admin can connect it.

## Changing a credential

Identity never changes a password, a code app, a passkey, recovery codes or the email address itself. `GET /me/security` names Keycloak's application-initiated action for each (`UPDATE_PASSWORD`, `CONFIGURE_TOTP`, `webauthn-register-passwordless`, `CONFIGURE_RECOVERY_AUTHN_CODES`, `UPDATE_EMAIL`, `delete_credential:<id>`, `idp_link:<alias>`). The shell signs in again with `kc_action` set to it; Keycloak shows its own screen (in AUGUR's sign-in theme) and returns with `kc_action_status`. The realm job turns each of these actions on.

Someone who must sign in with two steps (when the organisation asks everyone, ADR 0098) can't remove their last code app or passkey: the summary marks it, with the reason. Someone who signs in through their organisation and has no password here is told their password is changed there.

## The Account dialog in the shell

Account on the shell's menu opens the Account dialog (`platform/frontends/shell/src/account/`) over the menu, which stays open behind it: Escape or Back to the menu closes it back to the menu. That is the only way in. An address doesn't open it, because Account isn't a place; the one exception is coming back from one of Keycloak's screens (below), which opens the menu and the dialog at the section it left from, once. Settings is no longer a separate view: its switches are under Appearance.

It is built from Common's parts for a place to work in that never scrolls: `SectionDialog` (its sections as tabs down the side, with Overview first), `FitParts` (each section's parts side by side while each has the `part-min-width` token, the rest behind a switch), `CheckList`, `StepList` and `PagedList`. At 1280×720, 1024×768 and 800×600 nothing in it scrolls or is cut off (`platform/contract/tests/account.spec.ts`).

| Section | What's in it |
| --- | --- |
| Overview | Who you are, away and sign out; and the account check: two-step sign-in (lit when the organisation asks for it and it isn't set up, as is the tab), recovery codes, email, where you're signed in and failed sign-ins in the last 7 days, each with a way to it. Something's wrong? walks through securing the account: change the password, sign out everywhere else, check how you sign in, read the sign-ins, tell an administrator. |
| Profile | Name, job title, phone and pronouns, saved as each field is left; the email address, changed on Keycloak's screen; away, with what it says and when it ends; sign out. |
| Sign-in and security | Password, code apps, passkeys and recovery codes, each changed on Keycloak's screen; the organisation sign-ins to link; where you're signed in, with sign out there or everywhere else (the shell knows its own session by the `sid` claim in its token); recent sign-ins, with every one a page at a time; and whether changes to how they sign in are emailed, and where (Keycloak's email listener, on whenever the deployment has a relay). |
| Notifications | Email for things that need you, a digest, quiet hours, and On Home or Quiet for each app and each kind of notification it names. It says whether email reaches them: where it goes, or why not (no mail relay on the deployment, no address yet, or an address not checked yet) and who can change it. Email itself is in [notifications.md](notifications.md#email). |
| Appearance | Reduce motion, area titles, toasts and density. |
| Language and region | Their language, from the ones the deployment offers (`REALM_LANGUAGES`, the same as sign-in; kept as their `locale`, so sign-in pages and emails use it; with one language offered it says so and who can offer more); how dates and times are written (`dateFormat`, a region such as en-GB, and `clock`, 12- or 24-hour, each with an example); and the time zone (unless they choose one, the organisation's from Admin → Organisation, else the browser's; the section says which they follow). AUGUR's own words are in English for now, and it says so. |
| Home and apps | The floor AUGUR opens on at its front door (`startFloor`; their own unless chosen, and a floor that is no longer theirs says so); pinned apps, first on Home and in the list of apps (`pinned`); recent apps, with a way to clear them; and each app's own settings. |
| Privacy and data | Download my data; what others see about you (name and email to everyone signed in, through the people picker; away to everyone, beside your name; the rest to you and administrators); and asking to leave, pressed twice, with a way to take it back. |
| About and help | What's running, and the keys. |

An app that names its kinds of notification in its manifest (`notifications.kinds`) lists them under it, each On Home or Quiet (`quietKinds`, as `<app>:<kind>`); a quiet kind lands in the stream without a pulse, uncounted, and never on Home or as a toast.

The shell writes every date and time it shows through `host/formats.ts`: the person's `dateFormat`, else their language (their choice here, else the `locale` their sign-in carries), else the browser's; in their time zone, else the organisation's (`GET /v1/organisation`, ADR 0042), else the browser's; with their clock. Apps don't get these yet.

Each change on Keycloak's screen returns to `?account=<section>`. The shell's sign-in callback adds `kc_action_status`, and only with both does the shell open the menu and the dialog at that section; it says once whether the change was made, then takes both out of the address.

### An app's own settings

An app adds settings for each person with a `settings` surface in its manifest, like a Home card (`{ "floor": "personal", "slot": "settings", "module": "./Settings" }`), and exports that module in its entry's `surfaces`. Home and apps lists each app on the floor that has one, and Open shows it: the surface for this kind of floor, or else its personal one. The shell mounts it with the same context as the app, so the app keeps the choices in its own service. A surface that fails to mount says so and leaves the rest of Account alone.
