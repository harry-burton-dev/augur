---
"@platform/gateway": patch
"@platform/registry": patch
"@platform/events": patch
---

Security fixes from the code review. The gateway checks sign-in on every path but `/healthz`, by the route a request matched rather than its raw URL, so a percent-encoded path such as `/%61pi/library/…` can no longer skip the check. It no longer forwards the person's `Authorization` header to any service; services already get the caller in `x-user-*` headers. `APP_UPSTREAMS` may not name a platform service. The registry refuses an app route inside or around another app's route (`/admin/people` would have taken over Admin's People page). Events treats an `X-Workspace-Id` that won't URI-decode as an unknown floor (400) instead of failing with 500.
