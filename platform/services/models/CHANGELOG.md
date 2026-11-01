# @augur/models

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
