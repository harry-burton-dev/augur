---
"@platform/shell": patch
---

The shell accepts a path for `VITE_OIDC_AUTHORITY` (like `/sso/realms/platform`), resolved against the address it is served from, so one build works behind any hostname. Adds `infra/deploy`: the whole platform in Docker Compose on one server, reached over Tailscale (see docs/deploy.md).
