# @augur/storage

## 0.6.1

### Patch Changes

- e13f9b6: Taking an app's bucket away (a retired app, a removed app's data, a preview) leaves its keys, because Garage never takes a deleted key's id back and the id comes from the app's secret: going back to the release before, or installing the app again, sets its storage up with the same secret. When a secret's key was deleted before, the storage job says so and which setting to change.
- Updated dependencies [d2ce7c9]
- Updated dependencies [7e6b12b]
- Updated dependencies [12064f5]
- Updated dependencies [cc7aa74]
  - @augur/service-kit@0.19.0

## 0.6.0

### Minor Changes

- 23117fe: Removing an app from the server takes its sign-in away at once and keeps its data, settings and floors for APP_DATA_GRACE_DAYS (30), then deletes them after a backup; installing it again before then keeps them. A deletion that fails waits longer each time, up to a day, and Admin shows why.
- 203eaaf: An app can't stop AUGUR starting or turn back its upgrade (ADR 0073). The storage job sets up the platform's own logins first and skips an app it can't set up, saying why, instead of failing; Compose no longer refuses the whole file over one app's missing secret. Each app's database login holds at most `APP_DATABASE_CONNECTIONS` (30) connections. The restore test passes or fails on AUGUR's own data; an app's schema that doesn't come back is listed under `appsNotRestored`, which Status shows (gateway API 1.9.0). The deploy test takes a backup and runs the restore test on every release.
- 3c995b6: No app ships with AUGUR any more (ADR 0075): Artifacts, Explorer, Data Atlas and Mandate are taken out of the compose files, the release and the contract tests, to be redesigned under the app contract and installed from the app feed. Their data goes with them, after the upgrade's backup: the storage job takes away the schemas, logins and buckets of the apps in `RETIRED_APPS`, once on each server, keeping any that `APP_STORAGE` still names, and the registry's migration `023_retire_shipped_apps` forgets them. Their guides and settings are gone; docs/upgrade.md says what an admin can tidy up.

### Patch Changes

- Updated dependencies [3e2ff05]
- Updated dependencies [e2089a3]
- Updated dependencies [656f2d1]
- Updated dependencies [0e4e55f]
- Updated dependencies [6c0abe4]
- Updated dependencies [699af61]
- Updated dependencies [dfc36c1]
- Updated dependencies [f01d0c4]
- Updated dependencies [832458f]
- Updated dependencies [1ce4194]
  - @augur/service-kit@0.18.0

## 0.5.1

### Patch Changes

- Updated dependencies [4cfab7e]
  - @augur/service-kit@0.17.1

## 0.5.0

### Minor Changes

- 8b22fe4: Identity answers `GET /v1/notice-settings` for the events service: each person's confirmed address,
  language, time zone (theirs, else the organisation's) and choices in Account → Notifications, so
  notices can be emailed. Storage gives each platform service a jobs schema of its own.

### Patch Changes

- 6ec3e70: What these services say as they start, and the storage and realm jobs as they run, goes through the service kit's `startupLog` instead of `console`: the same JSON lines as the rest of their logs, sent to the deployment's telemetry stack with them.
- Updated dependencies [1a8561d]
- Updated dependencies [c678672]
  - @augur/service-kit@0.17.0

## 0.4.5

### Patch Changes

- Updated dependencies [c0de29b]
- Updated dependencies [8eba62b]
- Updated dependencies [ab9f61f]
  - @augur/service-kit@0.16.0

## 0.4.4

### Patch Changes

- Updated dependencies [833b4ed]
- Updated dependencies [431db38]
  - @augur/service-kit@0.15.0

## 0.4.3

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

## 0.4.2

### Patch Changes

- dec1a40: Background and scheduled jobs for services: `createJobs` in the service kit, on DBOS Transact (ADR 0014). Runs are durable, queued runs go to one instance, scheduled ones run once per tick, and each run that ends is recorded in the audit log. The storage service gives each app a `<id>_jobs` schema to keep them in.
- 7517bd7: `release/shipped-apps.json` is now the one list of the apps that ship with AUGUR. The updater reads it from its image to restart them in order and check each comes back, and refuses an upgrade with an image for a part the server runs that it doesn't know, instead of restarting it unchecked. `pnpm check:release` fails when a compose file disagrees with it. The registry refuses an app whose id a part of AUGUR answers to (a platform service, a platform app, a deployment service or a path the front door serves), saying which, and storage makes no schema under such an id (`RESERVED_APP_IDS` in the service kit).

  The updater restarts AUGUR's own Keycloak image first, giving it up to five minutes to be ready, and keeps it running when going back to a release from before that image.

- Updated dependencies [7dbdf7b]
- Updated dependencies [2dbdc22]
- Updated dependencies [0ec750c]
- Updated dependencies [7518ce8]
- Updated dependencies [dec1a40]
- Updated dependencies [566f261]
- Updated dependencies [7517bd7]
  - @augur/service-kit@0.13.0

## 0.4.1

### Patch Changes

- 8d48714: Fixes from the 2 Nov audit. In Admin → People, a person's sign-in (on or off, a new one-time password) sits in its own section that says it takes effect at once: each asks first, acts straight away and says what happened, while their name, email, department and roles change only on Save. Agents stay among the Shell's functions and say they aren't here yet, and Home keeps the card of an app this shell can't open, saying why and who can change it, instead of hiding either. Messages people read say AUGUR, not "the platform", and `pnpm check:reasons` now catches it. The centre menu's transitions stop for AUGUR's own reduced-motion setting as well as the system's and are timed from motion tokens; the lifecycle's divider uses the hairline token; overlay shadows use the shadow token. A new test holds the Lit kit and AUGUR's frontends to tokens only.
- Updated dependencies [b3060e0]
  - @augur/service-kit@0.12.0

## 0.4.0

### Minor Changes

- 23a2f8f: Each platform service and Keycloak connects to Postgres with its own login, which owns only its own schema (Keycloak: its own database). The storage job makes the logins from `PLATFORM_DATABASE_LOGINS` and the `*_DATABASE_PASSWORD` settings, and hands each one what its service made as the admin login. The services make their schema only when it isn't there, since their own logins may not create schemas.

### Patch Changes

- Updated dependencies [137791c]
- Updated dependencies [2021f8a]
  - @augur/service-kit@0.11.0

## 0.3.1

### Patch Changes

- Updated dependencies [ea41136]
  - @augur/service-kit@0.10.0

## 0.3.0

### Minor Changes

- bbdad18: App databases get pg_trgm beside pgvector, so apps can match names spelt nearly alike (`similarity()`, trigram indexes).

### Patch Changes

- Updated dependencies [f0d02e2]
- Updated dependencies [bbdad18]
  - @augur/service-kit@0.9.0

## 0.2.1

### Patch Changes

- Updated dependencies [aa1724a]
  - @augur/service-kit@0.8.0

## 0.2.0

### Minor Changes

- 82ce131: Pull requests that change an app get previews: the App previews workflow builds, signs and releases each push as `<x.y.z>-pr.<n>.<run>`, and a server with the app installed runs the newest build beside it (at most three per app, for a week after the last build, gone when the pull request closes) with scratch storage of its own. An admin names an app’s developers in Admin → Apps; each developer can switch to a preview for themselves (`/v1/previews`), which gives them its frontend and sends their calls to it, while everyone else stays on the installed version.
- 476907a: Apps' secrets can be worked out instead of written into `.env`. With `APP_SECRETS_KEY` set, the storage container works out each app's database password and bucket secret from it and the app's id (`appSecretFor` in the service kit) when `.env` doesn't name them, and the app runner can set an app's sign-in to the secret it works out (`PUT /v1/admin/apps/{id}/credential`, the updater only). Secrets in `.env` still win.
- ef587a4: Apps' frontends are kept by version. An app's service gives the registry each version's built frontend before registering it (`publishFrontend` in the service kit, `PUT /v1/apps/{id}/versions/{version}/frontend`), the registry writes it to the new `augur-frontends` bucket that the storage container makes, and the front door serves it from Garage at `/apps/<id>/<version>/`. The manifest the shell is given then points at that version's own copy, so holding an app at an older version in Admin, Apps holds its code too. A version's frontend never changes once given. Folio gives its own on every start. Needs `FRONTENDS_BUCKET_SECRET` in `.env` (docs/upgrade.md); without it apps are served from their manifests' entry as before.

### Patch Changes

- Updated dependencies [57d3760]
- Updated dependencies [476907a]
- Updated dependencies [ef587a4]
- Updated dependencies [a6b6bca]
- Updated dependencies [948526d]
  - @augur/service-kit@0.7.0

## 0.1.0

### Minor Changes

- ebb8b97: App storage: an app can keep its own database schema and files on the platform. A new one-shot `storage` service gives each app listed in `APP_STORAGE` a database login that owns one schema, and a bucket on Garage (the new S3-compatible object store in the deploy stack) with a key that opens only that bucket, from secrets in `.env`. Postgres gains pgvector. The service kit adds `appStorageFromEnv()`, manifests may say `"storage": { "database": true, "bucket": true }`, and the nightly backup now takes apps' files as well. See docs/app-storage.md.
