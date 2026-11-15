---
'@augur/storage': minor
---

The storage job lets AUGUR's own database logins (its services and Keycloak) use the connections Postgres keeps back (`pg_use_reserved_connections`), and apps' logins never; Postgres keeps 40 of 200 for them (PER-414). Keycloak's and OpenFGA's pools are capped at 20.
