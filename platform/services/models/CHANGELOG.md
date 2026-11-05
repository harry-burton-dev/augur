# @augur/models

## 0.3.6

### Patch Changes

- 3199b56: Someone talking to an AI app's agent now needs the role that app's manifest asks for, the same rule the gateway applies to the app's own API. Without it, models refuses the call and says which role is needed.
- Updated dependencies [833b4ed]
- Updated dependencies [431db38]
  - @augur/service-kit@0.15.0

## 0.3.5

### Patch Changes

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

## 0.3.4

### Patch Changes

- 0c4ab5e: The model gateway's schemas are TypeBox, and contracts/models.openapi.yaml is generated from them (ADR 0055). The contract now names the refusals the routes already sent.
- 03e7d87: Every deployment setting is described once, in infra/deploy/settings.schema.json, and CI checks compose.yml, .env.example, the guides and the services' code against it (`pnpm check:settings`). Settings the guides named but compose never passed now reach their services: FEED_SIGNER (registry), IMAGE_SIGNER, IMAGE_SIGNER_ISSUER and AUGUR_DEV_SIGNER (updater), DOMAIN_EVENTS_KEEP_DAYS (events), MODEL_TIMEOUT_SECONDS (models), CALLER_SIGNING_KEY (gateway), and OTEL_EXPORTER_OTLP_HEADERS, OTEL_TRACES_SAMPLER and OTEL_TRACES_SAMPLER_ARG (every service). An empty DOMAIN_EVENTS_KEEP_DAYS or MODEL_TIMEOUT_SECONDS keeps its default, and AUGUR_DEV_SIGNER follows the repository a fork's IMAGE_SIGNER names.
- 566f261: The service kit has one migration runner, `runMigrations(pool, { schema, migrations })`, and the events, identity, models and registry services use it in place of their own copies; what they do at start is unchanged. New migrations are linted with Squawk (ADR 0053), which catches drops, renames and type changes the old check missed.
- Updated dependencies [7dbdf7b]
- Updated dependencies [2dbdc22]
- Updated dependencies [0ec750c]
- Updated dependencies [7518ce8]
- Updated dependencies [dec1a40]
- Updated dependencies [566f261]
- Updated dependencies [7517bd7]
  - @augur/service-kit@0.13.0

## 0.3.3

### Patch Changes

- b3060e0: Every platform service answers errors as RFC 9457 problem details (`application/problem+json`) with AUGUR's `reason` and `whoCanChange`, and keeps `error` and `message` for SDK 1.x clients. The service kit adds `problemDetails()`, `Problem`, `sendProblem` and `serviceFastifyOptions()`. A service's unexpected errors are logged and answered with a plain 500, never with their own words.
- Updated dependencies [b3060e0]
  - @augur/service-kit@0.12.0

## 0.3.2

### Patch Changes

- 23a2f8f: Each platform service and Keycloak connects to Postgres with its own login, which owns only its own schema (Keycloak: its own database). The storage job makes the logins from `PLATFORM_DATABASE_LOGINS` and the `*_DATABASE_PASSWORD` settings, and hands each one what its service made as the admin login. The services make their schema only when it isn't there, since their own logins may not create schemas.
- Updated dependencies [137791c]
- Updated dependencies [2021f8a]
  - @augur/service-kit@0.11.0

## 0.3.1

### Patch Changes

- ea41136: Services stay up through a Postgres restart: a dropped idle connection is logged (`steadyPool` in the service kit) rather than ending the process, and the events service listens again on a new connection, so open notification streams don't go quiet for good.
- Updated dependencies [ea41136]
  - @augur/service-kit@0.10.0

## 0.3.0

### Minor Changes

- bbdad18: The model gateway turns apps' texts into vectors (`POST /v1/embeddings`, contract 1.1), to match by meaning, when an embedding model is set up (`MODEL_EMBEDDING_NAME`; the stand-in always has one). Each request is one call, recorded as `model.embedded` without the texts. `embedTexts` in the service kit asks for them.

### Patch Changes

- Updated dependencies [f0d02e2]
- Updated dependencies [bbdad18]
  - @augur/service-kit@0.9.0

## 0.2.3

### Patch Changes

- aa1724a: Services check their settings before they start. The service kit's `loadConfig` takes a list of the settings a service reads (`Setting`, plus `commonSettings` for the ones services share). In production, a missing required setting stops the service with one message listing every problem, instead of falling back to a `localhost` address. A secret can be given as a file in `<NAME>_FILE`. `describeConfig` reports each setting and where it came from, never a secret's value, ready for Admin → Deployment.
- Updated dependencies [aa1724a]
  - @augur/service-kit@0.8.0

## 0.2.2

### Patch Changes

- Updated dependencies [57d3760]
- Updated dependencies [476907a]
- Updated dependencies [ef587a4]
- Updated dependencies [a6b6bca]
- Updated dependencies [948526d]
  - @augur/service-kit@0.7.0

## 0.2.1

### Patch Changes

- Updated dependencies [f7fc3e6]
- Updated dependencies [94d0c0c]
- Updated dependencies [4608af1]
- Updated dependencies [936bb00]
  - @augur/service-kit@0.6.0

## 0.2.0

### Minor Changes

- b90f63b: Signed caller: the gateway signs the person it passes on (`x-augur-caller`, Ed25519, one minute, one service as audience) and publishes its key at `/api/gateway/v1/caller-keys`. The service kit's `signedCallers` hook drops unsigned `x-user-*` headers and puts back only the signed caller; the platform's services and new apps use it.

### Patch Changes

- Updated dependencies [ebb8b97]
- Updated dependencies [a3ba7ef]
- Updated dependencies [a09b413]
- Updated dependencies [b90f63b]
  - @augur/service-kit@0.5.0

## 0.1.0

### Minor Changes

- f090793: The model gateway: a new platform service (`models`) that alone holds an AI provider's key. It speaks the OpenAI-style chat API to whichever provider the server sets (`MODEL_API_URL`: OpenRouter, a LiteLLM proxy, any compatible API, or `stand-in`, a built-in model that doesn't think, for trying things out), records every call in the audit log before making it, and gives each app a number of calls a day. It is off until an admin turns it on. App services ask it with `askModel` from the service kit and need the new `models:use` scope; the gateway forwards `/api/models` to it.

### Patch Changes

- 8c0a9c8: Servers run released images instead of building them. Each AUGUR release now builds, pushes and signs (cosign, keyless) the web, gateway, identity, registry, events and models images to `ghcr.io/<repo>/<part>:<version>`, and its `augur-release.json` asset names each by digest. `infra/deploy/compose.yml` runs `${PLATFORM_IMAGES}/<part>:${PLATFORM_VERSION}` (new setting `PLATFORM_VERSION`, optional `PLATFORM_IMAGES` for a mirror); `compose.build.yml` builds from the checkout instead. The images run as unprivileged users, and the web container listens on 8080. See "Images from releases" in `docs/upgrade.md`.
- Updated dependencies [f090793]
- Updated dependencies [1622cd9]
  - @augur/service-kit@0.4.0
