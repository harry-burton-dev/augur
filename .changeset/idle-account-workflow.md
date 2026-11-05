---
'@augur/identity': minor
'@augur/admin': patch
---

The realm job keeps Keycloak's idle-account Workflow in step with Admin → Organisation: a warning email after the warning days without a sign-in, and the sign-in turned off at the turn-off days, never for deployment admins and never without email. Identity records such a turn-off as being idle.
