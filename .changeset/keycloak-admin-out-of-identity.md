---
'@augur/identity': minor
---

Identity no longer holds Keycloak's master admin password. The realm file gives identity's own sign-in its rights on a new server, and identity checks that it has them at start. If they're missing, it says how to repair them with `infra/deploy/identity-repair.yml` for one start.
