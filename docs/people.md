# People: joining, changing and leaving

How a person's account moves through AUGUR, for admins in Admin → People and for apps that follow it (ADR 0040). Keycloak holds the sign-in; identity holds teams and asks Keycloak for the rest.

## What an admin does in Admin → People

| Step | What happens | Recorded in Activity as | Followers hear |
| --- | --- | --- | --- |
| Add someone | **How they start:** an invite email (the default when email works) with a link that lasts 72 hours to confirm their email and choose a password, or a one-time password the admin gives them. If the account is made but the email can't go, Admin says so; send it again or give a one-time password | `person.added`, with `method` (`email` or `temporary-password`) | `platform.person.joined`, and `platform.team.member-added` for each team |
| Send a new invite | For someone still Invited: a new link for 72 hours, and the old one stops working. After 72 hours People shows **Invite expired** | `person.invite-resent` | nothing |
| Change their details, teams or roles | Only what was changed, with before and after | `person.updated` | `platform.person.changed` (which fields, never the values) |
| Turn their sign-in off | They can't sign in, and they're **signed out everywhere at once**: every session, and every offline token an app holds for them. Turning it off again signs them out again, so an admin can retry if Keycloak couldn't be reached | `person.disabled` | `platform.person.disabled` |
| Turn their sign-in on | They can sign in again | `person.enabled` | `platform.person.enabled` |
| A new one-time password | Their old password stops working | `person.password-reset` | nothing |
| **They're leaving** (the leaver flow) | Their sign-in goes off, they're signed out everywhere, and apps are told to hand on what they own, to the person the admin chose to hand it to, or to keep it until someone takes it on. Their teams, roles and history stay until the deployment's retention period ends. A request to leave from their account is closed | `person.disabled` (if it was on), then `person.left` with `handOverTo`, `asked` and the admin's note | `platform.person.disabled`, then `platform.person.left` `{ person, handOverTo? }` |

People don't delete their own account. They ask to leave in their account (Privacy and data, docs/account.md); admins are told once, People marks them **Asked to leave**, and the leaver flow closes the request.

Rules that hold for every step: an admin can't turn off their own sign-in, take away their own admin role or run the leaver flow on themselves, and only a deployment admin can do any of these to a deployment admin. Work is handed only to someone else whose sign-in is on.

## Where each account stands

People shows each person's state and their last sign-in. Identity works the state out from Keycloak (is their sign-in on, have they chosen a password) and from what it keeps in `identity.person_lifecycle`: first and last sign-in (from the sign-ins it copies, below), why the sign-in went off, and that they left.

| State | When | Shown in People |
| --- | --- | --- |
| `invited` | Added, and no sign-in seen yet | Invited (or Invite expired), last sign-in "Never" |
| `active` | Their sign-in is on and they have signed in, or were here before AUGUR kept sign-ins | Active |
| `disabled` | Their sign-in is off; `disabledCause` says why when AUGUR knows (`admin`, `leaver`; later `idle`) | Off |
| `left` | The leaver flow ran. It is for good: their sign-in can't be turned back on (409), and the flow can't run twice. Add them again if they return | Left, with the date and who took on their work |

Last sign-in starts when identity first runs with this version. Before that, People says "Not seen yet".

### Idle accounts

Admin → Organisation keeps when idle accounts are dealt with: a warning email after 60 days without a sign-in and the sign-in turned off at 90, unless an admin changes them or turns it off (`idle` in `/v1/organisation`). The turn-off is at least 7 days after the warning, and at most 730 days. Every sign-in starts the count again. The days are kept now; the sign-in service's idle-account Workflow that applies them comes in a later release, and Admin says so.

### Changes made in Keycloak itself

Someone's sign-in can be turned off or on in Keycloak's admin console, and later by Keycloak's idle-account Workflow; neither ends their sessions or tells AUGUR. Every five minutes identity compares each account's sign-in with what it last knew (one identity copy at a time). For each one that changed it ends their sessions (when turned off), keeps the change, and records `person.disabled` or `person.enabled` in Activity with actor `keycloak` (a service) and `detail.outside: true`, so followers hear `platform.person.disabled` or `platform.person.enabled` as they do for an admin's change. Activity says "Sam's sign-in was turned off in the sign-in service, not in AUGUR".

The first comparison only takes note: accounts already off then are kept as off with no cause, and nothing is announced. A leaver turned back on in the console is left alone; People still shows them as left.

## For apps

Follow `platform.person.left` (`PLATFORM_TOPICS.personLeft` in the service kit). When `handOverTo` is there, move what the leaver owns to that person, or offer it to them. When it isn't, keep it and show it as the leaver's until an admin or a team lead hands it on. Team inbox items a person had taken go back to their team when their sign-in goes off (docs/inbox.md).

## Sign-ins in Activity

Identity copies Keycloak's sign-in events into Activity each minute, so they share its filters, download and retention (docs/observability.md, Activity). Each entry is under app `identity`, about the person it happened to, with `detail.kind` `sign-in`; Activity's Sign-ins filter is `kind=sign-in`.

| Keycloak event | Activity action | Detail |
| --- | --- | --- |
| `LOGIN` | `sign-in.succeeded` | `client`, `ip`, `method` (`password`, `passkey` or `federated`) |
| `LOGIN_ERROR` for someone who has an account | `sign-in.failed` | `client`, `ip`, `error` |
| `LOGIN_ERROR` for a name nobody has | `sign-in.failed-unknown`, by identity itself, counted per hour | `count`, `ips` (at most 20). The name that was tried is not kept |
| `USER_DISABLED_BY_TEMPORARY_LOCKOUT` | `sign-in.locked` | `ip` |
| `LOGOUT` | `sign-in.signed-out` | `client` |
| `UPDATE_PASSWORD`, or `UPDATE_CREDENTIAL` for a password | `account.password-changed` | |
| `UPDATE_TOTP`, `UPDATE_CREDENTIAL` | `account.two-step-added` | `credential` |
| `REMOVE_TOTP`, `REMOVE_CREDENTIAL` | `account.two-step-removed` | `credential` |
| `UPDATE_EMAIL` | `account.email-changed` | `email` `{ from, to }`, removed when the person is deleted |
| `VERIFY_EMAIL` | `account.email-verified` | |
| `IDENTITY_PROVIDER_FIRST_LOGIN` | `sign-in.federated-first` | `provider` |
| `FEDERATED_IDENTITY_LINK` | `sign-in.linked` | `provider` |

Every entry also keeps `at` (when Keycloak recorded it) and `keycloakEvent`. Copying starts when identity first runs with this version: what Keycloak held before stays only in Keycloak, for `REALM_SIGN_IN_EVENT_DAYS`. Where it got to is kept in `identity.sign_in_cursor`, so a restart never copies one twice, and with several identities only one copies at a time. If identity can't read events (its sign-in lacks `view-events`; the realm job gives it), it says so in its log each minute and Activity has no sign-ins.

## Invites need email

Keycloak sends the invite, through the realm's relay (`SMTP_*` in `.env`, docs/deploy.md, Email). Without one, Admin offers only the one-time password and says why, and `start: email` answers 400. The link ends in AUGUR: the shell's sign-in at the address in `OIDC_ISSUER`.

## The API

Identity's `/v1/admin` paths, in [contracts/identity.openapi.yaml](../contracts/identity.openapi.yaml): `POST /admin/people` (`start`; answers `invite` and, for a one-time password, `temporaryPassword`), `POST /admin/people/{id}/invite`, `GET /admin/lifecycle` (`email`), `PATCH /admin/people/{id}` (`enabled: false` signs them out everywhere), `POST /admin/people/{id}/leave` (`handOverTo`, `note`) and `GET /admin/leave-requests`.

## Not built yet

Idle accounts turning off on their own (60 and 90 days), deletion after retention with `platform.person.deleted`, linking an Entra first sign-in by verified email, and Locked, Idle and Leaving states on People. Each comes with PER-194.
