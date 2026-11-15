---
"@augur/events": minor
"@augur/service-kit": minor
---

The events service holds an app to the events its manifest declares (ADR 0104): only the topics it reads, pulled or pushed, and only the types it publishes, each payload checked against its version's schema. Events carry their type's version. The service kit adds registryDeclaredEvents.

Not breaking: everything is added; `addToOutbox` leaves out only `version`, which is new here, so no caller passes it.
