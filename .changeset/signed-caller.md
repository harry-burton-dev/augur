---
"@augur/service-kit": minor
"@augur/gateway": minor
"@augur/identity": minor
"@augur/registry": minor
"@augur/events": minor
"@augur/models": minor
---

Signed caller: the gateway signs the person it passes on (`x-augur-caller`, Ed25519, one minute, one service as audience) and publishes its key at `/api/gateway/v1/caller-keys`. The service kit's `signedCallers` hook drops unsigned `x-user-*` headers and puts back only the signed caller; the platform's services and new apps use it.
