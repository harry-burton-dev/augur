---
"@augur/gateway": minor
---

The organisation's logo is reachable without signing in, at `/api/identity/v1/public/organisation/logo`, so sign-in pages can show it. It is the only path under `/api/` that needs no sign-in: GET and HEAD only, no caller passed on, and only the PNG and its caching headers passed back, with `nosniff`.
