---
"@augur/service-kit": minor
"@augur/gateway": minor
"@augur/updater": patch
"@augur/registry": patch
---

The gateway needs CALLER_SIGNING_KEY in production, and publishes CALLER_SIGNING_KEY_NEXT beside it so the key can be changed without refusing a call. A call from inside a service's own container is checked like any other unless CALLER_BREAK_GLASS=on, and each one break-glass lets through is logged. The updater makes up the signing key when an upgrade needs it.
