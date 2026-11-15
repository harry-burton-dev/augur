---
'@augur/service-kit': minor
'@augur/registry': minor
'@augur/app-tools': minor
'@augur/mfe-sdk': minor
---

The binding events are gone (decision D6, ADR 0066). The registry no longer serves `GET /v1/entity-links` or takes a manifest's `bindings`: contract 2 refuses the field, and contract 3 ignores it under `provisional`, with a warning, and refuses it at the top. The service kit drops `bindingTopics`, `bindingEvent`, `outboxBinding`, `readBinding`, `registryBindingApps` and their types. `AppManifestEntry.bindings` in the SDK is deprecated and never set.

Not breaking: nothing in AUGUR or in any app repository imports the removed helpers or calls the route.
