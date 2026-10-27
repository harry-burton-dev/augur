---
"@augur/service-kit": minor
"@augur/gateway": patch
"@augur/identity": patch
"@augur/registry": patch
"@augur/events": patch
"@augur/models": patch
"@augur/updater": patch
"@apps/folio": patch
---

Services check their settings before they start. The service kit's `loadConfig` takes a list of the settings a service reads (`Setting`, plus `commonSettings` for the ones services share). In production, a missing required setting stops the service with one message listing every problem, instead of falling back to a `localhost` address. A secret can be given as a file in `<NAME>_FILE`. `describeConfig` reports each setting and where it came from, never a secret's value, ready for Admin → Deployment.
