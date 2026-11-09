# @augur/service-kit

## 0.18.0

### Minor Changes

- 3e2ff05: The interfaces of the app contract (contract 3, ADR 0075), ahead of the gateway, registry, runner and shell that use them. `@augur/app-tools` ships the contract's schemas (`urn:augur:app-manifest:3`, `urn:augur:score-part:1`, `urn:augur:app-release:2`, with Score's own `score-v1b1.json`), `augur-app validate` for an app's `manifest.json` and `score/*.score.yaml`, and `@augur/app-tools/release2`, which writes `augur.app-release/v2` with each part's image pinned by digest and the app's asks written out; the v1 writer stays for apps on contract 2. The service kit's caller can carry the app acting for the person and its scopes (a delegated caller, audience `app-<id>`, `APP_DELEGATION_SECONDS`), checked with `delegationCheck` when a part sends it back in `x-augur-delegation`; `isScopeName` and `isOfferedScope` say what a scope looks like and which AUGUR offers. `@augur/mfe-sdk/sdk3` holds the SDK 3 `AppContext` types (`start(ctx)`, `ctx.frame`, `ctx.files`, `ctx.canvas`); SDK 2 apps see no change.

  Not breaking: `CallerSigner.sign` gains an optional third argument (the token's lifetime); existing signers and callers build and run as before.

- e2089a3: What building the app template on the app contract found: `appServer` checks the caller the gateway signs for the app's client, `app-<id>`; `startAppService` leaves registering to the app runner on contract 3; `appDatabaseFromEnv` reads the database a part's Score file asks for; `augur-app describe` and `publish` write release v2 from the Score files for an app on contract 3 (`augur-app release describe|publish` spells it out); the catalogue entry of a contract 3 app has its route, contract and intents.
- 656f2d1: Leavers' accounts are deleted once the organisation's leaver retention has passed (ADR 0072). Identity checks every five minutes and, in an order it can resume, has Activity remove their personal values, forgets their preferences and teams, and deletes the Keycloak account; then it records `person.deleted`, which followers hear as `platform.person.deleted` (`PLATFORM_TOPICS.personDeleted`). A deployment admin who just entered their password can delete a leaver's account at once (`DELETE /v1/admin/people/{id}`). People shows when a leaver's account goes (contract 1.30.0, migration `lifecycle_005_deletion`).
- 0e4e55f: AUGUR pushes each domain event to the inbound part of every app granted `events:subscribe` (contract 3, spec 8.6): `POST /augur/events` through the gateway, in order per app, with `Idempotency-Key: events-<seq>`, retried with a backoff from a second to ten minutes, passed over and recorded after a day. An app's own events and events on floors where it lacks the scope are not sent. The gateway now takes a platform service's token, but only to an app's part, signing the caller `augur:<service>` for the part to check (`isServiceCaller`, `serviceOfCaller`); the registry lists the apps granted a scope (`GET /v1/scopes/{scope}/apps`, platform services); events shows how each app is taking its events (`GET /v1/deliveries`, admins), which Admin → Apps shows, saying since when and why an app is stalled.
- 699af61: Followers can't miss an event, and leavers can't be lost. Publishers take turns on a lock only the events login can touch, so seq order is commit order and a long transaction elsewhere no longer stalls followers. An audit entry, its domain event, and each inbox step are one transaction, and `recordAudit` sends an `Idempotency-Key`, so a retry keeps one entry (contract 1.15.0, migrations `013_one_write_each`, `014_forget_notes`). The events channels carry ids only and ignore anything else. A night identity can't give Activity's retention removes nothing. A leaver's team items that couldn't go back are retried. Leaving now and Delete now answer 503 when Activity can't be reached and carry on within five minutes, and a heir who can't sign in any more is passed over and admins told. Deletion also takes a leaver's note (`note` is in `PERSONAL_DETAIL_KEYS`), the notice that they asked to leave, their inbox notes and open items, and, in the registry, their name on upgrades (`GET /v1/people/{id}/data`, contract 1.36.0, migrations `022_followed_events`, `lifecycle_006_carry_on`). Entra's first sign-in no longer links an account holding a two-step role, and a flow that isn't whole is rebuilt. A removed app can't publish a frontend. Gateway refusals use an app's name, not its id. The service kit adds `followLeavers`, `readPersonLeft`, `readPersonDeleted`, `eventCursor`, `EVENT_CURSOR_TABLE_SQL` and `leaveNoticeKey`; the outbox keeps `refused_at` and `refused_why`. Followers keep their place past events they don't follow (`next`). No app has to change.
- 832458f: AUGUR's services apply the smaller of a person's access and an app's scopes when an app acts for the person (contract 3, spec 8.5). The service kit's `identifyServiceCaller` tells a service who is calling, a service by its own token or an app acting for a person by the delegated caller the gateway signed, and `delegationRefusal` says in words when the delegation's scopes don't cover the call. Events (notifications, domain events, the Inbox), identity (people) and models (chat, to the app's own agent only) now take an app's call made for a person within the app's grant and the delegation's scopes, and refuse outside them naming the app, the scope and the person.
- 1ce4194: Urgent news (ADR 0044 D3, PER-283). A notification can be `urgent`, from AUGUR's own services only (an app's is refused, 403). The Upgrade Centre marks a halted release and a go-back that didn't finish urgent, and offers a feature preview, `urgent-letterbox`: with it on, the shell opens urgent news in a see-through letterbox over the work, one at a time with the rest in its queue, and steps it back to the edge rule until someone opens it. Events contract 1.14.0.

  Not breaking: `NewNotification.urgent` in `@augur/service-kit` is a new optional field, so existing callers build and send as before.

### Patch Changes

- 6c0abe4: An app can't take the id `knowledge` or `kg`: they are the knowledge graph service's, and its database schema.
- dfc36c1: The app runner keeps its record of previews through installs and undoes a failed switch fully. A tarball with a negative size is refused, ids that collide with platform secrets or jobs schemas are reserved, previews use their own jobs schema, and one refused outbox row no longer holds up the rest.
- f01d0c4: The shell runs apps on the app contract (contract 3, ADR 0076) in a web worker each. The SDK's worker runtime (`@augur/mfe-sdk/sdk3/runtime`, run by the shell's bootstrap) gives the app `start(ctx)`: `ctx.frame.screen.render` draws Quill's remote vocabulary, which the shell draws with the kit; `ctx.fetch` takes a path under `/api/` and the shell makes the call with the person's token, `X-Workspace-Id` and `x-augur-app`; `ctx.navigate` and `ctx.onNavigate` leave the address to the shell; `ctx.frame.set` gives the pane its heading and actions. The worker has no network, none of the page's storage and no token, under its own policy (`default-src 'none'; script-src 'self'`, served with the bootstrap under `/sandbox/`). The pane says when the app is opening, slow (5 s) or failed (30 s, or the worker threw), and stops an app that draws more than 2,000 nodes at once or keeps more than 50,000, each with Try again; the rest of the shell keeps working. A new floor starts the worker again. The catalogue's contract 3 rows (the manifest in force) become entries the app bar, rail, Find and intents already take; the shell's own frontends stay on SDK 2. `sandbox` is now a reserved app id.

## 0.17.1

### Patch Changes

- 4cfab7e: Jobs start with a login that can't create schemas, as every service and app has on a server. DBOS's first step, `create schema if not exists`, is refused by Postgres from such a login even when the storage service has already made the schema, so the events service didn't start on 0.23.0. The kit now records that step as done when the schema is there.

## 0.17.0

### Minor Changes

- 1a8561d: The events service emails people the notifications that need them, as they chose in Account → Notifications: not
  when email is off, the app is muted or the kind is Quiet, and after their quiet hours. From the organisation's
  sender, in their language, with a link back to the notification. The service kit's notice template takes a `lang`.
- c678672: `startupLog(service)`: a service's log for what it says before its Fastify app is up, or in a job with none. The lines are pino's JSON, like Fastify's own, so OpenTelemetry sends them with the service's other logs.

## 0.16.0

### Minor Changes

- c0de29b: Email comes from the organisation's sender (Admin → Organisation) instead of SMTP_FROM and the product's name. The service kit's `Mailer` takes a `sender` lookup (`organisationSender` reads identity's `GET /v1/organisation`), Admin → Status shows the name and address mail comes from, and the realm job gives Keycloak the same sender on every run.
- 8eba62b: Apps say they bind their things to entities with `links: { entities: true }` and name the types they bind in `bindings` (lowercase, up to 10, never `entity` or `role`; SDK 2.1, ADR 0066). The registry lists those apps and types for any service at `GET /v1/entity-links`, and the service kit's `registryBindingApps` reads it, cached, so a follower such as Data Atlas subscribes to exactly `<app>.<type>.entity-bound` and `-unbound`.

### Patch Changes

- ab9f61f: Say AUGUR, not "the platform", where people read it: why an app id starting `augur-` is refused, two settings' descriptions and a dashboard's.

## 0.15.0

### Minor Changes

- 833b4ed: The registry tells AUGUR's services the role an app's manifest says a person needs (`requiredRole` in an app's grants), and the service kit reads it (`registryRequiredRole`), so models can check it for an AI app as the gateway does for the app's own API.
- 431db38: The service kit's public surface is now an API report, checked in CI. `MailTransport` is the kit's own interface rather than Nodemailer's type, `startAppService` resolves to a plain `FastifyInstance`, and telemetry takes any string record as its settings.

  Not breaking: Nodemailer's transport still fits `MailTransport`, and `process.env` still fits the telemetry settings.

## 0.14.0

### Minor Changes

- 1f83a5f: Activity can be filtered by target, person and kind (sign-ins or changes), downloaded as CSV or JSON lines (admins, at most 366 days at a time), keeps entries for the organisation's retention period (365 days by default, pruned nightly), and identity can remove a deleted person's personal values from it. Service kit adds `PERSONAL_DETAIL_KEYS` and `REMOVED`.
- 2f2b01a: The rest of PER-213:

  - **Bounded caches.** The service kit's floor, people and grant lookups now remember at most 5,000 answers each (`BoundedMap`), dropping the least recently used one when full.
  - **Paged Keycloak lists.** Identity reads Keycloak's lists of people, groups, group members and role holders 500 at a time, so a realm with more than 10,000 people no longer loses the rest without a word.
  - **Query time limit.** `steadyPool` gives each new database connection a statement timeout: a minute by default, set with `DATABASE_STATEMENT_TIMEOUT_SECONDS`, 0 for no limit. A query stuck on a lock or a bad plan now fails its request instead of holding a connection. Migrations lift the limit for themselves.

- 7886a1e: Signed-caller checks fail closed: `callerCheckFromEnv` checks callers against the gateway's key unless `AUGUR_INSECURE_DEV_CALLERS=1` is set (as `pnpm dev:app` does) or a test runner sets `NODE_ENV=test`, and always in production. Before, a service without `NODE_ENV=production` believed any `x-user-*` headers.
- 866c076: The leaver flow and signing out everywhere (ADR 0040, part of PER-194). Turning someone's sign-in off now signs them out everywhere at once: every Keycloak session and every offline token an app holds for them. Admin → People gets "They're leaving": their sign-in goes off, they're signed out, and identity records `person.left`, which the events service publishes as `platform.person.left` `{ person, handOverTo? }` so apps hand on what the leaver owns (`PLATFORM_TOPICS.personLeft`). People marks who asked to leave in their account, and the leaver flow closes the request (`GET /admin/leave-requests`, `POST /admin/people/{id}/leave`, identity contract 1.22.0). Guide: docs/people.md.
- 04d7ed1: Choosing notifications per kind (ADR 0036). The events service keeps a notification's `kind` and refuses one the app's manifest doesn't declare (migration 008). Identity's preferences keep `quietKinds` (`<app>:<kind>`). Account, Notifications lists each app's kinds, On Home or Quiet, and the shell lands a quiet kind in the stream without a pulse, uncounted, off Home and with no toast (Aerie 0.7.0). The service kit's `NewNotification` and `AppNotice` take `kind`.
- 4f8d944: Apps declare the kinds of notification they send in `notifications.kinds` (id, label, detail; up to 10), and `NotifyMessage` gains `kind` (SDK 1.13). The registry names them in an app's grants, and the service kit's `registryNotificationKinds` looks them up, so the events service can check them and people can choose each kind in Account.
- 90057d9: Every call one service makes to another now has a deadline (PER-213). `withDeadline` and `serviceTimeoutMs` in the service kit give each call 5 seconds unless `SERVICE_CALL_TIMEOUT_SECONDS` says otherwise. The kit's helpers (callService, floors, people, grants, settings, the service token, domain events) use it, as do the gateway's calls to identity and the registry, identity's calls to Keycloak (15 seconds), storage's to Garage and the updater's to the registry. A hung service now gives the caller its usual "can't be reached" error, so it answers 503 within seconds rather than waiting minutes. Calls to the model gateway get 3 minutes, and frontend uploads get 2.
- 858fad1: `outboxBinding` and `readBinding`: an app tells others when one of its things is linked to an entity, or unlinked, in the shape Mandate and Artifacts publish (`<app>.<type>.entity-bound`, ADR 0066), and a follower reads any app's back.
- 33b6fa3: AUGUR's own email sender (ADR 0065): `@augur/service-kit/mail` sends notice emails through the organisation's relay with Nodemailer, from React Email templates, and says why when it can't. The relay settings (`mailRelayFromEnv`) move into the service kit, shared with the realm job. The gateway's status now says whether email can be sent, and Admin → Status shows it with what to check.

### Patch Changes

- f902da5: Callers go unchecked under a test runner only inside Vitest (`NODE_ENV=test` and `VITEST`); `NODE_ENV=test` alone no longer turns the check off. A new script test holds every image stage, compose service and app container to `NODE_ENV=production`.

## 0.13.0

### Minor Changes

- 7dbdf7b: The app-service starter: `startAppService({ manifest, buildApp, jobs })` starts an app's service the one way every app does (listen, jobs, frontend, registration, clean stop), and `appServer` gives its Fastify instance signed callers, problem details and /healthz. `floorCaller` and `signedInCaller` name the app from its manifest; `auditFor`, `notifyFor` and `peopleFor` replace each app's own copies. The create-app template uses them.

  Jobs gain `elsewhere(name, { concurrency, workerConcurrency })`: a service can queue runs that another process, such as a Python worker on DBOS, takes off the queue `<app>.<name>`.

- 2dbdc22: Apps hear more of what changes about people (PER-148). `platform.person.joined` when an admin adds someone, and `platform.person.changed` (`{ person, changed }`, naming which of `name`, `email`, `roles` and `teams` changed, never the values) when an admin changes their details. Every team someone joins or leaves is now `platform.team.member-added` or `-removed` on that team's floor, also when it happened by adding the person or changing their list of teams, which before sent nothing; each is in that floor's Activity too. `PLATFORM_TOPICS` names the two new topics. See docs/domain-events.md.
- 0ec750c: The Inbox's items (ADR 0026, PER-146): apps' services put work that waits on a person or a team in their inbox with the new `inbox:write` scope (`inboxItem`, `updateInboxItem`, `getInboxItem` in the service kit), keyed by the app's own id, and close it when it's done or withdraw it. People list theirs (`/v1/inbox`, `/v1/inbox/counts`) and take, release, decline, hand on or mark done; each step is in the item's history and the audit log, and published as `platform.inbox.*`. The notification stream also carries `inbox` events, so the shell's count stays live. Closed items are kept `INBOX_KEEP_DAYS` (90) days. Admin names the scope "Put work in people's inboxes". Events API 1.9.0.
- 7518ce8: Apps declare the kinds of work they put in people's inboxes in their manifest's `inbox.kinds` (SDK 1.12: `id`, `label`, `icon`, up to 10), and the events service refuses an item of a kind the app doesn't declare. The registry names them in an app's grants (`inboxKinds`), read with `registryInboxKinds` from the service kit. The SDK gains the Inbox's types (`InboxItem`, `InboxKind`, `InboxCounts`, `InboxChange`) and `INBOX_TOPICS`.
- dec1a40: Background and scheduled jobs for services: `createJobs` in the service kit, on DBOS Transact (ADR 0014). Runs are durable, queued runs go to one instance, scheduled ones run once per tick, and each run that ends is recorded in the audit log. The storage service gives each app a `<id>_jobs` schema to keep them in.
- 566f261: The service kit has one migration runner, `runMigrations(pool, { schema, migrations })`, and the events, identity, models and registry services use it in place of their own copies; what they do at start is unchanged. New migrations are linted with Squawk (ADR 0053), which catches drops, renames and type changes the old check missed.

### Patch Changes

- 7517bd7: `release/shipped-apps.json` is now the one list of the apps that ship with AUGUR. The updater reads it from its image to restart them in order and check each comes back, and refuses an upgrade with an image for a part the server runs that it doesn't know, instead of restarting it unchecked. `pnpm check:release` fails when a compose file disagrees with it. The registry refuses an app whose id a part of AUGUR answers to (a platform service, a platform app, a deployment service or a path the front door serves), saying which, and storage makes no schema under such an id (`RESERVED_APP_IDS` in the service kit).

  The updater restarts AUGUR's own Keycloak image first, giving it up to five minutes to be ready, and keeps it running when going back to a release from before that image.

## 0.12.0

### Minor Changes

- b3060e0: Every platform service answers errors as RFC 9457 problem details (`application/problem+json`) with AUGUR's `reason` and `whoCanChange`, and keeps `error` and `message` for SDK 1.x clients. The service kit adds `problemDetails()`, `Problem`, `sendProblem` and `serviceFastifyOptions()`. A service's unexpected errors are logged and answered with a plain 500, never with their own words.

## 0.11.0

### Minor Changes

- 137791c: OpenTelemetry for every service (ADR 0034): `@augur/service-kit/telemetry` sends traces, metrics and logs over OTLP once `OTEL_EXPORTER_OTLP_ENDPOINT` names a collector, and does nothing until then. Compose loads it before each Node service and has an optional `observability` profile with Grafana's all-in-one stack. See docs/observability.md.
- 2021f8a: Deployment admins now hear in the shell when a new AUGUR or app release is available, and deployment admins and admins hear when an upgrade or install finishes, fails or goes back by itself (ADR 0044). Platform services can address a notification to an `audience` such as `role:deployment-admin`, worked out by identity as it's sent, and any sender can give one a `key` so each person is told that news once (events contract 1.7.0, identity contract 1.14.0).

## 0.10.0

### Minor Changes

- ea41136: Services stay up through a Postgres restart: a dropped idle connection is logged (`steadyPool` in the service kit) rather than ending the process, and the events service listens again on a new connection, so open notification streams don't go quiet for good.

## 0.9.0

### Minor Changes

- f0d02e2: Floor rules for apps are domain events too: `platform.app.blocked` when an admin blocks an app on a floor and those below it, and `platform.app.rule-cleared` when a floor goes back to following the one above. `PLATFORM_TOPICS` names them.
- bbdad18: The model gateway turns apps' texts into vectors (`POST /v1/embeddings`, contract 1.1), to match by meaning, when an embedding model is set up (`MODEL_EMBEDDING_NAME`; the stand-in always has one). Each request is one call, recorded as `model.embedded` without the texts. `embedTexts` in the service kit asks for them.

## 0.8.0

### Minor Changes

- aa1724a: Services check their settings before they start. The service kit's `loadConfig` takes a list of the settings a service reads (`Setting`, plus `commonSettings` for the ones services share). In production, a missing required setting stops the service with one message listing every problem, instead of falling back to a `localhost` address. A secret can be given as a file in `<NAME>_FILE`. `describeConfig` reports each setting and where it came from, never a secret's value, ready for Admin → Deployment.

## 0.7.0

### Minor Changes

- 57d3760: The updater can now run apps: with `APP_SECRETS_KEY` in `.env` it installs, upgrades and removes apps that don't ship with AUGUR, from their signed releases, in a Compose project of its own (`augur-apps`). Upgrades are blue/green with a health check: a version that doesn't come up leaves the old one serving. Admins ask for installs and removals through the registry's new `/v1/app-runner/jobs`, and the service kit's `registerApp` leaves registering to the runner when it runs the app.
- 476907a: Apps' secrets can be worked out instead of written into `.env`. With `APP_SECRETS_KEY` set, the storage container works out each app's database password and bucket secret from it and the app's id (`appSecretFor` in the service kit) when `.env` doesn't name them, and the app runner can set an app's sign-in to the secret it works out (`PUT /v1/admin/apps/{id}/credential`, the updater only). Secrets in `.env` still win.
- ef587a4: Apps' frontends are kept by version. An app's service gives the registry each version's built frontend before registering it (`publishFrontend` in the service kit, `PUT /v1/apps/{id}/versions/{version}/frontend`), the registry writes it to the new `augur-frontends` bucket that the storage container makes, and the front door serves it from Garage at `/apps/<id>/<version>/`. The manifest the shell is given then points at that version's own copy, so holding an app at an older version in Admin, Apps holds its code too. A version's frontend never changes once given. Folio gives its own on every start. Needs `FRONTENDS_BUCKET_SECRET` in `.env` (docs/upgrade.md); without it apps are served from their manifests' entry as before.
- a6b6bca: A pull request's preview (`APP_PREVIEW=pr-<n>`, set by the app runner) says so in what it sends: `notify` puts "Preview #<n>:" before the title, and `recordAudit` adds `preview: <n>` to the entry's detail.
- 948526d: The gateway finds apps' services through the registry. Whatever runs an app (a platform service) or an admin says where its service is (`PUT /v1/apps/{id}/upstream`), and the gateway sends `/api/<id>/…` there, asking the registry as itself (`GET /v1/upstreams`, the signed caller `augur:gateway`) every 30 seconds and keeping the last answer through a registry restart. Status checks those apps too. `APP_UPSTREAMS` still works and wins for the apps it names, so nothing changes for a server until an app is set up this way. Upstreams can never be one of the platform's own parts.

## 0.6.0

### Minor Changes

- f7fc3e6: Apps can offer admins settings: a manifest's `settings` (whole numbers with a label, unit, range and default), set in Admin, Apps and audited as app.setting-changed, kept across versions. The registry serves them at `GET /v1/apps/{id}/settings` to admins and the app itself, and the service kit's `appSettings` reads them. Folio offers "Keep deleted documents for" (30 days by default): past it, a deleted document's files are removed from its bucket and its text forgotten, recorded as document.purged.
- 94d0c0c: Folio ships with AUGUR. The release builds its images and pins its version, the deploy stack runs it (`folio`, `folio-worker`, its frontend in `web`) and it registers itself on first start with no admin step. The registry's `PILLAR_APPS` are given the scopes their release asks for, can't be pinned to a version, and can be turned off but not removed (409); Admin shows them as shipping with AUGUR, without versions to go back to or a sign-in to issue. The updater restarts Folio and its worker in an upgrade. The service kit works out a bucket key's id from its secret (`bucketKeyIdFor`), so apps need only `S3_SECRET_ACCESS_KEY`. The shell's dev-app mode takes other apps beside the one being developed (`DEV_ALSO`), and the contract tests run with Folio on and off.
- 4608af1: Apps can look people up for sharing, with the new `people:read` scope. Identity says who a person stands for (`GET /v1/people/:id/principals`: `person:`, `team:` and `tree:` principals and `org`) and finds people and teams by name or names them by id (`GET /v1/directory`). The service kit's `identityPrincipals` (kept 30 seconds) and `identityDirectory` call them. Admin shows the scope as "Look up people and teams".
- 936bb00: A publisher role, for people who may publish beyond their own team (to the whole org, or any team). Identity adds it to the sign-in service when it starts, so existing servers get it too. Identity says who an audience reaches (`GET /v1/members?principals=`, `people:read`), which the service kit's `identityAudience` calls, and the directory's teams carry their `path` of team ids.

## 0.5.0

### Minor Changes

- ebb8b97: App storage: an app can keep its own database schema and files on the platform. A new one-shot `storage` service gives each app listed in `APP_STORAGE` a database login that owns one schema, and a bucket on Garage (the new S3-compatible object store in the deploy stack) with a key that opens only that bucket, from secrets in `.env`. Postgres gains pgvector. The service kit adds `appStorageFromEnv()`, manifests may say `"storage": { "database": true, "bucket": true }`, and the nightly backup now takes apps' files as well. See docs/app-storage.md.
- a3ba7ef: Admin → Updates can ask for an upgrade. **Upgrade to …** records the wanted release in the registry (`PUT /v1/platform/upgrade`, audited), after the admin enters their password again: the gateway now passes on when the caller last signed in (`x-user-signed-in-at`, `Caller.signedInAt`, `signedInRecently()` in the service kit), and the shell's `/auth/again?return=<path>` asks for the password and comes back. The deployment's updater (signed in as `platform-updater`) reads the upgrade from `/v1/platform/upgrade/target` and reports each step to `/v1/platform/upgrade/progress`; Updates follows along and says how it ended. An upgrade nothing has started can be cancelled.
- a09b413: Domain events: services tell each other what happened. The events service keeps events on topics (`folio.document.published`), which an app publishes on its own topics with the new `events:publish` scope, and hands them out in one order, never with a gap, to services with `events:subscribe`. It publishes the platform's own (`platform.person.disabled`, `platform.team.member-added`, `platform.app.turned-off` and more) as identity and the registry record those changes. The service kit adds an outbox (`OUTBOX_TABLE_SQL`, `addToOutbox`, `outboxRelay`) so an event is sent if and only if its change commits, `followEvents` for followers, `publishEvents` and `PLATFORM_TOPICS`. Admin names the two new scopes. Events are kept 30 days. See docs/domain-events.md.
- b90f63b: Signed caller: the gateway signs the person it passes on (`x-augur-caller`, Ed25519, one minute, one service as audience) and publishes its key at `/api/gateway/v1/caller-keys`. The service kit's `signedCallers` hook drops unsigned `x-user-*` headers and puts back only the signed caller; the platform's services and new apps use it.

## 0.4.0

### Minor Changes

- f090793: The model gateway: a new platform service (`models`) that alone holds an AI provider's key. It speaks the OpenAI-style chat API to whichever provider the server sets (`MODEL_API_URL`: OpenRouter, a LiteLLM proxy, any compatible API, or `stand-in`, a built-in model that doesn't think, for trying things out), records every call in the audit log before making it, and gives each app a number of calls a day. It is off until an admin turns it on. App services ask it with `askModel` from the service kit and need the new `models:use` scope; the gateway forwards `/api/models` to it.

### Patch Changes

- 1622cd9: The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.

## 0.3.0

### Minor Changes

- 2abdd1d: Apps sign in to the platform as themselves. An admin issues an app's own sign-in with `POST /v1/admin/apps/{id}/credential` on identity, which makes (or gives a new secret to) the Keycloak client `app-<id>`: client credentials only, 5-minute tokens for the `platform-services` audience, audited without the secret. The app's service gets it as `SERVICE_CLIENT_SECRET`; the service kit's `appCredentialsFromEnv`, `clientCredentials` and `serviceVerifier` sign in and check those tokens, and `notify`, `recordAudit` and `callService` can name the floor a call is for. Manifests gain `scopes` (`notifications:send`, `audit:write`). The registry lets an app register only itself, and tells platform services what an app is granted (`GET /v1/apps/{id}/grants?workspace=`): for now, what its manifest asks for on every floor, and nothing while it is off. Events lets an app notify and write the audit log only for itself and only with the scope on the call's floor (403 otherwise, 503 while it can't be checked), keeping each answer for 30 seconds. The shared `SERVICE_TOKEN` still works for now. The Library and new apps from `pnpm create-app` sign in as themselves when they have a secret.
- d14956f: An app can be on for one floor and off for another. The registry keeps three separate things: whether an app is turned on at all (as before), installs per floor in a new `registry.installs` table (on or off, carrying on to the teams below unless told not to), and guardrails in `registry.guardrails`, where a block on a floor wins over anything below it. Everyone's own floor follows the org. Manifests gain `floors` (the kinds of floor an app works on) and a checked `surfaces` block (page, card, panel, settings or admin per kind of floor, with an optional role and roll-up). `GET /v1/manifest?workspace=` lists the apps on for the floor the gateway checked, and grants now hold only where an app is on. Admins set floors with `PUT /v1/apps/{id}/floors/{workspace}` and see them with `GET /v1/apps/{id}/floors`; a new version asking for more scopes is served but gets them only after `PUT /v1/apps/{id}/scopes`. Identity tells platform services where a floor sits (`GET /v1/workspaces/{id}`, read with the service kit's `floorPlaces`) and offers the roll-up `GET /v1/me/workspaces/{id}/rollup`. The shell asks for the catalogue of the floor you're on and asks again when you move. Admin, Apps shows where each app is on, floor by floor, with a choice for each, and lets an admin allow scopes a new version asks for. Services need `IDENTITY_URL` (set in both compose files).
- d1f8c5e: Notifications and the audit log know their floor. A service call that names a floor records it on each notification and audit entry, with the floor's path from the root as it stood then (asked of identity), so "everything under Finance" stays right after a team moves. `GET /v1/audit?workspace=` filters to a floor and the floors below it; admins read the whole log and a lead their own floor's. Team notices are opt-in per team (`PUT /v1/team-notices/{workspace}`, by its leads or an admin): `notify` with `toTeam` reaches everyone on the team as it is when sent, asked of identity's new `GET /v1/workspaces/{id}/people`. Identity records department changes on the department's floor, and the registry records floor rules on theirs. The shell tags a notification from another floor with its name, puts a dot on the gauge (and a count in Account) where something waits, and opening one goes to its floor. Admin, Activity filters by floor and says which floor an app was turned on, off or blocked for.
- 45dfa21: The gateway checks the floor a request is for. An app sends `X-Workspace-Id`; the gateway asks identity which floors the caller is on (remembered for 30 seconds per person), answers 403 when they're not on that one and 503 when identity can't say, and otherwise passes it on as `x-workspace-id`, `x-workspace-kind` and `x-workspace-role`. Requests without the header are unchanged. Service-kit reads these as `caller.workspace`, and strips any floor headers a client sent along with the caller headers.
- 94ea6cc: Notifications can carry actions, and the stream is grouped by app (SDK 1.2). `ctx.notify({ …, actions })` and the service kit's `notify` take up to two `{ label, intent }` buttons; pressing one in the stream raises its intent through the shell exactly as `ctx.raise` does (on the notification's own floor when it's from another) and marks it read, so no app code runs in the stream. The events service checks and keeps them (`actions` on `POST /v1/notifications`, a payload of at most 1 KB, migration `003_actions`), and sends a notification too big for Postgres's 8000-byte notify by id. The stream groups by app, apps with something that needs you first; each group's ⋯ mutes the app, which keeps its notifications in the stream silently (no pulse, not counted in the band) and saves `muted` in preferences, which identity now accepts. The contract tests check that an action raises its intent, skipping it for builds from before SDK 1.2. The kit gains `ui-menu` (a short list of actions from a button, with keys, danger last) and the `more` and `mute` icons.
- 0295651: The shared `SERVICE_TOKEN` is gone: every app and platform service signs in as itself. The service kit drops `SERVICE_TOKEN_HEADER`, `serviceFromHeaders` and `withoutServiceHeaders`; `ServiceCredentials` is now a name and a token source, and `platformCredentialsFromEnv` signs a platform service in as `platform-<name>`. Identity makes each platform service's Keycloak client (and the Library's, locally) from `SERVICE_CLIENT_SECRETS` when it starts, retrying until Keycloak is up. The registry and events accept only signed-in services; events asks the registry for grants as `platform-events`. `pnpm register-app` signs in as the app. Admin, Apps shows what each app may do and issues a new sign-in, showing its secret once. The deploy needs `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` in place of `SERVICE_TOKEN` (see docs/upgrade.md).
- 4c96907: Backups are proven, not only taken. Once a week (and on first start) the backup container restores the newest backup into a throwaway database, checks the platform's tables and Keycloak's people came back, and records the result; `backup.sh --restore-test` runs one now. The gateway reads the last backup and restore test from `BACKUP_DIR` and adds them to `GET /api/gateway/v1/status` (API 1.1.0); Admin's Status shows them and its heading says "Backups need a look" when one failed or is overdue. Every request now carries one id from nginx through the gateway to each service: service-kit's `serviceLogging()` labels every log line with `requestId`, and the gateway returns it in `x-request-id`. New guide: `docs/upgrade.md`.

## 0.2.0

### Minor Changes

- b705f16: Version the HTTP APIs and report releases on health. Each service's API now lives under `/v1` (through the gateway, `/api/<service>/v1/...`), matching its OpenAPI contract's major version, and `GET /healthz` answers with the service's release and API version. The registry requires every app to say which SDK releases it works with (`sdk`, a semver range) and a semver `version`; the shell won't open an app whose range its SDK doesn't satisfy, and says why.
