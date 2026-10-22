---
"@platform/gateway": minor
"@platform/service-kit": minor
---

The gateway checks the floor a request is for. An app sends `X-Workspace-Id`; the gateway asks identity which floors the caller is on (remembered for 30 seconds per person), answers 403 when they're not on that one and 503 when identity can't say, and otherwise passes it on as `x-workspace-id`, `x-workspace-kind` and `x-workspace-role`. Requests without the header are unchanged. Service-kit reads these as `caller.workspace`, and strips any floor headers a client sent along with the caller headers.
