---
"@augur/shell": minor
---

The front door holds callers to limits. Keycloak's own admin console and its `master` realm answer 404 unless `KEYCLOAK_CONSOLE=open`. Each address gets a request rate for the API (`API_RATE_PER_SECOND`, `API_RATE_BURST`) and for sign-in (`SSO_RATE_PER_SECOND`, `SSO_RATE_BURST`), and is answered 429 past it. The address comes from `X-Forwarded-For`, which is believed only from private addresses. The largest upload is `MAX_UPLOAD_MB`. See docs/deploy.md, "Limits at the front door".
