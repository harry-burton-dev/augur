---
"@augur/identity": minor
---

Adds the Deployment Admin role (`deployment-admin`). Identity gives it to `PLATFORM_ADMIN_USER` when nobody has it, only a deployment admin can give it, take it away or change a holder's sign-in, and holders sign in with a one-time code as well as their password (identity sets this up in Keycloak's sign-in flow at start).
