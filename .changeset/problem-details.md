---
'@augur/service-kit': minor
'@augur/gateway': patch
'@augur/identity': patch
'@augur/registry': patch
'@augur/events': patch
'@augur/models': patch
---

Every platform service answers errors as RFC 9457 problem details (`application/problem+json`) with AUGUR's `reason` and `whoCanChange`, and keeps `error` and `message` for SDK 1.x clients. The service kit adds `problemDetails()`, `Problem`, `sendProblem` and `serviceFastifyOptions()`. A service's unexpected errors are logged and answered with a plain 500, never with their own words.
