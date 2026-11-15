---
'@augur/storage': minor
'@augur/knowledge': minor
---

The storage job and the knowledge migration let AUGUR's own database logins (its services, the knowledge graph's and Keycloak's) use the connections Postgres keeps back (`pg_use_reserved_connections`), and apps' logins never; Postgres keeps 40 of 200 for them (PER-414). Keycloak's and OpenFGA's pools are capped at 20.
