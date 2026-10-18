---
"@platform/identity": minor
"@platform/registry": minor
"@platform/events": minor
"@platform/service-kit": minor
"@platform/gateway": patch
"@platform/shell": minor
"@apps/library": patch
---

Version the HTTP APIs and report releases on health. Each service's API now lives under `/v1` (through the gateway, `/api/<service>/v1/...`), matching its OpenAPI contract's major version, and `GET /healthz` answers with the service's release and API version. The registry requires every app to say which SDK releases it works with (`sdk`, a semver range) and a semver `version`; the shell won't open an app whose range its SDK doesn't satisfy, and says why.
