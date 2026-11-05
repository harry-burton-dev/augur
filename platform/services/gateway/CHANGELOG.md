# @augur/gateway

## 0.12.2

### Patch Changes

- Updated dependencies [4cfab7e]
  - @augur/service-kit@0.17.1

## 0.12.1

### Patch Changes

- Updated dependencies [1a8561d]
- Updated dependencies [c678672]
  - @augur/service-kit@0.17.0

## 0.12.0

### Minor Changes

- c0de29b: Email comes from the organisation's sender (Admin → Organisation) instead of SMTP_FROM and the product's name. The service kit's `Mailer` takes a `sender` lookup (`organisationSender` reads identity's `GET /v1/organisation`), Admin → Status shows the name and address mail comes from, and the realm job gives Keycloak the same sender on every run.

### Patch Changes

- Updated dependencies [c0de29b]
- Updated dependencies [8eba62b]
- Updated dependencies [ab9f61f]
  - @augur/service-kit@0.16.0

## 0.11.1

### Patch Changes

- Updated dependencies [833b4ed]
- Updated dependencies [431db38]
  - @augur/service-kit@0.15.0

## 0.11.0

### Minor Changes

- 88f3b55: The database can be restored to any moment in the last 7 days (ADR 0064). Postgres archives its changes (WAL) as it makes them, the backup container takes a base backup each night, copies both off the server every hour once the off-server copy is set up, and replays them in the weekly restore test; `backup/restore-to-time.sh` goes back to a moment. Admin → Status shows how far back the database can go and the last replay test, and says why when it can't be relied on (`backups.pointInTime`, gateway contract 1.8.0).
- 33b6fa3: AUGUR's own email sender (ADR 0065): `@augur/service-kit/mail` sends notice emails through the organisation's relay with Nodemailer, from React Email templates, and says why when it can't. The relay settings (`mailRelayFromEnv`) move into the service kit, shared with the realm job. The gateway's status now says whether email can be sent, and Admin → Status shows it with what to check.

### Patch Changes

- 90057d9: Every call one service makes to another now has a deadline (PER-213). `withDeadline` and `serviceTimeoutMs` in the service kit give each call 5 seconds unless `SERVICE_CALL_TIMEOUT_SECONDS` says otherwise. The kit's helpers (callService, floors, people, grants, settings, the service token, domain events) use it, as do the gateway's calls to identity and the registry, identity's calls to Keycloak (15 seconds), storage's to Garage and the updater's to the registry. A hung service now gives the caller its usual "can't be reached" error, so it answers 503 within seconds rather than waiting minutes. Calls to the model gateway get 3 minutes, and frontend uploads get 2.
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

## 0.10.0

### Minor Changes

- 8736ebd: The gateway takes browser errors and traces from the shell and passes them on to the deployment's collector, stamped as `augur-browser` and with anything personal taken out (ADR 0059, contract 1.6.0). It also records what the alert rules read: each part's health, calls by part and status class, and whether backups can be relied on.
- 896efde: Backups can be copied off the server (ADR 0060). Once `OFFSITE_REPOSITORY`, `OFFSITE_PASSWORD` and the bucket's key are set in `.env`, the backup container copies each night's dump and apps' files with restic to that S3-compatible bucket, encrypted on the server first, and keeps 30 days (`OFFSITE_KEEP_DAILY`). The weekly restore test then restores from the bucket. Admin → Status shows the copy and where the last restore came from, and needs a look while backups stay on the server only (gateway contract 1.7.0: `backups.offsite`, `lastRestoreTest.from`). A new one-shot `backup-tools` container hands restic to the backup container: after upgrading, run `pc up -d backup` once. See docs/deploy.md, "Off-server copy".

### Patch Changes

- c4b539c: The gateway's own routes carry TypeBox schemas, and contracts/gateway.openapi.yaml is generated from them (ADR 0055); what it forwards stays out of it.
  Its contract now also lists Status's `seeding` (contract 1.5.0).
- 8606741: The deployment watches itself (ADR 0059). otel-lgtm now runs in every deployment, keeps 72 hours, and its Grafana loads AUGUR's alert rules (a part down, server errors, browser errors, backups) and dashboard from `infra/deploy/observability/`. Each alert, and its all-clear, reaches deployment admins as a notice through the registry's new webhook (`POST /v1/platform/alerts`, contract 1.32.0, with `ALERT_WEBHOOK_TOKEN`). Before upgrading, set `GRAFANA_ADMIN_PASSWORD` and `ALERT_WEBHOOK_TOKEN` in `.env`; a server with its own collector sets `OTEL_LGTM_REPLICAS=0`. `OTEL_SDK_DISABLED=true` now also stops the shell sending browser errors. See docs/upgrade.md, "The deployment watches itself".
- Updated dependencies [7dbdf7b]
- Updated dependencies [2dbdc22]
- Updated dependencies [0ec750c]
- Updated dependencies [7518ce8]
- Updated dependencies [dec1a40]
- Updated dependencies [566f261]
- Updated dependencies [7517bd7]
  - @augur/service-kit@0.13.0

## 0.9.0

### Minor Changes

- 5458619: Status says whether this deployment allows sample data (`SEED_ALLOWED`, off unless set), and the realm gains the `platform-cli` client for signing in from a terminal (ADR 0056).

### Patch Changes

- b3060e0: Every platform service answers errors as RFC 9457 problem details (`application/problem+json`) with AUGUR's `reason` and `whoCanChange`, and keeps `error` and `message` for SDK 1.x clients. The service kit adds `problemDetails()`, `Problem`, `sendProblem` and `serviceFastifyOptions()`. A service's unexpected errors are logged and answered with a plain 500, never with their own words.
- 8d48714: Fixes from the 2 Nov audit. In Admin → People, a person's sign-in (on or off, a new one-time password) sits in its own section that says it takes effect at once: each asks first, acts straight away and says what happened, while their name, email, department and roles change only on Save. Agents stay among the Shell's functions and say they aren't here yet, and Home keeps the card of an app this shell can't open, saying why and who can change it, instead of hiding either. Messages people read say AUGUR, not "the platform", and `pnpm check:reasons` now catches it. The centre menu's transitions stop for AUGUR's own reduced-motion setting as well as the system's and are timed from motion tokens; the lifecycle's divider uses the hairline token; overlay shadows use the shadow token. A new test holds the Lit kit and AUGUR's frontends to tokens only.
- Updated dependencies [b3060e0]
  - @augur/service-kit@0.12.0

## 0.8.0

### Minor Changes

- bafbd8d: The gateway counts the calls it answers and its server errors over the last 15 minutes, at GET /traffic, for the updater's watch after an upgrade (ADR 0020). Only the deployment's own network reaches it: the front door forwards only /api/.
- 84b454e: GET /traffic counts AUGUR's own services apart from apps, so the watch after an upgrade can judge AUGUR by its own calls and an app's errors can't send it back.

### Patch Changes

- Updated dependencies [137791c]
- Updated dependencies [2021f8a]
  - @augur/service-kit@0.11.0

## 0.7.1

### Patch Changes

- Updated dependencies [ea41136]
  - @augur/service-kit@0.10.0

## 0.7.0

### Minor Changes

- 6b5dbaf: Open AUGUR to the internet for a while: `infra/deploy/public.sh on 2h | off | status` serves AUGUR's own address through Tailscale Funnel (the front door only; Keycloak's console stays closed to the internet) and closes it by itself when the time is up, even over a restart. The gateway reads it from `PUBLIC_ACCESS_FILE` and adds `publicAccess` to `GET /api/gateway/v1/status` (API 1.4.0); Admin → Status says "Open to the internet until …" while it's open. Allowing Funnel in the tailnet's policy once is in docs/deploy.md.

### Patch Changes

- Updated dependencies [f0d02e2]
- Updated dependencies [bbdad18]
  - @augur/service-kit@0.9.0

## 0.6.0

### Minor Changes

- c8be97d: The gateway refuses a call to an app that isn't on for the caller where they are. It checks the floor the call names in `X-Workspace-Id`, or the organisation's when it names none. An app is off for someone if it's turned off, blocked on that floor, or needs a role they don't have. Such calls get a 403. Before this, only the shell hid such apps, and a call that named no floor skipped floor rules entirely. The check reads the same catalogue the shell gets from the registry, remembered for 30 seconds per person and floor, and it also supplies each app's upload limit as before.

### Patch Changes

- aa1724a: Services check their settings before they start. The service kit's `loadConfig` takes a list of the settings a service reads (`Setting`, plus `commonSettings` for the ones services share). In production, a missing required setting stops the service with one message listing every problem, instead of falling back to a `localhost` address. A secret can be given as a file in `<NAME>_FILE`. `describeConfig` reports each setting and where it came from, never a secret's value, ready for Admin → Deployment.
- Updated dependencies [aa1724a]
  - @augur/service-kit@0.8.0

## 0.5.0

### Minor Changes

- 82ce131: Pull requests that change an app get previews: the App previews workflow builds, signs and releases each push as `<x.y.z>-pr.<n>.<run>`, and a server with the app installed runs the newest build beside it (at most three per app, for a week after the last build, gone when the pull request closes) with scratch storage of its own. An admin names an app’s developers in Admin → Apps; each developer can switch to a preview for themselves (`/v1/previews`), which gives them its frontend and sends their calls to it, while everyone else stays on the installed version.
- 948526d: The gateway finds apps' services through the registry. Whatever runs an app (a platform service) or an admin says where its service is (`PUT /v1/apps/{id}/upstream`), and the gateway sends `/api/<id>/…` there, asking the registry as itself (`GET /v1/upstreams`, the signed caller `augur:gateway`) every 30 seconds and keeping the last answer through a registry restart. Status checks those apps too. `APP_UPSTREAMS` still works and wins for the apps it names, so nothing changes for a server until an app is set up this way. Upstreams can never be one of the platform's own parts.

### Patch Changes

- Updated dependencies [57d3760]
- Updated dependencies [476907a]
- Updated dependencies [ef587a4]
- Updated dependencies [a6b6bca]
- Updated dependencies [948526d]
  - @augur/service-kit@0.7.0

## 0.4.1

### Patch Changes

- Updated dependencies [f7fc3e6]
- Updated dependencies [94d0c0c]
- Updated dependencies [4608af1]
- Updated dependencies [936bb00]
  - @augur/service-kit@0.6.0

## 0.4.0

### Minor Changes

- a3ba7ef: Admin → Updates can ask for an upgrade. **Upgrade to …** records the wanted release in the registry (`PUT /v1/platform/upgrade`, audited), after the admin enters their password again: the gateway now passes on when the caller last signed in (`x-user-signed-in-at`, `Caller.signedInAt`, `signedInRecently()` in the service kit), and the shell's `/auth/again?return=<path>` asks for the password and comes back. The deployment's updater (signed in as `platform-updater`) reads the upgrade from `/v1/platform/upgrade/target` and reports each step to `/v1/platform/upgrade/progress`; Updates follows along and says how it ended. An upgrade nothing has started can be cancelled.
- b90f63b: Signed caller: the gateway signs the person it passes on (`x-augur-caller`, Ed25519, one minute, one service as audience) and publishes its key at `/api/gateway/v1/caller-keys`. The service kit's `signedCallers` hook drops unsigned `x-user-*` headers and puts back only the signed caller; the platform's services and new apps use it.
- 972d0ed: Uploads and document intents (SDK 1.4). A manifest's `maxUpload` (MB, 1 to 2048; 10 without it) is the largest request the gateway lets through to the app's service. Bodies stream through nginx and the gateway without being held; one past the limit gets 413, by its length or as it streams. Admins can lower an app's limit in Admin, Apps (`PUT /v1/apps/{id}/upload-limit`, audited as `app.upload-limit-set`), and the manifest the registry serves carries the limit in force. The SDK adds the standard document intents: `DOCUMENT_OPEN`, `DOCUMENT_PICK`, `DocumentRef` `{ app, id, version?, title }`, `DocumentPick`, `openDocument`, `pickDocument` (which checks the answer) and `isDocumentRef`.

### Patch Changes

- Updated dependencies [ebb8b97]
- Updated dependencies [a3ba7ef]
- Updated dependencies [a09b413]
- Updated dependencies [b90f63b]
  - @augur/service-kit@0.5.0

## 0.3.0

### Minor Changes

- f090793: The model gateway: a new platform service (`models`) that alone holds an AI provider's key. It speaks the OpenAI-style chat API to whichever provider the server sets (`MODEL_API_URL`: OpenRouter, a LiteLLM proxy, any compatible API, or `stand-in`, a built-in model that doesn't think, for trying things out), records every call in the audit log before making it, and gives each app a number of calls a day. It is off until an admin turns it on. App services ask it with `askModel` from the service kit and need the new `models:use` scope; the gateway forwards `/api/models` to it.

### Patch Changes

- 8c0a9c8: Servers run released images instead of building them. Each AUGUR release now builds, pushes and signs (cosign, keyless) the web, gateway, identity, registry, events and models images to `ghcr.io/<repo>/<part>:<version>`, and its `augur-release.json` asset names each by digest. `infra/deploy/compose.yml` runs `${PLATFORM_IMAGES}/<part>:${PLATFORM_VERSION}` (new setting `PLATFORM_VERSION`, optional `PLATFORM_IMAGES` for a mirror); `compose.build.yml` builds from the checkout instead. The images run as unprivileged users, and the web container listens on 8080. See "Images from releases" in `docs/upgrade.md`.
- 1622cd9: The platform is now called AUGUR. Packages move from `@platform/*` to `@augur/*`, and the shell's title, `<ui-shell>`'s default product name, Admin and new sign-in realms say AUGUR. Running servers keep their realm, database, Compose project and `.env` names; see docs/upgrade.md. The shell's import map still answers to `@platform/ui-kit`, so apps built before the rename keep loading.
- Updated dependencies [f090793]
- Updated dependencies [1622cd9]
  - @augur/service-kit@0.4.0

## 0.2.0

### Minor Changes

- 0ba927c: Status in Admin: whether every part of the platform is answering, without the command line. The gateway checks every service's `/healthz` and the sign-in service's signing keys every 30 seconds, keeps the last answer, and serves it to admins at `GET /api/gateway/v1/status` (new contract `contracts/gateway.openapi.yaml`, API 1.0.0); a part that fails its check, or goes quiet for 2 minutes, reads Down. Admin's new Status screen lists each part with its version, state and when it last answered, refreshes every 15 seconds, and says what to check for a part that's down. Admin's menu gains a Platform stop with Status. The UI kit adds a `pulse` icon.
- 45dfa21: The gateway checks the floor a request is for. An app sends `X-Workspace-Id`; the gateway asks identity which floors the caller is on (remembered for 30 seconds per person), answers 403 when they're not on that one and 503 when identity can't say, and otherwise passes it on as `x-workspace-id`, `x-workspace-kind` and `x-workspace-role`. Requests without the header are unchanged. Service-kit reads these as `caller.workspace`, and strips any floor headers a client sent along with the caller headers.
- 4c96907: Backups are proven, not only taken. Once a week (and on first start) the backup container restores the newest backup into a throwaway database, checks the platform's tables and Keycloak's people came back, and records the result; `backup.sh --restore-test` runs one now. The gateway reads the last backup and restore test from `BACKUP_DIR` and adds them to `GET /api/gateway/v1/status` (API 1.1.0); Admin's Status shows them and its heading says "Backups need a look" when one failed or is overdue. Every request now carries one id from nginx through the gateway to each service: service-kit's `serviceLogging()` labels every log line with `requestId`, and the gateway returns it in `x-request-id`. New guide: `docs/upgrade.md`.

### Patch Changes

- 6a64067: Security fixes from the code review. The gateway checks sign-in on every path but `/healthz`, by the route a request matched rather than its raw URL, so a percent-encoded path such as `/%61pi/library/…` can no longer skip the check. It no longer forwards the person's `Authorization` header to any service; services already get the caller in `x-user-*` headers. `APP_UPSTREAMS` may not name a platform service. The registry refuses an app route inside or around another app's route (`/admin/people` would have taken over Admin's People page). Events treats an `X-Workspace-Id` that won't URI-decode as an unknown floor (400) instead of failing with 500.
- 0295651: The shared `SERVICE_TOKEN` is gone: every app and platform service signs in as itself. The service kit drops `SERVICE_TOKEN_HEADER`, `serviceFromHeaders` and `withoutServiceHeaders`; `ServiceCredentials` is now a name and a token source, and `platformCredentialsFromEnv` signs a platform service in as `platform-<name>`. Identity makes each platform service's Keycloak client (and the Library's, locally) from `SERVICE_CLIENT_SECRETS` when it starts, retrying until Keycloak is up. The registry and events accept only signed-in services; events asks the registry for grants as `platform-events`. `pnpm register-app` signs in as the app. Admin, Apps shows what each app may do and issues a new sign-in, showing its secret once. The deploy needs `IDENTITY_CLIENT_SECRET`, `REGISTRY_CLIENT_SECRET` and `EVENTS_CLIENT_SECRET` in place of `SERVICE_TOKEN` (see docs/upgrade.md).
- Updated dependencies [2abdd1d]
- Updated dependencies [d14956f]
- Updated dependencies [d1f8c5e]
- Updated dependencies [45dfa21]
- Updated dependencies [94ea6cc]
- Updated dependencies [0295651]
- Updated dependencies [4c96907]
  - @augur/service-kit@0.3.0

## 0.1.1

### Patch Changes

- b705f16: Version the HTTP APIs and report releases on health. Each service's API now lives under `/v1` (through the gateway, `/api/<service>/v1/...`), matching its OpenAPI contract's major version, and `GET /healthz` answers with the service's release and API version. The registry requires every app to say which SDK releases it works with (`sdk`, a semver range) and a semver `version`; the shell won't open an app whose range its SDK doesn't satisfy, and says why.
- Updated dependencies [b705f16]
  - @augur/service-kit@0.2.0
