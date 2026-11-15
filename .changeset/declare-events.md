---
"@augur/app-tools": minor
"@augur/registry": minor
---

An app's manifest can declare the domain events it reads and each type it publishes, with a version and its payload's JSON Schema (contributes.events, ADR 0104). The registry checks them on a release, holds each type to its version across releases, and tells AUGUR's services what an app declares (GET /v1/apps/:id/events).
