---
"@augur/gateway": minor
"@augur/admin": minor
---

Open AUGUR to the internet for a while: `infra/deploy/public.sh on 2h | off | status` serves AUGUR's own address through Tailscale Funnel (the front door only; Keycloak's console stays closed to the internet) and closes it by itself when the time is up, even over a restart. The gateway reads it from `PUBLIC_ACCESS_FILE` and adds `publicAccess` to `GET /api/gateway/v1/status` (API 1.4.0); Admin → Status says "Open to the internet until …" while it's open. Allowing Funnel in the tailnet's policy once is in docs/deploy.md.
