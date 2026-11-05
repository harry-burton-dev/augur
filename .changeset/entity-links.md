---
"@augur/mfe-sdk": minor
"@augur/registry": minor
"@augur/service-kit": minor
---

Apps say they bind their things to entities with `links: { entities: true }` and name the types they bind in `bindings` (lowercase, up to 10, never `entity` or `role`; SDK 2.1, ADR 0066). The registry lists those apps and types for any service at `GET /v1/entity-links`, and the service kit's `registryBindingApps` reads it, cached, so a follower such as Data Atlas subscribes to exactly `<app>.<type>.entity-bound` and `-unbound`.
