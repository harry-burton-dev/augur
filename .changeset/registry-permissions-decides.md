---
'@augur/registry': minor
---

The registry's admin checks can now be decided by the permissions service, site by site, when a deployment names them in `PERMISSIONS_DECIDES`. Until then today's roles decide, as before, except on a server that sets it to `all` (see the upgrade note).
