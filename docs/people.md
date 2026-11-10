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
| Unlock | For someone **Locked** after 10 wrong passwords in a row: they can sign in again at once, without waiting out Keycloak's lockout (up to 15 minutes) | `person.unlocked`, with `failures` | nothing |
| Set their last day | The leaver flow below, set to run once their last day (today to 90 days ahead, in the organisation's time zone) is over. Until then nothing changes for them and People shows **Leaving {date}**; setting it again moves the day, and **Cancel leaving** takes it away. Identity checks every five minutes and runs it as the admin who set it | `person.leave-scheduled` (`lastDay`, `handOverTo`), `person.leave-cancelled`; when it runs, as below with `lastDay` | nothing until it runs, then as below |
| **They're leaving** (the leaver flow) | Their sign-in goes off, they're signed out everywhere, and apps are told to hand on what they own, to the person the admin chose to hand it to, or to keep it until someone takes it on. Their teams, roles and history stay until the deployment's retention period ends. A request to leave from their account is closed | `person.disabled` (if it was on), then `person.left` with `handOverTo`, `asked` and the admin's note | `platform.person.disabled`, then `platform.person.left` `{ person, handOverTo? }` |

The flow isn't over until Activity has it, because that is how apps hear. If the events service can't be reached, **They're leaving** answers that it isn't finished, and identity carries it on within five minutes; the same goes for **Delete their account now**. Someone named to take on the work who can't sign in by the time the flow runs (they left, or were turned off) doesn't get it: the work stays with the leaver for someone to hand on, and admins are told.

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

Three more words in People come from flags on an active person rather than a state of their own:

| Flag | When | Shown in People |
| --- | --- | --- |
| `locked` | Keycloak locked them out for wrong passwords (a copied `sign-in.locked`), they haven't signed in since, and the realm's longest wait (15 minutes) hasn't passed. A person's dialog asks Keycloak itself (`lockout` on `GET /admin/people/{id}`) | Locked |
| `leaving` | A last day is set and the leaver flow hasn't run yet | Leaving {date} |
| `idle` | When their sign-in turns off for being idle: `warnsAt` and `turnsOffAt`, counted from their last sign-in with the organisation's days, and `warned` once the warning day has passed. Or `exempt`, and why it won't: `off` (idle accounts are off), `no-email` (nobody could be warned), `deployment-admin`, or `not-tracked` (AUGUR hasn't seen them sign in, so the count starts at their next sign-in) | Idle, once warned |

A person's dialog lists all of it under **Their account**: state, last sign-in, when they were added, the invite's end, a lockout, the idle warning and turn-off days or why there are none, and their last day or the day they left.

Last sign-in starts when identity first runs with this version. Before that, People says "Not seen yet".

### Idle accounts

Admin → Organisation keeps when idle accounts are dealt with: a warning email after 60 days without a sign-in and the sign-in turned off at 90, unless an admin changes them or turns it off (`idle` in `/v1/organisation`). The turn-off is at least 7 days after the warning, and at most 730 days. Every sign-in starts the count again.

The realm job (ADR 0057) applies them as Keycloak's idle-account Workflow, `augur-idle-accounts-{warning}-{turn-off}`, each time AUGUR starts or upgrades, so a change in Admin applies then:

- Keycloak enrols a person at each sign-in (`user-authenticated`), and starts their count again at the next one. People who haven't signed in since the Workflow was made aren't counted until they do.
- After the warning days it sends its own "Account Disable Warning" email, in the person's language and AUGUR's email theme, saying how many days are left; at the turn-off days it turns their sign-in off.
- Deployment admins are left out, so a deployment can't lose its last admin by their being away. Service accounts never enrol.
- New days make a new Workflow and the old one is deleted, because Keycloak won't change steps people are waiting on. Deleting cancels what was waiting, so a change only ever delays a turn-off.
- Without email (no `SMTP_HOST` and no relay in Keycloak's console) there is no Workflow, as nobody could be warned. Idle accounts off in Admin takes it away too. A Keycloak without Workflows (before 26.6) is warned about in the realm job's log and left alone.

Keycloak's Workflow ends no sessions and tells nobody, so identity notices the turn-off (below), ends their sessions and records it in Activity as "turned off after 90 days without a sign-in", with `detail.cause` `idle`.

### Changes made in Keycloak itself

Someone's sign-in can be turned off or on in Keycloak's admin console, and later by Keycloak's idle-account Workflow; neither ends their sessions or tells AUGUR. Every five minutes identity compares each account's sign-in with what it last knew (one identity copy at a time). For each one that changed it ends their sessions (when turned off), keeps the change, and records `person.disabled` or `person.enabled` in Activity with actor `keycloak` (a service) and `detail.outside: true`, so followers hear `platform.person.disabled` or `platform.person.enabled` as they do for an admin's change. Activity says "Sam's sign-in was turned off in the sign-in service, not in AUGUR".

The first comparison only takes note: accounts already off then are kept as off with no cause, and nothing is announced. A leaver turned back on in the console is left alone; People still shows them as left.

## Signing in with the organisation's Entra

Where a deployment has set up Entra (docs/deploy.md, Entra), someone's first sign-in through it links them to the account with the same email, or makes one when nobody has it, with no AUGUR password asked for. An account that must sign in with two steps (everyone, when two steps for everyone is on) is never linked this way: the sign-in is refused and says why, and they go on signing in with their password and second step. From then on `source` is `federated` and their dialog says they sign in with the organisation's sign-in; their name and email follow Entra. An account made this way is recorded as `person.added` with `method: 'federated'` by Keycloak (Activity: "Sam joined through the organisation's sign-in"), so followers hear `platform.person.joined` as for anyone an admin adds; it starts with no roles or teams.

## Deleting leavers' accounts

A leaver's account is deleted once the organisation's leaver retention has passed (Admin → Organisation, Security and retention, 90 days unless changed; ADR 0072). Identity checks every five minutes. People shows the day on a leaver as **Account deleted**. A deployment admin who entered their password in the last 10 minutes can also **Delete their account now** on a leaver (`DELETE /admin/people/{id}`; `401 sign_in_again` otherwise, and 409 for someone who hasn't left).

The steps run in this order, and each is kept, so one that fails is carried on from where it stopped five minutes later: Activity removes their personal values and their notifications, the notice telling admins they asked to leave and the notes they left on inbox items, and withdraws the open inbox items that were theirs (the events service's redaction, `audit.redacted`), identity forgets their preferences and request to leave, takes them off their teams, and renames and archives their own floor as "Deleted person", then Keycloak deletes the account. Only then is `person.deleted` recorded (with `now` when an admin chose it), which followers hear as `platform.person.deleted` `{ person }`. Activity is redacted once more just before that, for a sign-in copied across since. The registry, following `platform.person.deleted`, forgets their name on the upgrades they asked for. Their id stays in Activity, with nothing kept in AUGUR that maps it back to them.

Keycloak's own event stores are the exception. Keycloak can't remove one person's events, so its sign-in events (with IP addresses) stay for `REALM_SIGN_IN_EVENT_DAYS`, 90 or more, and its admin events (with their name and email, from AUGUR's changes to the account) for `REALM_ADMIN_EVENT_DAYS`, 365 or more. Only someone with Keycloak's console can read them. Backups keep what they held until they age out.

## For apps

`followLeavers` in the service kit follows both events below ([Domain events](domain-events.md#when-someone-leaves)). Follow `platform.person.left` (`PLATFORM_TOPICS.personLeft`). When `handOverTo` is there, move what the leaver owns to that person, or offer it to them. When it isn't, keep it and show it as the leaver's until an admin or a team lead hands it on. Team inbox items a person had taken go back to their team when their sign-in goes off (docs/inbox.md).

Follow `platform.person.deleted` (`PLATFORM_TOPICS.personDeleted`) too: delete or anonymise anything personal you still keep about them. Their id is all that's left.

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

Identity's `/v1/admin` paths, in [contracts/identity.openapi.yaml](../contracts/identity.openapi.yaml): `POST /admin/people` (`start`; answers `invite` and, for a one-time password, `temporaryPassword`), `POST /admin/people/{id}/invite`, `GET /admin/lifecycle` (`email`), `PATCH /admin/people/{id}` (`enabled: false` signs them out everywhere), `POST /admin/people/{id}/leave` (`handOverTo`, `note`, `lastDay`), `DELETE /admin/people/{id}/leave` (cancel a last day), `POST /admin/people/{id}/unlock`, `DELETE /admin/people/{id}` (delete a leaver now) and `GET /admin/leave-requests`. `GET /admin/lifecycle` also answers `today` in the organisation's time zone and `lastDayAhead`.
