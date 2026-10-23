# @augur/models

## 0.1.0

### Minor Changes

- f090793: The model gateway: a new platform service (`models`) that alone holds an AI provider's key. It speaks the OpenAI-style chat API to whichever provider the server sets (`MODEL_API_URL`: OpenRouter, a LiteLLM proxy, any compatible API, or `stand-in`, a built-in model that doesn't think, for trying things out), records every call in the audit log before making it, and gives each app a number of calls a day. It is off until an admin turns it on. App services ask it with `askModel` from the service kit and need the new `models:use` scope; the gateway forwards `/api/models` to it.

### Patch Changes

- 8c0a9c8: Servers run released images instead of building them. Each AUGUR release now builds, pushes and signs (cosign, keyless) the web, gateway, identity, registry, events and models images to `ghcr.io/<repo>/<part>:<version>`, and its `augur-release.json` asset names each by digest. `infra/deploy/compose.yml` runs `${PLATFORM_IMAGES}/<part>:${PLATFORM_VERSION}` (new setting `PLATFORM_VERSION`, optional `PLATFORM_IMAGES` for a mirror); `compose.build.yml` builds from the checkout instead. The images run as unprivileged users, and the web container listens on 8080. See "Images from releases" in `docs/upgrade.md`.
- Updated dependencies [f090793]
- Updated dependencies [1622cd9]
  - @augur/service-kit@0.4.0
