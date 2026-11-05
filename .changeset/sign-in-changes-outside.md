---
'@augur/identity': minor
'@augur/admin': patch
---

Identity notices a sign-in turned off or on in Keycloak itself within five minutes: it ends their sessions, keeps the change and records it in Activity as the sign-in service's doing.
