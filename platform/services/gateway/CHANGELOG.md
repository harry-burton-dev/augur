# @augur/gateway

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
