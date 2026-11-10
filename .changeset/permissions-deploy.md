---
'@augur/permissions': minor
'@augur/updater': patch
---

Deployments run the permissions service and OpenFGA (ADR 0085). OpenFGA keeps its tables in a `permissions` schema on AUGUR's Postgres, under the permissions service's own login, and AUGUR ships its own OpenFGA image, which brings those tables up to date before it serves. The updater restarts both. Nothing asks the service yet.
