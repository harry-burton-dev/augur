---
'@augur/identity': minor
---

Sign-ins, failed sign-ins and changes to how someone signs in are copied from Keycloak into Activity each minute, under `detail.kind` `sign-in` (docs/people.md). Failed sign-ins for names nobody has are counted per hour without the name.
