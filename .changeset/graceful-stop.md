---
"@augur/service-kit": minor
"@augur/gateway": minor
"@augur/identity": minor
"@augur/registry": minor
"@augur/events": minor
"@augur/models": minor
"@augur/knowledge": minor
"@augur/permissions": minor
---

AUGUR's services stop cleanly and say when they are ready. The service kit's `serve()` runs each one: `GET /readyz` answers only once its database (and, for permissions, OpenFGA) answers, and on SIGTERM a service stops taking new calls, ends its open event streams, lets the calls in flight finish for up to `SHUTDOWN_GRACE_SECONDS` (20), closes its pools, then sends its telemetry. Compose's healthchecks ask `/readyz`, and Docker waits 30 seconds for a service to stop.
