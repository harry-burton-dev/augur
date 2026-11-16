---
'@augur/service-kit': minor
'@augur/registry': minor
'@augur/app-tools': minor
'@augur/mfe-sdk': minor
---

The binding events are gone (decision D6, ADR 0066). The registry no longer serves `GET /v1/entity-links`, and a manifest's `bindings` is accepted but ignored, for one release: contract 3 says so in a warning. The service kit drops `bindingTopics`, `bindingEvent`, `outboxBinding`, `readBinding`, `registryBindingApps` and their types. `AppManifestEntry.bindings` in the SDK is deprecated.

Not breaking: nothing in AUGUR or in any app repository imports the removed service kit helpers or calls the route removed from contracts/registry.openapi.yaml.
