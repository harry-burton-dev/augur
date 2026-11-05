# People: joining, changing and leaving

How a person's account moves through AUGUR, for admins in Admin → People and for apps that follow it (ADR 0040). Keycloak holds the sign-in; identity holds teams and asks Keycloak for the rest.

## What an admin does in Admin → People

| Step | What happens | Recorded in Activity as | Followers hear |
| --- | --- | --- | --- |
| Add someone | They get a one-time password to sign in with, then choose their own. Email invites come with the email work (PER-189) | `person.added` | `platform.person.joined`, and `platform.team.member-added` for each team |
| Change their details, teams or roles | Only what was changed, with before and after | `person.updated` | `platform.person.changed` (which fields, never the values) |
| Turn their sign-in off | They can't sign in, and they're **signed out everywhere at once**: every session, and every offline token an app holds for them. Turning it off again signs them out again, so an admin can retry if Keycloak couldn't be reached | `person.disabled` | `platform.person.disabled` |
| Turn their sign-in on | They can sign in again | `person.enabled` | `platform.person.enabled` |
| A new one-time password | Their old password stops working | `person.password-reset` | nothing |
| **They're leaving** (the leaver flow) | Their sign-in goes off, they're signed out everywhere, and apps are told to hand on what they own, to the person the admin chose to hand it to, or to keep it until someone takes it on. Their teams, roles and history stay until the deployment's retention period ends. A request to leave from their account is closed | `person.disabled` (if it was on), then `person.left` with `handOverTo`, `asked` and the admin's note | `platform.person.disabled`, then `platform.person.left` `{ person, handOverTo? }` |

People don't delete their own account. They ask to leave in their account (Privacy and data, docs/account.md); admins are told once, People marks them **Asked to leave**, and the leaver flow closes the request.

Rules that hold for every step: an admin can't turn off their own sign-in, take away their own admin role or run the leaver flow on themselves, and only a deployment admin can do any of these to a deployment admin. Work is handed only to someone else whose sign-in is on.

## For apps

Follow `platform.person.left` (`PLATFORM_TOPICS.personLeft` in the service kit). When `handOverTo` is there, move what the leaver owns to that person, or offer it to them. When it isn't, keep it and show it as the leaver's until an admin or a team lead hands it on. Team inbox items a person had taken go back to their team when their sign-in goes off (docs/inbox.md).

## Activity

Admin → Activity shows every entry in the audit log, filtered by who, where, floor and when. **Download CSV** gives the entries the filters show, newest first, up to 50,000 at a time (narrow the dates for more), from the events service's `GET /v1/audit/export`. A lead can export their own floor's. The columns are id, at, actor, actor kind, recorded by, app, action, target, floor and detail (as JSON), and a cell a spreadsheet would read as a formula starts with an apostrophe. Each export is recorded too, as `audit.exported`.

Activity is kept for good unless the deployment sets `AUDIT_KEEP_DAYS` in `.env`. Then the events service removes older entries once a day.

## The API

Identity's `/v1/admin` paths, in [contracts/identity.openapi.yaml](../contracts/identity.openapi.yaml): `PATCH /admin/people/{id}` (`enabled: false` signs them out everywhere), `POST /admin/people/{id}/leave` (`handOverTo`, `note`) and `GET /admin/leave-requests`.

## Not built yet

Email invites, idle accounts turning off on their own (60 and 90 days), deletion after retention with `platform.person.deleted`, linking an Entra first sign-in by verified email, and sign-in events in Activity. Each comes with PER-194.
