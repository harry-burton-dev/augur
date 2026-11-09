---
"@augur/service-kit": minor
"@augur/events": minor
"@augur/registry": minor
"@augur/gateway": minor
"@augur/admin": minor
---

AUGUR pushes each domain event to the inbound part of every app granted `events:subscribe` (contract 3, spec 8.6): `POST /augur/events` through the gateway, in order per app, with `Idempotency-Key: events-<seq>`, retried with a backoff from a second to ten minutes, passed over and recorded after a day. An app's own events and events on floors where it lacks the scope are not sent. The gateway now takes a platform service's token, but only to an app's part, signing the caller `augur:<service>` for the part to check (`isServiceCaller`, `serviceOfCaller`); the registry lists the apps granted a scope (`GET /v1/scopes/{scope}/apps`, platform services); events shows how each app is taking its events (`GET /v1/deliveries`, admins), which Admin → Apps shows, saying since when and why an app is stalled.
