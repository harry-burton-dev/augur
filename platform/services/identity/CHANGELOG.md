# @augur/identity

## 1.4.0

### Minor Changes

- c0de29b: Email comes from the organisation's sender (Admin → Organisation) instead of SMTP_FROM and the product's name. The service kit's `Mailer` takes a `sender` lookup (`organisationSender` reads identity's `GET /v1/organisation`), Admin → Status shows the name and address mail comes from, and the realm job gives Keycloak the same sender on every run.

### Patch Changes

- Updated dependencies [c0de29b]
- Updated dependencies [8eba62b]
- Updated dependencies [ab9f61f]
  - @augur/service-kit@0.16.0

## 1.3.0

### Minor Changes

- 2d1735f: People show where their account stands (invited, active, off, left) and their last sign-in. A leaver's sign-in can't be turned back on, and the leaver flow runs once (docs/people.md).
- ce49d5c: Sign-ins, failed sign-ins and changes to how someone signs in are copied from Keycloak into Activity each minute, under `detail.kind` `sign-in` (docs/people.md). Failed sign-ins for names nobody has are counted per hour without the name.

### Patch Changes

- ff6baec: Identity keeps everything in Postgres, locally too: the in-memory copies of its preference, floor and organisation stores are gone, and it won't start without `DATABASE_URL`. Its tests run on real Postgres (PER-271).
- Updated dependencies [833b4ed]
- Updated dependencies [431db38]
  - @augur/service-kit@0.15.0

## 1.2.0

### Minor Changes

- 8d5b585: Account's Home and apps section: the floor AUGUR opens on, pinned apps first on Home and in the list of apps, clearing recent apps, and each app's own `settings` surface. Identity's preferences keep `pinned` and `startFloor`.
- 54b0d26: Account, Language and region: choose your language from the ones the deployment offers (`REALM_LANGUAGES`, which identity now reads too; kept as the profile's `locale`, so sign-in pages and emails follow it), how dates and times are written (`dateFormat` and `clock` preferences), with examples. The shell writes its dates and times their way, in their time zone. Part of PER-193.
- eac9902: Account gets Privacy and data: download a copy of what AUGUR keeps about you (identity `GET /me/data`, with events' notifications, inbox and Activity from `GET /v1/people/{id}/data`), see who sees what about you, and ask to leave or take it back (`/me/leave`; admins are told once). Part of PER-193.
- 866c076: The leaver flow and signing out everywhere (ADR 0040, part of PER-194). Turning someone's sign-in off now signs them out everywhere at once: every Keycloak session and every offline token an app holds for them. Admin → People gets "They're leaving": their sign-in goes off, they're signed out, and identity records `person.left`, which the events service publishes as `platform.person.left` `{ person, handOverTo? }` so apps hand on what the leaver owns (`PLATFORM_TOPICS.personLeft`). People marks who asked to leave in their account, and the leaver flow closes the request (`GET /admin/leave-requests`, `POST /admin/people/{id}/leave`, identity contract 1.22.0). Guide: docs/people.md.
- 04d7ed1: Choosing notifications per kind (ADR 0036). The events service keeps a notification's `kind` and refuses one the app's manifest doesn't declare (migration 008). Identity's preferences keep `quietKinds` (`<app>:<kind>`). Account, Notifications lists each app's kinds, On Home or Quiet, and the shell lands a quiet kind in the stream without a pulse, uncounted, off Home and with no toast (Aerie 0.7.0). The service kit's `NewNotification` and `AppNotice` take `kind`.
- 0c6bf6a: Organisation settings (ADR 0042): `GET /v1/organisation` gives the organisation's name, time zone and email sender to anyone signed in and to any service, and `PATCH /v1/admin/organisation` lets an admin change them, audited as `organisation.changed`. The name is the organisation's floor's name, seeded once from `ORG_NAME`. Migration: adds `identity.organisation`.

### Patch Changes

- 2f2b01a: The rest of PER-213:

  - **Bounded caches.** The service kit's floor, people and grant lookups now remember at most 5,000 answers each (`BoundedMap`), dropping the least recently used one when full.
  - **Paged Keycloak lists.** Identity reads Keycloak's lists of people, groups, group members and role holders 500 at a time, so a realm with more than 10,000 people no longer loses the rest without a word.
  - **Query time limit.** `steadyPool` gives each new database connection a statement timeout: a minute by default, set with `DATABASE_STATEMENT_TIMEOUT_SECONDS`, 0 for no limit. A query stuck on a lock or a bad plan now fails its request instead of holding a connection. Migrations lift the limit for themselves.

- 9f6301f: Identity won't issue or set an app's sign-in under an id AUGUR keeps for itself (`reservedIdProblem`), as the registry and storage already refuse.
- 90057d9: Every call one service makes to another now has a deadline (PER-213). `withDeadline` and `serviceTimeoutMs` in the service kit give each call 5 seconds unless `SERVICE_CALL_TIMEOUT_SECONDS` says otherwise. The kit's helpers (callService, floors, people, grants, settings, the service token, domain events) use it, as do the gateway's calls to identity and the registry, identity's calls to Keycloak (15 seconds), storage's to Garage and the updater's to the registry. A hung service now gives the caller its usual "can't be reached" error, so it answers 503 within seconds rather than waiting minutes. Calls to the model gateway get 3 minutes, and frontend uploads get 2.
- 33b6fa3: AUGUR's own email sender (ADR 0065): `@augur/service-kit/mail` sends notice emails through the organisation's relay with Nodemailer, from React Email templates, and says why when it can't. The relay settings (`mailRelayFromEnv`) move into the service kit, shared with the realm job. The gateway's status now says whether email can be sent, and Admin → Status shows it with what to check.
- Updated dependencies [1f83a5f]
- Updated dependencies [2f2b01a]
- Updated dependencies [7886a1e]
- Updated dependencies [f902da5]
- Updated dependencies [866c076]
- Updated dependencies [04d7ed1]
- Updated dependencies [4f8d944]
- Updated dependencies [90057d9]
- Updated dependencies [858fad1]
- Updated dependencies [33b6fa3]
  - @augur/service-kit@0.14.0

## 1.1.0

### Minor Changes

- c55f1f3: Identity serves each person's own account under `/v1/me/*` for the shell's Account area (ADR 0036, PER-190): their profile from Keycloak's user profile, how they sign in and the `kc_action` that changes each credential, where they're signed in (sign out of one, everywhere else or everywhere), and their recent sign-ins. Preferences gain a time zone, an away message with an end, and notification choices. The realm job turns on Keycloak's update-email action and gives identity's client `view-events` and `view-identity-providers`, which only read.
- 2dbdc22: Apps hear more of what changes about people (PER-148). `platform.person.joined` when an admin adds someone, and `platform.person.changed` (`{ person, changed }`, naming which of `name`, `email`, `roles` and `teams` changed, never the values) when an admin changes their details. Every team someone joins or leaves is now `platform.team.member-added` or `-removed` on that team's floor, also when it happened by adding the person or changing their list of teams, which before sent nothing; each is in that floor's Activity too. `PLATFORM_TOPICS` names the two new topics. See docs/domain-events.md.
- dcae52f: The product's name is a deployment setting, `ORG_PRODUCT_NAME` (default AUGUR). The web container writes it into the shell's page, so the browser tab says it, and the realm job makes it the realm's display name, so the sign-in pages, Keycloak's emails (their subjects and AUGUR's layout) and passkey prompts show it.
- c2fe051: The realm job points Keycloak at the organisation's SMTP relay (`SMTP_*` in `.env`, ADR 0035) and, with one, turns on Forgot password and address checks; without one it leaves a relay set in the console and offers those only if there is one. The local stack catches all mail in Mailpit (ADR 0065).
- cceb953: People and teams for the people picker. Identity answers a signed-in person at `GET /v1/me/directory` (API 1.15): people by name or email and teams by name, or named by id. The SDK's new `searchPrincipals` and `namePrincipals` ask it through `ctx.fetch` and answer in the shape Quill's `PeoplePicker` takes, so an app hands one straight to the other. They reject with `DirectoryUnavailable`, whose message can be shown as it is.
- 16cd6fa: Sign-in pages and emails in AUGUR's look (ADR 0041). Keycloak now runs from AUGUR's own image, which carries a Keycloakify theme built from Common's tokens and parts: every Keycloak sign-in page and email, showing the organisation's name (`ORG_NAME`) and, if set, its logo (`ORG_LOGO_URL`), with the product's name from the realm. The realm job turns the theme on when Keycloak has it and offers the languages in `REALM_LANGUAGES` (default `en`).

### Patch Changes

- 3a7455e: The identity API's schemas are TypeBox, and contracts/identity.openapi.yaml is generated from them (ADR 0055). The contract now names the refusals the routes already sent.
- 566f261: The service kit has one migration runner, `runMigrations(pool, { schema, migrations })`, and the events, identity, models and registry services use it in place of their own copies; what they do at start is unchanged. New migrations are linted with Squawk (ADR 0053), which catches drops, renames and type changes the old check missed.
- Updated dependencies [7dbdf7b]
- Updated dependencies [2dbdc22]
- Updated dependencies [0ec750c]
- Updated dependencies [7518ce8]
- Updated dependencies [dec1a40]
- Updated dependencies [566f261]
- Updated dependencies [7517bd7]
  - @augur/service-kit@0.13.0

## 1.0.0

### Major Changes

- 783bd30: Keycloak 26.8.1, with the realm kept as code (ADR 0057). A new `keycloak-config` container, built from identity's image, sets the realm up on every `up`: a 15-character password floor checked against a breached-password list, a code app or passkey as a second step for admins and deployment admins, passkeys in the sign-in form, 8-hour idle and 10-hour sessions, sign-in and admin events kept, the declared profile fields, the services' sign-ins and identity's rights. Identity loses `manage-realm` and no longer touches the realm's settings when it starts. Breaking: Keycloak's database migrates and can't go back without a restore, so take a backup first (docs/upgrade.md, "Keycloak 26.8 and the realm job").

### Patch Changes

- b3060e0: Every platform service answers errors as RFC 9457 problem details (`application/problem+json`) with AUGUR's `reason` and `whoCanChange`, and keeps `error` and `message` for SDK 1.x clients. The service kit adds `problemDetails()`, `Problem`, `sendProblem` and `serviceFastifyOptions()`. A service's unexpected errors are logged and answered with a plain 500, never with their own words.
- 8d48714: Fixes from the 2 Nov audit. In Admin → People, a person's sign-in (on or off, a new one-time password) sits in its own section that says it takes effect at once: each asks first, acts straight away and says what happened, while their name, email, department and roles change only on Save. Agents stay among the Shell's functions and say they aren't here yet, and Home keeps the card of an app this shell can't open, saying why and who can change it, instead of hiding either. Messages people read say AUGUR, not "the platform", and `pnpm check:reasons` now catches it. The centre menu's transitions stop for AUGUR's own reduced-motion setting as well as the system's and are timed from motion tokens; the lifecycle's divider uses the hairline token; overlay shadows use the shadow token. A new test holds the Lit kit and AUGUR's frontends to tokens only.
- 2478c1f: On a fresh server, Artifacts, Explorer and Data Atlas now start only after the realm job has made their sign-ins. Before, they could start too early. Then they failed to give the registry their frontends and register, and they never appeared in the shell until someone restarted them. The deploy test's new browser check found this.
- Updated dependencies [b3060e0]
  - @augur/service-kit@0.12.0

## 0.10.0

### Minor Changes

- 7927fd3: Identity no longer holds Keycloak's master admin password. The realm file gives identity's own sign-in its rights on a new server, and identity checks that it has them at start. If they're missing, it says how to repair them with `infra/deploy/identity-repair.yml` for one start.
- 7aa2c19: A service call that names no floor is checked on the organisation's floor, as the gateway already does, so an app that is off for the organisation can't act everywhere by naming none. Identity's `/v1/workspaces/org` names the organisation's floor.
- bab2360: Settings has a new switch, Toasts for new notifications, which is off by default. When it's on, each new notification is also shown once as an Aerie toast at the bottom of the screen, with Open. When it's off, the shell behaves as it does today: it only pulses. Identity keeps the choice as the `toasts` preference (identity contract 1.13.0).
- 2021f8a: Deployment admins now hear in the shell when a new AUGUR or app release is available, and deployment admins and admins hear when an upgrade or install finishes, fails or goes back by itself (ADR 0044). Platform services can address a notification to an `audience` such as `role:deployment-admin`, worked out by identity as it's sent, and any sender can give one a `key` so each person is told that news once (events contract 1.7.0, identity contract 1.14.0).

### Patch Changes

- 23a2f8f: Each platform service and Keycloak connects to Postgres with its own login, which owns only its own schema (Keycloak: its own database). The storage job makes the logins from `PLATFORM_DATABASE_LOGINS` and the `*_DATABASE_PASSWORD` settings, and hands each one what its service made as the admin login. The services make their schema only when it isn't there, since their own logins may not create schemas.
- Updated dependencies [137791c]
- Updated dependencies [2021f8a]
  - @augur/service-kit@0.11.0

## 0.9.0

### Minor Changes

- 5ab5009: Departments and teams are now two different levels. Teams right below the org are Departments, and those inside them are Teams. An admin can rename the levels, up to five, in Admin → Departments → Level names. The new `GET`/`PUT /v1/admin/levels` endpoints are audited as `levels.renamed` (identity contract 1.12.0), and a level deeper than the last name takes that name.

  Each floor's `level` reaches the shell and apps: identity's floors, and `WorkspaceRef.level` in SDK 1.9. Apps can say it where they'd say "team", and `kind` stays `team` at every level, so no app breaks.

  The shell names the level on the title card, the gauge, Account and the top left. A department also has its own icon and water colours, from the new tokens `floor-department-low` (violet) and `floor-department-high` (lavender, also its gauge mark). The kit adds `floorTone()`, `floorKindOf()`, `floorIconOf()` and `teamDepth()`, and `ShellFloorRef.level`.

### Patch Changes

- ea41136: Services stay up through a Postgres restart: a dropped idle connection is logged (`steadyPool` in the service kit) rather than ending the process, and the events service listens again on a new connection, so open notification streams don't go quiet for good.
- Updated dependencies [ea41136]
  - @augur/service-kit@0.10.0

## 0.8.0

### Minor Changes

- 8f69cb5: Moving between floors travels: what you're looking at leaves the way you're going (going up, it sinks away; going down, it rises away; across, it slides aside), the host waits for that before taking the app down, and the next floor comes in from the other side. Each arrival plays an area title card in place of the floor-name pill: the kind of floor, its name set large, and who sees what's there. Opening an app plays its card too, the app's name under the floor it opened on, once per app rather than on every page. Cards are built from the floor or app, never written by hand, leave off a kicker that would only repeat the name, ignore the pointer, end on any key, press or scroll, and fade out where they are. A new Area titles switch in Settings turns them off, saved with a person's preferences (`areaTitles` in Identity). `ui-shell` gains `leaveFloor()`; new tokens `travel-floor` (96px) and `motion-title` (2400ms); kit exports `floorKindName` and `FloorDirection`. Under reduced motion nothing travels and cards appear and fade in place.
- 5bb4315: `GET /v1/me/map`: your map of the org for Auspex. It lists the floors you can stand on with who's there and why you can come in, lets leads see into the teams inside theirs, and shows every other team as a closed door that names only itself, where it sits and its leads.

### Patch Changes

- Updated dependencies [f0d02e2]
- Updated dependencies [bbdad18]
  - @augur/service-kit@0.9.0

## 0.7.0

### Minor Changes

- d318840: Adds the Deployment Admin role (`deployment-admin`). Identity gives it to `PLATFORM_ADMIN_USER` when nobody has it, only a deployment admin can give it, take it away or change a holder's sign-in, and holders sign in with a one-time code as well as their password (identity sets this up in Keycloak's sign-in flow at start).
- 0a7f2dd: Identity manages the platform realm as its own Keycloak client, which can manage that realm alone, and uses Keycloak's master admin only at start to give it those rights. The realm now slows down repeated wrong passwords (brute-force protection), set in the realm import and turned on at start for existing servers.

### Patch Changes

- aa1724a: Services check their settings before they start. The service kit's `loadConfig` takes a list of the settings a service reads (`Setting`, plus `commonSettings` for the ones services share). In production, a missing required setting stops the service with one message listing every problem, instead of falling back to a `localhost` address. A secret can be given as a file in `<NAME>_FILE`. `describeConfig` reports each setting and where it came from, never a secret's value, ready for Admin → Deployment.
- Updated dependencies [aa1724a]
  - @augur/service-kit@0.8.0

## 0.6.0

### Minor Changes

- 476907a: Apps' secrets can be worked out instead of written into `.env`. With `APP_SECRETS_KEY` set, the storage container works out each app's database password and bucket secret from it and the app's id (`appSecretFor` in the service kit) when `.env` doesn't name them, and the app runner can set an app's sign-in to the secret it works out (`PUT /v1/admin/apps/{id}/credential`, the updater only). Secrets in `.env` still win.

### Patch Changes

- Updated dependencies [57d3760]
- Updated dependencies [476907a]
- Updated dependencies [ef587a4]
- Updated dependencies [a6b6bca]
- Updated dependencies [948526d]
  - @augur/service-kit@0.7.0

## 0.5.0

### Minor Changes

- 4608af1: Apps can look people up for sharing, with the new `people:read` scope. Identity says who a person stands for (`GET /v1/people/:id/principals`: `person:`, `team:` and `tree:` principals and `org`) and finds people and teams by name or names them by id (`GET /v1/directory`). The service kit's `identityPrincipals` (kept 30 seconds) and `identityDirectory` call them. Admin shows the scope as "Look up people and teams".
- 936bb00: A publisher role, for people who may publish beyond their own team (to the whole org, or any team). Identity adds it to the sign-in service when it starts, so existing servers get it too. Identity says who an audience reaches (`GET /v1/members?principals=`, `people:read`), which the service kit's `identityAudience` calls, and the directory's teams carry their `path` of team ids.

### Patch Changes

- Updated dependencies [f7fc3e6]
- Updated dependencies [94d0c0c]
- Updated dependencies [4608af1]
- Updated dependencies [936bb00]
  - @augur/service-kit@0.6.0

## 0.4.0

### Minor Changes

- b90f63b: Signed caller: the gateway signs the person it passes on (`x-augur-caller`, Ed25519, one minute, one service as audience) and publishes its key at `/api/gateway/v1/caller-keys`. The service kit's `signedCallers` hook drops unsigned `x-user-*` headers and puts back only the signed caller; the platform's services and new apps use it.

### Patch Changes

- Updated dependencies [ebb8b97]
- Updated dependencies [a3ba7ef]
- Updated dependencies [a09b413]
- Updated dependencies [b90f63b]
  - @augur/service-kit@0.5.0

## 0.3.1

### Patch Changes

- 8c0a9c8: Servers run released images instead of building them. Each AUGUR release now builds, pushes and signs (cosign, keyless) the web, gateway, identity, registry, events and models images to `ghcr.io/<repo>/<part>:<version>`, and its `augur-release.json` asset names each by digest. `infra/deploy/compose.yml` runs `${PLATFORM_IMAGES}/<part>:${PLATFORM_VERSION}` (new setting `PLATFORM_VERSION`, optional `PLATFORM_IMAGES` for a mirror); `compose.build.yml` builds from the checkout instead. The images run as unprivileged users, and the web container listens on 8080. See "Images from releases" in `docs/upgrade.md`.
- 1622cd9: The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.
- Updated dependencies [f090793]
- Updated dependencies [1622cd9]
  - @augur/service-kit@0.4.0

## 0.3.0

### Minor Changes

- b92585d: Admin app for people, departments and apps, so nobody needs Keycloak's console. Identity gains an admin API (`/v1/admin/people`, `/departments`, `/roles`) that manages people, roles and departments in Keycloak and audits every change; an admin can't turn off their own sign-in or remove their own admin role. The registry lists the whole catalogue for admins (`GET /v1/apps`) and lets them turn an app off and on (`PATCH /v1/apps/:id`); an app that is off stays off when it registers again. Admin now appears for admins. The UI kit adds `ui-select`, `ui-toggle` and `ui-checkbox-group`, four icons (`user-plus`, `department`, `key`, `plus`), and dialogs scroll inside instead of running off the screen.
- 2abdd1d: Apps sign in to the platform as themselves. An admin issues an app's own sign-in with `POST /v1/admin/apps/{id}/credential` on identity, which makes (or gives a new secret to) the Keycloak client `app-<id>`: client credentials only, 5-minute tokens for the `platform-services` audience, audited without the secret. The app's service gets it as `SERVICE_CLIENT_SECRET`; the service kit's `appCredentialsFromEnv`, `clientCredentials` and `serviceVerifier` sign in and check those tokens, and `notify`, `recordAudit` and `callService` can name the floor a call is for. Manifests gain `scopes` (`notifications:send`, `audit:write`). The registry lets an app register only itself, and tells platform services what an app is granted (`GET /v1/apps/{id}/grants?workspace=`): for now, what its manifest asks for on every floor, and nothing while it is off. Events lets an app notify and write the audit log only for itself and only with the scope on the call's floor (403 otherwise, 503 while it can't be checked), keeping each answer for 30 seconds. The shared `SERVICE_TOKEN` still works for now. The Library and new apps from `pnpm create-app` sign in as themselves when they have a secret.
- d14956f: An app can be on for one floor and off for another. The registry keeps three separate things: whether an app is turned on at all (as before), installs per floor in a new `registry.installs` table (on or off, carrying on to the teams below unless told not to), and guardrails in `registry.guardrails`, where a block on a floor wins over anything below it. Everyone's own floor follows the org. Manifests gain `floors` (the kinds of floor an app works on) and a checked `surfaces` block (page, card, panel, settings or admin per kind of floor, with an optional role and roll-up). `GET /v1/manifest?workspace=` lists the apps on for the floor the gateway checked, and grants now hold only where an app is on. Admins set floors with `PUT /v1/apps/{id}/floors/{workspace}` and see them with `GET /v1/apps/{id}/floors`; a new version asking for more scopes is served but gets them only after `PUT /v1/apps/{id}/scopes`. Identity tells platform services where a floor sits (`GET /v1/workspaces/{id}`, read with the service kit's `floorPlaces`) and offers the roll-up `GET /v1/me/workspaces/{id}/rollup`. The shell asks for the catalogue of the floor you're on and asks again when you move. Admin, Apps shows where each app is on, floor by floor, with a choice for each, and lets an admin allow scopes a new version asks for. Services need `IDENTITY_URL` (set in both compose files).
- d1f8c5e: Notifications and the audit log know their floor. A service call that names a floor records it on each notification and audit entry, with the floor's path from the root as it stood then (asked of identity), so "everything under Finance" stays right after a team moves. `GET /v1/audit?workspace=` filters to a floor and the floors below it; admins read the whole log and a lead their own floor's. Team notices are opt-in per team (`PUT /v1/team-notices/{workspace}`, by its leads or an admin): `notify` with `toTeam` reaches everyone on the team as it is when sent, asked of identity's new `GET /v1/workspaces/{id}/people`. Identity records department changes on the department's floor, and the registry records floor rules on theirs. The shell tags a notification from another floor with its name, puts a dot on the gauge (and a count in Account) where something waits, and opening one goes to its floor. Admin, Activity filters by floor and says which floor an app was turned on, off or blocked for.
- fd53bd1: Identity keeps the floors people stand on: one org, teams that nest up to five deep, and everyone's own floor, in its own tables (`identity.workspaces`, `identity.workspace_members`, on Postgres `ltree`). `GET /v1/me/workspaces` answers the caller's floors with each one's path from the org, their role and whether they're on it directly or through a team below; their own floor is made the first time they ask. Admin's departments are now these teams: the first start copies Keycloak's groups and their members in once, and from then on the Departments screen and each person's departments change identity's tables, not Keycloak. `ORG_NAME` names the org's floor (default "Organisation").
- 94ea6cc: Notifications can carry actions, and the stream is grouped by app (SDK 1.2). `ctx.notify({ …, actions })` and the service kit's `notify` take up to two `{ label, intent }` buttons; pressing one in the stream raises its intent through the shell exactly as `ctx.raise` does (on the notification's own floor when it's from another) and marks it read, so no app code runs in the stream. The events service checks and keeps them (`actions` on `POST /v1/notifications`, a payload of at most 1 KB, migration `003_actions`), and sends a notification too big for Postgres's 8000-byte notify by id. The stream groups by app, apps with something that needs you first; each group's ⋯ mutes the app, which keeps its notifications in the stream silently (no pulse, not counted in the band) and saves `muted` in preferences, which identity now accepts. The contract tests check that an action raises its intent, skipping it for builds from before SDK 1.2. The kit gains `ui-menu` (a short list of actions from a button, with keys, danger last) and the `more` and `mute` icons.
- 0295651: The shared `SERVICE_TOKEN` is gone: every app and platform service signs in as itself. The service kit drops `SERVICE_TOKEN_HEADER`, `serviceFromHeaders` and `withoutServiceHeaders`; `ServiceCredentials` is now a name and a token source, and `platformCredentialsFromEnv` signs a platform service in as `platform-<name>`. Identity makes each platform service's Keycloak client (and the Library's, locally) from `SERVICE_CLIENT_SECRETS` when it starts, retrying until Keycloak is up. The registry and events accept only signed-in services; events asks the registry for grants as `platform-events`. `pnpm register-app` signs in as the app. Admin, Apps shows what each app may do and issues a new sign-in, showing its secret once. The deploy needs `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` in place of `SERVICE_TOKEN` (see docs/upgrade.md).
- 778157a: Shell alpha: settings, Away and recent apps save to each person's account through a new Identity preferences API (`/v1/me/preferences`); Find also searches every app's menu pages and opens them; Agents, Switch workspace and the unbuilt Admin app are hidden until they exist. The UI kit adds `reducedMotion()`, which honours `data-motion="reduce"` on `<html>`, and `canSwitchWorkspace` on `ui-shell`.

### Patch Changes

- 4c96907: Backups are proven, not only taken. Once a week (and on first start) the backup container restores the newest backup into a throwaway database, checks the platform's tables and Keycloak's people came back, and records the result; `backup.sh --restore-test` runs one now. The gateway reads the last backup and restore test from `BACKUP_DIR` and adds them to `GET /api/gateway/v1/status` (API 1.1.0); Admin's Status shows them and its heading says "Backups need a look" when one failed or is overdue. Every request now carries one id from nginx through the gateway to each service: service-kit's `serviceLogging()` labels every log line with `requestId`, and the gateway returns it in `x-request-id`. New guide: `docs/upgrade.md`.
- Updated dependencies [2abdd1d]
- Updated dependencies [d14956f]
- Updated dependencies [d1f8c5e]
- Updated dependencies [45dfa21]
- Updated dependencies [94ea6cc]
- Updated dependencies [0295651]
- Updated dependencies [4c96907]
  - @augur/service-kit@0.3.0

## 0.2.0

### Minor Changes

- b705f16: Version the HTTP APIs and report releases on health. Each service's API now lives under `/v1` (through the gateway, `/api/<service>/v1/...`), matching its OpenAPI contract's major version, and `GET /healthz` answers with the service's release and API version. The registry requires every app to say which SDK releases it works with (`sdk`, a semver range) and a semver `version`; the shell won't open an app whose range its SDK doesn't satisfy, and says why.

### Patch Changes

- Updated dependencies [b705f16]
  - @augur/service-kit@0.2.0
