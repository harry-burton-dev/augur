---
"@platform/gateway": minor
"@platform/admin": minor
"@platform/registry": minor
"@platform/ui-kit": minor
---

Status in Admin: whether every part of the platform is answering, without the command line. The gateway checks every service's `/healthz` and the sign-in service's signing keys every 30 seconds, keeps the last answer, and serves it to admins at `GET /api/gateway/v1/status` (new contract `contracts/gateway.openapi.yaml`, API 1.0.0); a part that fails its check, or goes quiet for 2 minutes, reads Down. Admin's new Status screen lists each part with its version, state and when it last answered, refreshes every 15 seconds, and says what to check for a part that's down. Admin's menu gains a Platform stop with Status. The UI kit adds a `pulse` icon.
