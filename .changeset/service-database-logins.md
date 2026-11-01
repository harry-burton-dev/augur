---
'@augur/storage': minor
'@augur/identity': patch
'@augur/registry': patch
'@augur/events': patch
'@augur/models': patch
---

Each platform service and Keycloak connects to Postgres with its own login, which owns only its own schema (Keycloak: its own database). The storage job makes the logins from `PLATFORM_DATABASE_LOGINS` and the `*_DATABASE_PASSWORD` settings, and hands each one what its service made as the admin login. The services make their schema only when it isn't there, since their own logins may not create schemas.
